# Avana Medical website: launch checklist

Status as of 15 Oct 2026. Tick items off as they are done.

## 1. Decisions and content from the Avana team

- [ ] **Leadership names and titles.** Confirm the spelling of Gautham or Gautam, Avadhut or Avdhut, and Praveen Raghavendra's title ("Dextra & Bio").
  - S. Singaravel: "Service & IT" or "IT & Service"?
  - M. Srinivasan: "Finance & Admin Accounts" or "Finance & Administration"?
- [ ] **Photos** (600×600) for E. Siva Praveen and S. Sathish.
- [ ] **LinkedIn links** for E. Siva Praveen, S. Sathish and M. Srinivasan, or confirm that they have none so the icon can be hidden.
- [ ] **Team bios.** Keep both versions (the colleague's profile and the person's own words) or only one?
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
- [ ] **Email sending** (Brevo or similar on port 2525) so that openings links are actually emailed. This needs an account and two DNS records in GoDaddy.

## 3. Test site (test.avanamedical.com)

- [ ] **Hosting account.** Add a payment method to the Avana Medical DigitalOcean account and create the droplet (Bangalore, Ubuntu 24.04).
- [ ] **Droplet IP.** Send the IP to set up the server.
- [ ] **DNS.** In GoDaddy, add an A record so that `test` points to the droplet IP. Don't touch `@`, `www` or the MX records.
- [ ] **Code on GitHub.** Push the code: 4 commits are waiting (team bios, colleague's updates, careers email flow, SEO pages).
- [ ] **Install.** Run the setup script, set up HTTPS with certbot, and create the first admin and the HR users.
- [ ] **Email settings.** Add the SMTP settings to the server and send a test openings request to yourself.
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
