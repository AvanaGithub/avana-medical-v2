// Page addresses and search-engine tags: each section's own title and description, old-site redirects, sitemap.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avana-pages-'));
// Tests never send real email, whatever server/.env says: messages go to the outbox folder instead
process.env.SMTP_HOST = '';
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.SITE_URL = 'https://avanamedical.com';
const app = require('../src/index');
const { PAGES } = require('../src/pages');

let base, server;
test.before(async () => {
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

const get = (p, opts) => fetch(base + p, Object.assign({ redirect: 'manual' }, opts));
const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

test('every page has its own title, description, canonical address and preview tags', async () => {
  for (const [route, p] of Object.entries(PAGES)) {
    assert.ok(p.title.length <= 60, `${route}: title too long for search results`);
    assert.ok(p.description.length <= 160, `${route}: description too long for search results`);
    const res = await get(p.path);
    assert.strictEqual(res.status, 200, p.path);
    const html = await res.text();
    assert.strictEqual(decode(html.match(/<title>([^<]*)<\/title>/)[1]), p.title);
    const descs = html.match(/<meta name="description" content="([^"]*)">/g);
    assert.strictEqual(descs.length, 1, 'exactly one description');
    assert.strictEqual(decode(descs[0].match(/content="([^"]*)"/)[1]), p.description);
    assert.ok(html.includes(`<link rel="canonical" href="https://avanamedical.com${p.path}">`));
    assert.ok(html.includes(`<meta property="og:url" content="https://avanamedical.com${p.path}">`));
    assert.ok(html.includes('<base href="/">'));
    assert.ok(html.includes(`data-route="${route}"`));
    assert.strictEqual(html.includes('application/ld+json'), route === 'home', 'company details only on the home page');
  }
  assert.strictEqual(new Set(Object.values(PAGES).map(p => p.title)).size, Object.keys(PAGES).length, 'titles are unique');
});

test('old addresses redirect permanently; WordPress leftovers are gone', async () => {
  const cases = {
    '/about-us': '/about-us/', '/career/': '/careers/', '/gallary/': '/', '/news-events/': '/', '/products/': '/products/arthrex/',
    '/whats-new-at-arthrex/': '/products/arthrex/', '/find-a-doctor/': '/contact-us/', '/index.php': '/', '/index.html': '/',
    '/contact/?utm_source=x': '/contact-us/?utm_source=x', '/jobs/some-old-job': '/careers/',
    '/research-publications/': '/products/arthrex/', '/surgeon-education/': 'https://arthrolab.in/',
    '/knowledge-center/': 'https://www.youtube.com/@MargdarshanAvana', '/patient-education/': 'https://www.orthopedia.com/',
    '/privacy-policy': '/privacy-policy/'
  };
  for (const [from, to] of Object.entries(cases)) {
    const r = await get(from);
    assert.strictEqual(r.status, 301, from);
    assert.strictEqual(r.headers.get('location'), to, from);
  }
  for (const p of ['/filter-search/neha/', '/comments/feed/', '/wp-login.php', '/xmlrpc.php', '/wp-admin/']) {
    assert.strictEqual((await get(p)).status, 410, p);
  }
  assert.strictEqual((await get('/no-such-page/')).status, 404);
  assert.strictEqual((await get('/css/styles.css')).status, 200, 'files are not redirected');
});

test('sitemap lists every page; robots.txt points to it and keeps private areas out', async () => {
  const xml = await (await get('/sitemap.xml')).text();
  for (const p of Object.values(PAGES).filter(p => !p.private)) assert.ok(xml.includes(`<loc>https://avanamedical.com${p.path}</loc>`));
  const robots = await (await get('/robots.txt')).text();
  assert.match(robots, /Sitemap: https:\/\/avanamedical\.com\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/job/);
  assert.ok(!xml.includes('/job'), 'the private openings page is not in the sitemap');
});

test('ISO certificate: shown page by page for viewing, the PDF is not on the website', async () => {
  for (const p of [1, 2]) {
    const r = await get('/certificates/iso-13485/' + p);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers.get('content-type'), 'image/jpeg');
    assert.strictEqual(r.headers.get('content-disposition'), 'inline');
    assert.match(r.headers.get('cache-control'), /no-store/);
  }
  assert.strictEqual((await get('/certificates/iso-13485/3')).status, 404);
  assert.strictEqual((await get('/certificates/iso-13485/..%2F..%2Fdata')).status, 404);
  assert.strictEqual((await get('/images/certifications/Avana-ISO-13485-2016-Certificate.pdf')).status, 404);
  assert.strictEqual((await get('/server/private/certificates/iso-13485-page-1.jpg')).status, 404);
  const about = await (await get('/about-us/')).text();
  assert.ok(!about.includes('Certificate.pdf'));
});
