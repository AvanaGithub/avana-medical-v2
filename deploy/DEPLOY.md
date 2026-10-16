# Putting the Avana Medical website on DigitalOcean

The website and its **admin panel** run together on one small DigitalOcean server (a "droplet") in the **Avana Medical** DigitalOcean account. It is separate from the Avana Surgical servers.

## What runs on the server

| Part | What it does |
|---|---|
| **Website** | All the pages, each at its own address, plus the careers flow (openings by email, the /job page, one-click apply). |
| **Admin panel** (`/admin`) | Sign in to post jobs, see openings requests and applications (with CVs), and manage users. |
| **Database** | One SQLite file: `/var/lib/avana-medical/data/app.db` |
| **Uploaded photos** | `/var/lib/avana-medical/uploads/` (resized to 1600×1000 and 800×500 automatically) |
| **Job board** | Jobs posted in Admin → Jobs appear under "Current openings" on the Careers page; each open job also has its own page `/jobs/<name>` with Google Jobs data |
| **Candidates' CVs** | `/var/lib/avana-medical/data/cv/`, private: never reachable from the web, only downloadable by signed-in staff |
| **Backups** | Every night at 02:30: database + photos + CVs → `/var/lib/avana-medical/backups/`, kept 14 days |

Code lives in `/var/www/avana-medical` and comes from GitHub (`AvanaGithub/avana-medical-v2`). Data lives in `/var/lib/avana-medical`, so updating the code never touches events or photos.

---

## Step 1 — Create the droplet (in the Avana Medical DigitalOcean account)

1. **Create → Droplets**
2. **Region:** Bangalore (BLR1), closest to your visitors
3. **Image:** Ubuntu **24.04 (LTS) x64**
4. **Size:** Basic → Regular → **$6/month (1 GB RAM / 25 GB disk)** is enough to start
5. **Authentication:** SSH Key → **New SSH Key**, paste this public key, and name it `avana-medical-droplet`:

   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKAUIZDfg/Mk2osg1gjHFz1s8l/j3hX9mf96FFbB7wwg avana-medical-droplet
   ```
   (This is a *public* key, safe to share. The matching private key stays on Pushparaj's computer: `~/.ssh/avana_medical_do`.)
6. Recommended: tick **Add improved metrics monitoring** and **Enable backups** (+20%, weekly whole-server snapshots)
7. **Hostname:** `avana-medical-web` → **Create Droplet**
8. Copy the droplet's **IPv4 address**.

## Step 2 — Point a test address at it

avanamedical.com's DNS is managed at **GoDaddy** (nameservers ns63/ns64.domaincontrol.com). In GoDaddy: **My Products → avanamedical.com → DNS → Add New Record**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `test` | *droplet IPv4 address* | 300 |

This creates **test.avanamedical.com** for review. The current avanamedical.com is not affected.

## Step 3 — Install (Claude can do this over SSH)

```bash
ssh -i ~/.ssh/avana_medical_do root@<droplet-ip>
curl -fsSL https://raw.githubusercontent.com/AvanaGithub/avana-medical-v2/main/deploy/setup.sh -o setup.sh
bash setup.sh test.avanamedical.com
apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d test.avanamedical.com
```

## Step 4 — Create the first admin

```bash
cd /var/www/avana-medical/server
sudo -u avana npm run create-admin -- you@avanamedical.com "Your Name"
```
It asks for a password (at least 10 characters, letters and numbers). After that, add everyone else from **Admin → Users**.

## Step 4b — Set up email (needed for "See open positions")

Job seekers get the openings as a personal link by email, so the server must be able to send email. Until this is done, requests still appear in **Admin → Openings requests**, and HR can use **New link** there to copy a person's link and send it themselves.

DigitalOcean blocks the usual email ports (25, 465, 587) on new droplets, so use a sending service that also listens on port 2525, such as Brevo (free tier: 300 emails a day):

1. Create the account, then add and verify the domain `avanamedical.com` (Brevo: Senders, Domains & Dedicated IPs → Domains). It gives you DNS records to add in GoDaddy: a `brevo-code` TXT and DKIM records. **Add them; don't change the existing MX or Microsoft 365 records.**
2. SPF: the domain already has `v=spf1 include:spf.protection.outlook.com -all`. **Edit that record** to `v=spf1 include:spf.protection.outlook.com include:spf.brevo.com -all`. Never add a second SPF record: two SPF records break email for both.
3. The domain's DMARC policy is `quarantine`, so emails only reach inboxes once Brevo shows the domain as **Authenticated** (DKIM). Wait for that before testing.
4. Create an SMTP key (Brevo: SMTP & API → SMTP), then in `/var/www/avana-medical/server/.env` uncomment and fill in `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_USER` (the SMTP login Brevo shows) and `SMTP_PASS` (the key). Also set `MAIL_REPLY_TO` (where candidates' replies go: recruitment@avanamedical.com) and, optionally, `HR_NOTIFY_EMAIL` (a copy of each openings request) and `APPLICATION_NOTIFY_EMAIL` (an alert with the admin link each time someone applies).
5. `systemctl restart avana-medical`, then request the openings yourself on the Careers page and check that the email lands in the inbox, not spam.

## Step 4c — Copy the private files

The GitHub repository is public, so some files are kept out of it and copied to the server by hand. Today that is the ISO 13485 certificate: two watermarked page images that the About page shows in a view-only viewer. From the computer that has them:

```bash
scp -i ~/.ssh/avana_medical_do -r server/private root@<droplet-ip>:/var/www/avana-medical/server/
ssh -i ~/.ssh/avana_medical_do root@<droplet-ip> chown -R avana:avana /var/www/avana-medical/server/private
```

`git pull` leaves this folder alone (it is in `.gitignore`).

## Step 5 — Go live on avanamedical.com (when everyone is happy)

1. DNS: point the `@` (and `www`) A records to the droplet IP.
2. On the droplet: `certbot --nginx -d avanamedical.com -d www.avanamedical.com`
3. Add `avanamedical.com www.avanamedical.com` to `server_name` in `/etc/nginx/sites-available/avana-medical`, then `nginx -t && systemctl reload nginx`.
4. Let Google index the real site: in `/var/www/avana-medical/server/.env` set `NOINDEX=false` and `SITE_URL=https://avanamedical.com`, then `systemctl restart avana-medical`. (The test address is hidden from search engines on purpose.)

---

## Everyday tasks

| Task | How |
|---|---|
| Post, edit or close a job | Admin → Jobs (Draft = hidden, Open = on the emailed openings links, Closed = hidden). After the "last date to apply" a job hides itself |
| See who asked for the openings, resend a link | Admin → Openings requests. A link works for 30 days (`OPENINGS_LINK_DAYS` in `.env`) |
| Review applicants | Admin → Applications: filter by job/status, open a candidate, download the CV, set status (New → Shortlisted → Interview → Offered → Hired / Rejected), add internal notes |
| A candidate asks for their data to be deleted | Admin → Applications → open them → **Delete application** (removes the record and the CV) |
| Add a team member | Admin → Users → **Add user** (Editor = jobs and candidates, Admin = also users) |
| Someone forgot their password | An admin opens Users → Edit → set a new password |
| Deploy new code from GitHub | `bash /var/www/avana-medical/deploy/update.sh` |
| Check it is running | `systemctl status avana-medical` · logs: `journalctl -u avana-medical -n 100` |
| Restore a backup | `systemctl stop avana-medical` → copy `backups/<date>/app.db` over `data/app.db` and untar `uploads.tar.gz` into `/var/lib/avana-medical` → `chown -R avana:avana /var/lib/avana-medical` → `systemctl start avana-medical` |
