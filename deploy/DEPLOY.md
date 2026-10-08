# Putting the Avana Medical website on DigitalOcean

The website and its **News & Events admin panel** run together on one small DigitalOcean server (a "droplet") in the **Avana Medical** DigitalOcean account. It is separate from the Avana Surgical servers.

## What runs on the server

| Part | What it does |
|---|---|
| **Website** | The same pages as today. News & Events cards are filled in from the database on every visit. |
| **Admin panel** (`/admin`) | Sign in, then add, edit, hide, reorder or delete events, with a 16:10 image cropper. |
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

Where avanamedical.com's DNS is managed, add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `new` | *droplet IPv4 address* | 300 |

This creates **new.avanamedical.com** for review. The current avanamedical.com is not affected.

## Step 3 — Install (Claude can do this over SSH)

```bash
ssh -i ~/.ssh/avana_medical_do root@<droplet-ip>
curl -fsSL https://raw.githubusercontent.com/AvanaGithub/avana-medical-v2/main/deploy/setup.sh -o setup.sh
bash setup.sh new.avanamedical.com
apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d new.avanamedical.com
```

## Step 4 — Create the first admin

```bash
cd /var/www/avana-medical/server
sudo -u avana npm run create-admin -- you@avanamedical.com "Your Name"
```
It asks for a password (at least 10 characters, letters and numbers). After that, add everyone else from **Admin → Users**.

## Step 5 — Go live on avanamedical.com (when everyone is happy)

1. DNS: point the `@` (and `www`) A records to the droplet IP.
2. On the droplet: `certbot --nginx -d avanamedical.com -d www.avanamedical.com`
3. Add `avanamedical.com www.avanamedical.com` to `server_name` in `/etc/nginx/sites-available/avana-medical`, then `nginx -t && systemctl reload nginx`.

---

## Everyday tasks

| Task | How |
|---|---|
| Add or change events | `https://<site>/admin` → News & Events |
| Post, edit or close a job | Admin → Jobs (Draft = hidden, Open = on the Careers page, Closed = hidden). After the "last date to apply" a job hides itself |
| Review applicants | Admin → Applications: filter by job/status, open a candidate, download the CV, set status (New → Shortlisted → Interview → Offered → Hired / Rejected), add internal notes |
| A candidate asks for their data to be deleted | Admin → Applications → open them → **Delete application** (removes the record and the CV) |
| Add a team member | Admin → Users → **Add user** (Editor = events only, Admin = events + users) |
| Someone forgot their password | An admin opens Users → Edit → set a new password |
| Deploy new code from GitHub | `bash /var/www/avana-medical/deploy/update.sh` |
| Check it is running | `systemctl status avana-medical` · logs: `journalctl -u avana-medical -n 100` |
| Restore a backup | `systemctl stop avana-medical` → copy `backups/<date>/app.db` over `data/app.db` and untar `uploads.tar.gz` into `/var/lib/avana-medical` → `chown -R avana:avana /var/lib/avana-medical` → `systemctl start avana-medical` |
