// Each section of the one-page site gets its own address, title and description for search engines and
// link previews. The server writes these into the HTML (see seoHead), and js/main.js keeps the address bar,
// title and description in step as visitors move between sections.
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const PAGES = {
  home: {
    path: '/',
    title: 'Avana Medical Devices – Orthopaedic Solutions in India',
    description: 'Avana brings Arthrex sports medicine, arthroscopy and orthopaedic technology to surgeons and hospitals across India and SAARC since 2009.'
  },
  about: {
    path: '/about-us/',
    title: 'About Us – Avana Medical Devices',
    description: 'Since 2009, Avana has partnered with surgeons across India and SAARC with advanced orthopaedic technology, medical education and clinical support.'
  },
  team: {
    path: '/leadership/',
    title: 'Leadership Team – Avana Medical Devices',
    description: 'Meet the people leading Avana Medical Devices across sales, marketing, medical education, finance and service.'
  },
  arthrex: {
    path: '/products/arthrex/',
    title: 'Arthrex Products in India – Avana Medical Devices',
    description: 'Arthrex solutions by anatomy: shoulder, knee, hand and wrist, foot and ankle, hip, orthobiologics, imaging and endoscopy, available through Avana.'
  },
  echi: {
    path: '/products/echi/',
    title: 'e.CHI FrequenzChip in India – Avana Medical Devices',
    description: 'e.CHI from Germany: a drug-free wearable FrequenzChip for everyday pain relief, now in India through Avana Medical Devices.'
  },
  movmedix: {
    path: '/products/movmedix/',
    title: 'MovMedix LARS Ligaments in India – Avana Medical',
    description: 'MovMedix LARS synthetic ligaments from France for knee, shoulder, foot and ankle and soft-tissue reconstruction, available in India through Avana.'
  },
  careers: {
    path: '/careers/',
    title: 'Careers at Avana – Medical Device Jobs in India',
    description: 'Join Avana Medical Devices in sales, medical education and service. Great Place To Work certified. Request our current openings by email.'
  },
  // The openings page, reached only from the personal link we email; never listed or indexed
  jobs: {
    path: '/job',
    private: true,
    title: 'Current Openings – Avana Medical Devices',
    description: 'Current openings at Avana Medical Devices in sales, marketing, medical education and service.'
  },
  contact: {
    path: '/contact-us/',
    title: 'Contact Us – Avana Medical Devices',
    description: 'Contact Avana Medical Devices in Chennai, Mumbai, Delhi and Bengaluru. Call +91 44 2233 1061 or email info@avanamedical.com.'
  }
};

const byPath = Object.fromEntries(Object.entries(PAGES).map(([route, p]) => [p.path, route]));

// Old avanamedical.com (WordPress) addresses and common guesses → the new page (301, permanent).
// Still to decide: /surgeon-education/, /patient-education/, /knowledge-center/, /research-publications/ (they 404 for now).
const REDIRECTS = {
  '/index.html': '/', '/index.php': '/', '/home/': '/',
  '/about/': '/about-us/',
  '/team/': '/leadership/', '/leaders/': '/leadership/', '/meet-the-team/': '/leadership/',
  '/contact/': '/contact-us/', '/find-a-doctor/': '/contact-us/',
  '/career/': '/careers/', '/jobs/': '/careers/',
  // News & Events was removed (16 Oct 2026): its old addresses go to the home page
  '/news-events/': '/', '/news/': '/', '/events/': '/', '/gallary/': '/', '/gallery/': '/',
  '/products/': '/products/arthrex/', '/arthrex/': '/products/arthrex/', '/whats-new-at-arthrex/': '/products/arthrex/',
  '/new-techniques-of-the-month/': '/products/arthrex/', '/clavicle/': '/products/arthrex/', '/research-publications-old/': '/products/arthrex/',
  '/echi/': '/products/echi/', '/movmedix/': '/products/movmedix/'
};

// Old WordPress leftovers: tell search engines they are gone for good
const GONE = /^\/(filter-search(\/.*)?|comments\/feed|feed|wp-admin(\/.*)?|wp-login\.php|xmlrpc\.php|wp-json(\/.*)?)\/?$/;

// What the client router needs: route → { path, title, description }
const clientMap = () => JSON.stringify(PAGES);

function organizationJsonLd(siteUrl) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Avana Medical Devices Pvt. Ltd.',
    alternateName: 'Avana Medical',
    url: siteUrl + '/',
    logo: siteUrl + '/images/logos/avana-dark.png',
    foundingDate: '2009',
    email: 'info@avanamedical.com',
    telephone: '+91-44-2233-1061',
    address: {
      '@type': 'PostalAddress', streetAddress: 'No. 91, Sundar Nagar 4th Avenue, Nandambakkam',
      addressLocality: 'Chennai', postalCode: '600032', addressRegion: 'Tamil Nadu', addressCountry: 'IN'
    },
    sameAs: ['https://www.linkedin.com/company/avana-medical/', 'https://www.facebook.com/AvanaMedical',
      'https://www.instagram.com/avanamedical', 'https://twitter.com/AvanaPvt']
  }).replace(/</g, '\\u003c');
}

// Fills in <title>, description, canonical address, link-preview tags and (home page) company details.
// opts.route: which section the address opens; opts.siteUrl: e.g. https://avanamedical.com
function seoHead(html, { route, siteUrl }) {
  const p = PAGES[route] || PAGES.home;
  const url = siteUrl + p.path;
  const tags = `<base href="/">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Avana Medical Devices">
  <meta property="og:locale" content="en_IN">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(siteUrl)}/images/share/avana-share.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">${route === 'home' ? `
  <script type="application/ld+json">${organizationJsonLd(siteUrl)}</script>` : ''}`;
  return html
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(p.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${esc(p.description)}">\n  ${tags}`)
    .replace(/<body([^>]*)>/i, `<body$1 data-route="${route}" data-pages="${esc(clientMap())}">`);
}

function sitemapXml(siteUrl) {
  const urls = Object.values(PAGES).filter(p => !p.private).map(p => `  <url><loc>${esc(siteUrl + p.path)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const PUBLIC_PATHS = Object.values(PAGES).filter(p => !p.private).map(p => p.path);

module.exports = { PUBLIC_PATHS, PAGES, byPath, REDIRECTS, GONE, seoHead, sitemapXml };
