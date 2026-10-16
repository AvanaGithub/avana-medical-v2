# Avana Medical website: launch checklist

Status as of 15 Oct 2026. Tick items off as they are done.

## 1. Decisions and content from the Avana team

- [x] **Leadership team.** Matched to the MD's version on 16 Oct: 7 leaders, their order, titles, bios and photos (E. Siva Praveen and S. Sathish removed).
- [ ] **ISO certificate.** Open "View our certificate" on the About page and confirm that the PDF is correct.
- [ ] **News & Events.** Add real dates and photos for the five upcoming events (they currently say "Dates to be announced"). This can be done in the admin panel.
- [ ] **Careers form.** HR to confirm that age and marital status should be required fields.
- [ ] **Careers job listings.** Agree that jobs are no longer public, which means no Google Jobs and no direct job links on LinkedIn.
- [ ] **Careers applications.** Does Avana use Zoho Recruit? If so, decide where applications should go.
- [ ] **HR contact email.** The site uses info@avanamedical.com. Should it be a separate HR address?
- [ ] **Privacy and consent wording** (DPDP Act). Review the text of the two forms and supply the privacy policy text.
- [ ] **Old site page targets.** Decide where /surgeon-education/, /patient-education/, /knowledge-center/ and /research-publications/ should redirect (see `migration/REDIRECT-PLAN.md`).

## 2. Still to build

- [ ] **Privacy policy page** at /privacy-policy/. The old site has one, and both forms link to the consent wording.
- [x] **Real page addresses** (/about-us/, /careers/, /leadership/, /products/arthrex/ …), each with its own title and meta description. Done 15 Oct; the wording is in `server/src/pages.js`.
- [x] **301 redirects** from the old WordPress addresses, plus 410 responses for junk pages. Still to add: the 4 education and research pages once their targets are decided.
- [x] **sitemap.xml**, and robots.txt pointing to it.
- [x] **Email sending.** Brevo set up 16 Oct: domain records (SPF fixed, DKIM, Brevo code) in GoDaddy; SMTP login + key in server/.env; test email reached the inbox. Before launch: create a fresh SMTP key (the current one was shared in chat).

## 3. Test site (test.avanamedical.com)

- [x] **Hosting account.** Droplet avanamedical-website-droplet (Ubuntu 24.04, 1 GB) in the Avana Medical DigitalOcean account.
- [x] **Droplet IP.** 168.144.88.82 (also added to Brevo authorised IPs).
- [x] **DNS.** test.avanamedical.com → 168.144.88.82 in GoDaddy.
- [x] **Code on GitHub.** Pushed 15 Oct (team bios, colleague's updates, careers email flow, SEO pages).
- [x] **Install.** Site, HTTPS certificate, firewall, nightly backups and admin user in place; updated to the latest code on 16 Oct.
- [x] **Email settings.** Brevo settings on the server; test email from the droplet reached the inbox (16 Oct).
- [ ] **Phone testing.** Test on a real iPhone and a real Android phone (Safari and Chrome).
- [ ] **Stakeholder review.** Share the test site with stakeholders and collect feedback.

## 4. Go live on avanamedical.com

- [ ] **DNS.** In GoDaddy, point `@` and `www` to the droplet. Leave MX and Microsoft 365 as they are.
- [ ] **HTTPS** for avanamedical.com and www, using certbot.
- [ ] **Server settings.** In `.env`, set `NOINDEX=false` and `SITE_URL=https://avanamedical.com`, then restart the site.
- [ ] **Old server.** Keep the old WordPress server running for 48 hours, then switch it off.
- [ ] **Check redirects.** Check every old address in the redirect plan.
- [ ] **Search Console.** Submit sitemap.xml in Google Search Console and watch for 404 errors over the next few weeks.
- [ ] **Backups.** Confirm the nightly backups are running and download one copy.
