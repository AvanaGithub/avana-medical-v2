// Avana Medical website server.
//   /            the website (News & Events filled from the database)
//   /admin       the admin panel
//   /api/...     JSON API used by the admin panel
// Only the public folders are served; server code, the database, .git and docs are never reachable.
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { renderIndex } = require('./render');
const api = require('./api');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');          // behind nginx on the same server

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  if (config.noindex) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

const pages = require('./pages');
const siteUrlOf = req => config.siteUrl || `${req.protocol}://${req.get('host')}`;

// Test sites tell search engines to stay away; the real site allows them (but never /admin, /api or personal links)
app.get('/robots.txt', (req, res) => {
  res.type('text').send(config.noindex
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /job\nDisallow: /openings\n\nSitemap: ${siteUrlOf(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(pages.sitemapXml(siteUrlOf(req))));
app.use(cookieParser());

/* ---------- website ---------- */

// Old addresses and missing trailing slashes → the page's real address; WordPress leftovers → 410 Gone
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const p = req.path;
  const qs = req.originalUrl.slice(req.path.length);
  if (pages.GONE.test(p)) return res.status(410).type('text').send('This page has been removed.');
  const slash = p.endsWith('/') ? p : p + '/';
  const to = pages.REDIRECTS[p] || pages.REDIRECTS[slash] || (p !== slash && pages.byPath[slash] ? slash : null);
  if (to) return res.redirect(301, to + qs);
  next();
});

// Every section of the site has its own address; each serves the same page with that section open
app.get(pages.PUBLIC_PATHS, (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(renderIndex({ route: pages.byPath[req.path], siteUrl: siteUrlOf(req) }));
  } catch (e) { next(e); }
});

// The openings page (/job), from the personal link we email: the jobs in two groups, each with details and Apply.
// The link is private, so the page is never cached, indexed or passed on to other sites.
const leads = require('./leads');
app.get(['/job', '/job/'], (req, res, next) => {
  try {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    const token = String(req.query.t || '');
    const lead = leads.findByToken(token);
    if (lead) leads.recordVisit(lead.id);
    const base = { route: 'jobs', siteUrl: siteUrlOf(req) };
    res.type('html').send(renderIndex(Object.assign(base, lead ? { lead, token } : { expired: true })));
  } catch (e) { next(e); }
});
// Links sent before the page moved to /job
app.get('/openings', (req, res) => res.redirect(301, '/job' + req.originalUrl.slice(req.path.length)));

// Job pages used to be public; the openings are now only on the emailed link
app.get('/jobs/:slug', (req, res) => res.redirect(301, '/careers/'));

const day = 24 * 3600e3;
const pub = (dir, maxAge) => express.static(path.join(config.siteRoot, dir), { maxAge, index: false, dotfiles: 'deny' });
app.use('/css', pub('css', 0));             // always re-checked (cheap with ETags) so an update never mixes old and new files
app.use('/js', pub('js', 0));
app.use('/images', pub('images', 7 * day));
app.use('/videos', pub('videos', 7 * day));
// Browsers and search engines also look for the icon at the site root
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(config.siteRoot, 'images', 'icons', 'favicon.ico'), { maxAge: 7 * day }));
app.use('/uploads', express.static(config.uploadsDir, { maxAge: 30 * day, index: false, dotfiles: 'deny', immutable: true }));

/* ---------- admin panel ---------- */

app.use('/admin/vendor/cropper', express.static(path.join(__dirname, '..', 'node_modules', 'cropperjs', 'dist'), { maxAge: 7 * day }));
app.get(['/admin', '/admin/'], (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  res.sendFile(path.join(config.siteRoot, 'admin', 'index.html'));
});
app.use('/admin', express.static(path.join(config.siteRoot, 'admin'), { index: false, dotfiles: 'deny', setHeaders: res => res.set('Cache-Control', 'no-cache') }));

app.use('/api', api);

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).type('text').send('Not found'));
app.use((err, req, res, next) => {
  console.error(new Date().toISOString(), err);
  res.status(500).type('text').send('Something went wrong.');
});

if (require.main === module) {
  app.listen(config.port, '127.0.0.1', () => console.log(`Avana Medical site on http://localhost:${config.port}`));
}
module.exports = app;
