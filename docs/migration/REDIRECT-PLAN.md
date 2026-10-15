# avanamedical.com → new site: page inventory and redirect plan

Audit of the current WordPress site (Yoast SEO), done on 14 Oct 2026 from its sitemap, its WordPress content list and a link crawl. The full list is in `old-site-pages.csv`.

## What the current site has

- **17 pages**, all in the sitemap. There are no blog posts.
- **Every page has the meta title "Avana" and no meta description.** Google sees 17 pages all called "Avana", so search snippets are weak today. The new site will have a proper title and description for every page.
- The official address is `https://avanamedical.com` (no www). `www.` and `http://` already redirect to it, and the new server must do the same.
- The research PDFs are hosted by Arthrex (`cdn.arthrex.io`), so they are unaffected by the move.
- Leftovers that are not real pages: `/filter-search/neha/`, `/saurabh/`, `/abdul/` (a plugin's test entries), `/clavicle/` (an empty test page), `/research-publications-old/` (an old copy) and `/comments/feed/`.
- Existing quirks: `/careers/` currently redirects to a JPG image, and `/gallery/` returns 404 (the real page is the misspelt `/gallary/`).

## Recommended approach

1. **Give the new site real page addresses** (`/about-us/`, `/careers/` …) instead of only `/#about`. Google ignores everything after `#`, so with `/#about` every page counts as the home page and can't rank on its own. The new server can serve each section at its own address, with its own title and description.
2. **Keep the old address wherever the page still exists.** Those pages need no redirect at all.
3. **Send everything else to the closest new page with a permanent (301) redirect,** so bookmarks, old links and Google rankings carry over.
4. **Answer 410 Gone for junk pages** so Google drops them quickly.

## Redirect map

| Old address | New address | Type | Notes |
|---|---|---|---|
| `/` | `/` | same | |
| `/about-us/` | `/about-us/` | same | |
| `/contact-us/` | `/contact-us/` | same | |
| `/news-events/` | `/news-events/` | same | |
| `/privacy-policy/` | `/privacy-policy/` | same | **The new site has no privacy page yet. It is needed (DPDP Act, job applications).** Port the current text. |
| `/career/` | `/careers/` | 301 | |
| `/products/` | `/products/arthrex/` | 301 | The old products page is the Arthrex range by anatomy |
| `/whats-new-at-arthrex/` | `/products/arthrex/` | 301 | |
| `/new-techniques-of-the-month/` | `/products/arthrex/` | 301 | |
| `/research-publications/` | `/products/arthrex/` | 301 | Clinical papers are Arthrex PDFs; alternative: a small Research page on the new site |
| `/research-publications-old/` | `/products/arthrex/` | 301 | |
| `/clavicle/` | `/products/arthrex/` | 301 | Empty test page |
| `/surgeon-education/` | `https://arthrolab.in/` | 301 | Matches the new menu: Medical Education → ArthroLab India |
| `/knowledge-center/` | `https://www.youtube.com/@MargdarshanAvana` | 301 | Videos now live on the Margdarshan YouTube channel |
| `/patient-education/` | `https://www.orthopedia.com/` | 301 | Matches the new menu: Patient Education |
| `/find-a-doctor/` | `/contact-us/` | 301 | "Seeking guidance?" page for patients |
| `/gallary/`, `/gallery/` | `/news-events/` | 301 | Event photos now sit in News & Events |
| `/about/`, `/contact/`, `/news/`, `/events/`, `/home/`, `/index.php` | matching new page | 301 | Common guesses, kept working as today |
| `/filter-search/*`, `/comments/feed/`, `/feed/` | none | 410 | Plugin and feed leftovers |
| `/wp-admin/`, `/wp-login.php`, `/xmlrpc.php` | none | 410 | WordPress is gone; stops bots knocking |

New pages with no old equivalent: `/leadership/` (Meet the Team), `/products/echi/`, `/products/movmedix/`, `/jobs/<job>`.
Old links to the hash addresses (`/#about`, `/#careers` …) keep working.

## Proposed titles and descriptions for the new site

| Page | Meta title (≤ 60 characters) | Meta description (≤ 155 characters) |
|---|---|---|
| `/` | Avana Medical Devices – Orthopaedic Solutions in India | Avana brings Arthrex sports medicine, arthroscopy and orthopaedic technology to surgeons and hospitals across India and SAARC since 2009. |
| `/about-us/` | About Us – Avana Medical Devices | Since 2009, Avana has partnered with surgeons across India and SAARC with advanced orthopaedic technology, medical education and clinical support. |
| `/leadership/` | Leadership Team – Avana Medical Devices | Meet the people leading Avana Medical Devices across sales, marketing, medical education, finance and service. |
| `/products/arthrex/` | Arthrex Products in India – Avana Medical Devices | Arthrex solutions by anatomy: shoulder, knee, hand and wrist, foot and ankle, hip, orthobiologics, imaging and endoscopy, available through Avana. |
| `/products/echi/` | e.CHI FrequenzChip in India – Avana Medical Devices | e.CHI from Germany: a drug-free wearable FrequenzChip for everyday pain relief, now in India through Avana Medical Devices. |
| `/products/movmedix/` | MovMedix LARS Ligaments in India – Avana Medical | MovMedix LARS synthetic ligaments from France for knee, shoulder, foot and ankle and soft-tissue reconstruction, available in India through Avana. |
| `/news-events/` | News & Events – Avana Medical Devices | Upcoming events, academic programmes and recognitions from across the Avana family, from dealer meets to knee surgery programmes. |
| `/careers/` | Careers at Avana – Medical Device Jobs in India | Join Avana Medical Devices in sales, medical education and service. Great Place To Work certified. Request our current openings by email. |
| `/contact-us/` | Contact Us – Avana Medical Devices | Contact Avana Medical Devices in Chennai, Mumbai, Delhi and Bengaluru. Call +91 44 2233 1061 or email info@avanamedical.com. |
| `/privacy-policy/` | Privacy Policy – Avana Medical Devices | How Avana Medical Devices collects, uses and protects personal information, including job applications and enquiries. |

## On go-live day

1. Keep the old WordPress server running until the DNS change has spread (about 48 hours).
2. Point `@` and `www` to the new droplet in GoDaddy. Don't touch MX or the Microsoft 365 records.
3. Check every row of the redirect map returns the expected status, and submit the new `sitemap.xml` in Google Search Console.
4. Watch Search Console → Pages for 404s over the following weeks, and add redirects for anything missed.
5. Images from the old site's `/wp-content/uploads/` disappear with WordPress. The new site doesn't use them, but anything else that still links to them (old emails, the first test site) will break.
