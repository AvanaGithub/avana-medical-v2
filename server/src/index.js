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
  next();
});
app.use(cookieParser());

/* ---------- website ---------- */

app.get(['/', '/index.html'], (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(renderIndex());
  } catch (e) { next(e); }
});

// A job's own page: the Careers page with that job open, plus Google Jobs data
const jobs = require('./jobs');
app.get('/jobs/:slug', (req, res, next) => {
  try {
    const job = jobs.getBySlug(String(req.params.slug));
    if (!jobs.isLive(job)) return res.redirect(302, '/#careers');
    const siteUrl = config.siteUrl || `${req.protocol}://${req.get('host')}`;
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(renderIndex({ job, siteUrl }));
  } catch (e) { next(e); }
});

const day = 24 * 3600e3;
const pub = (dir, maxAge) => express.static(path.join(config.siteRoot, dir), { maxAge, index: false, dotfiles: 'deny' });
app.use('/css', pub('css', 3600e3));
app.use('/js', pub('js', 3600e3));
app.use('/images', pub('images', 7 * day));
app.use('/videos', pub('videos', 7 * day));
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
