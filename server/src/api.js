// JSON API for the admin panel (/api/...). Everything except sign-in needs a session.
const express = require('express');
const multer = require('multer');
const { db, audit } = require('./db');
const auth = require('./auth');
const events = require('./events');
const images = require('./images');
const jobs = require('./jobs');
const apps = require('./applications');

const router = express.Router();
router.use(express.json({ limit: '100kb' }));
router.use(auth.requireAjax);

const ok = (res, data) => res.json(data || { ok: true });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const int = v => (/^\d+$/.test(String(v)) ? Number(v) : NaN);

/* ---------- sign in / out ---------- */

router.post('/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const key = email + '|' + req.ip;
  if (auth.loginLimited(key)) return bad(res, 'Too many attempts. Wait 15 minutes and try again.', 429);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.active || !auth.checkPassword(password, user.password_hash)) {
    auth.loginFailed(key);
    return bad(res, 'Email or password is incorrect.', 401);
  }
  auth.loginSucceeded(key);
  auth.createSession(res, user.id);
  audit(user.id, 'login', 'user', user.id);
  ok(res, { user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/auth/logout', (req, res) => { auth.destroySession(req, res); ok(res); });

router.get('/auth/me', auth.requireUser, (req, res) => ok(res, { user: req.user }));

router.post('/auth/password', auth.requireUser, (req, res) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!auth.checkPassword(String(req.body.current || ''), row.password_hash)) return bad(res, 'Your current password is incorrect.');
  const problem = auth.passwordProblem(req.body.password);
  if (problem) return bad(res, problem);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(req.body.password), req.user.id);
  audit(req.user.id, 'change_password', 'user', req.user.id);
  ok(res);
});

/* ---------- public: apply for a job ---------- */

const cvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: apps.CV_MAX, files: 1, fields: 30 } });
const applyLog = new Map();   // IP → timestamps, max 6 applications per hour
router.post('/apply/:slug', (req, res) => {
  const now = Date.now();
  const recent = (applyLog.get(req.ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 6) return bad(res, 'Too many applications from your connection. Please try again in an hour.', 429);
  cvUpload.single('cv')(req, res, err => {
    if (err) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'Your CV must be smaller than 5 MB.' : 'Upload failed. Please try again.');
    const job = jobs.getBySlug(String(req.params.slug));
    if (!jobs.isLive(job)) return bad(res, 'This position is no longer accepting applications.', 410);
    if (req.body.website) return ok(res);                       // hidden "honeypot" field: bots fill it, people don't
    const v = apps.validate(req.body);
    if (v.error) return res.status(400).json({ error: v.error, field: v.field });
    if (!req.file) return res.status(400).json({ error: 'Attach your CV (PDF or Word, up to 5 MB).', field: 'cv' });
    const cv = apps.saveCv(req.file.buffer, req.file.originalname);
    if (cv.error) return res.status(400).json({ error: cv.error, field: 'cv' });
    apps.create(job, v.value, cv);
    recent.push(now); applyLog.set(req.ip, recent);
    ok(res, { ok: true, job: job.title });
  });
});

/* ---------- events ---------- */

router.use('/admin', auth.requireUser);

router.get('/admin/events', (req, res) => ok(res, { events: events.list().map(e => Object.assign(e, { when: events.whenLabel(e) })) }));

router.post('/admin/events', (req, res) => {
  const r = events.validate(req.body);
  if (r.error) return bad(res, r.error);
  const e = events.create(r.value, req.user.id);
  audit(req.user.id, 'create', 'event', e.id, { title: e.title });
  ok(res, { event: e });
});

router.put('/admin/events/:id', (req, res) => {
  const id = int(req.params.id);
  const before = events.get(id);
  if (!before) return bad(res, 'That event no longer exists.', 404);
  const r = events.validate(req.body, before);
  if (r.error) return bad(res, r.error);
  const e = events.update(id, r.value, req.user.id);
  if (before.image !== e.image) { images.deleteUploaded(before.image); images.deleteUploaded(before.image_small); }
  audit(req.user.id, 'update', 'event', id, { title: e.title });
  ok(res, { event: e });
});

router.delete('/admin/events/:id', (req, res) => {
  const id = int(req.params.id);
  const e = events.get(id);
  if (!e) return bad(res, 'That event no longer exists.', 404);
  events.remove(id);
  images.deleteUploaded(e.image); images.deleteUploaded(e.image_small);
  audit(req.user.id, 'delete', 'event', id, { title: e.title });
  ok(res);
});

router.post('/admin/events/reorder', (req, res) => {
  const { section, ids } = req.body || {};
  if (!['upcoming', 'past'].includes(section) || !Array.isArray(ids) || !ids.every(i => Number.isInteger(i))) return bad(res, 'Invalid order.');
  events.reorder(section, ids);
  audit(req.user.id, 'reorder', 'event', null, { section });
  ok(res);
});

/* ---------- image upload (cropped to 16:10 on the server) ---------- */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: images.MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, images.ALLOWED.includes(file.mimetype))
});

router.post('/admin/uploads', (req, res) => {
  upload.single('image')(req, res, async err => {
    if (err) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'That image is larger than 20 MB.' : 'Upload failed.');
    if (!req.file) return bad(res, 'Choose a JPG, PNG or WebP image.');
    let crop = null;
    try { crop = req.body.crop ? JSON.parse(req.body.crop) : null; } catch (e) { /* use centre crop */ }
    try {
      const saved = await images.saveEventImage(req.file.buffer, crop);
      audit(req.user.id, 'upload', 'image', null, { path: saved.image });
      ok(res, saved);
    } catch (e) {
      bad(res, e.message && e.message.startsWith('That') ? e.message : 'That file could not be read as an image.');
    }
  });
});

/* ---------- jobs ---------- */

router.get('/admin/jobs', (req, res) => ok(res, {
  jobs: jobs.listAdmin().map(j => Object.assign(j, { experience: jobs.experienceLabel(j), live: jobs.isLive(j) })),
  options: jobs.OPTIONS,
  applications: apps.counts()
}));

router.post('/admin/jobs', (req, res) => {
  const r = jobs.validate(req.body);
  if (r.error) return bad(res, r.error);
  const j = jobs.create(r.value, req.user.id);
  audit(req.user.id, 'create', 'job', j.id, { title: j.title, status: j.status });
  ok(res, { job: j });
});

router.put('/admin/jobs/:id', (req, res) => {
  const id = int(req.params.id);
  const before = jobs.get(id);
  if (!before) return bad(res, 'That job no longer exists.', 404);
  const r = jobs.validate(req.body, before);
  if (r.error) return bad(res, r.error);
  const j = jobs.update(id, r.value, req.user.id);
  audit(req.user.id, 'update', 'job', id, { title: j.title, status: j.status });
  ok(res, { job: j });
});

router.post('/admin/jobs/:id/duplicate', (req, res) => {
  const src = jobs.get(int(req.params.id));
  if (!src) return bad(res, 'That job no longer exists.', 404);
  const copy = Object.assign({}, src, { title: src.title + ' (copy)', status: 'draft', posted_at: null, closes_at: null });
  delete copy.id;
  const j = jobs.create(jobs.validate(copy).value, req.user.id);
  audit(req.user.id, 'duplicate', 'job', j.id, { from: src.id });
  ok(res, { job: j });
});

router.post('/admin/jobs/reorder', (req, res) => {
  const ids = req.body && req.body.ids;
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) return bad(res, 'Invalid order.');
  jobs.reorder(ids);
  ok(res);
});

router.delete('/admin/jobs/:id', (req, res) => {
  const id = int(req.params.id);
  const j = jobs.get(id);
  if (!j) return bad(res, 'That job no longer exists.', 404);
  jobs.remove(id);                         // applications stay, keeping the job title
  audit(req.user.id, 'delete', 'job', id, { title: j.title });
  ok(res);
});

/* ---------- applications ---------- */

router.get('/admin/applications', (req, res) => {
  const status = apps_status(req.query.status);
  ok(res, { applications: apps.list({ jobId: int(req.query.job) || null, status }), notice: apps.NOTICE });
});
const apps_status = s => (jobs.OPTIONS.application_status.includes(s) ? s : null);

router.put('/admin/applications/:id', (req, res) => {
  const id = int(req.params.id);
  if (!apps.get(id)) return bad(res, 'That application no longer exists.', 404);
  if (req.body.status !== undefined && !apps_status(req.body.status)) return bad(res, 'Choose a valid status.');
  if (req.body.notes !== undefined && String(req.body.notes).length > 4000) return bad(res, 'Notes are too long.');
  const a = apps.update(id, { status: req.body.status, notes: req.body.notes !== undefined ? String(req.body.notes) : undefined }, req.user.id);
  audit(req.user.id, 'update', 'application', id, { status: a.status });
  ok(res, { application: a });
});

router.delete('/admin/applications/:id', (req, res) => {
  const id = int(req.params.id);
  const a = apps.get(id);
  if (!a) return bad(res, 'That application no longer exists.', 404);
  apps.remove(id);
  audit(req.user.id, 'delete', 'application', id, { job: a.job_title });
  ok(res);
});

router.get('/admin/applications/:id/cv', (req, res) => {
  const a = apps.get(int(req.params.id));
  const p = a && apps.cvPath(a.cv_file);
  if (!p || !require('fs').existsSync(p)) return bad(res, 'CV not found.', 404);
  audit(req.user.id, 'download_cv', 'application', a.id);
  res.set('Cache-Control', 'no-store');
  res.download(p, `${a.name.replace(/[^\w ]/g, '').trim() || 'candidate'} - CV${require('path').extname(a.cv_file)}`);
});

/* ---------- users (admins only) ---------- */

router.get('/admin/users', auth.requireAdmin, (req, res) => {
  ok(res, { users: db.prepare('SELECT id, email, name, role, active, created_at, last_login_at FROM users ORDER BY name').all() });
});

router.post('/admin/users', auth.requireAdmin, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  const role = req.body.role === 'admin' ? 'admin' : 'editor';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address.');
  if (!name || name.length > 80) return bad(res, 'Enter a name (up to 80 characters).');
  const problem = auth.passwordProblem(req.body.password);
  if (problem) return bad(res, 'Temporary password: ' + problem.toLowerCase());
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return bad(res, 'Someone with that email already has an account.');
  const info = db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?,?,?,?)')
    .run(email, name, role, auth.hashPassword(req.body.password));
  audit(req.user.id, 'create', 'user', info.lastInsertRowid, { email, role });
  ok(res, { id: info.lastInsertRowid });
});

router.put('/admin/users/:id', auth.requireAdmin, (req, res) => {
  const id = int(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return bad(res, 'That user no longer exists.', 404);
  const name = req.body.name !== undefined ? String(req.body.name).trim() : u.name;
  const role = req.body.role !== undefined ? (req.body.role === 'admin' ? 'admin' : 'editor') : u.role;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : u.active;
  if (!name || name.length > 80) return bad(res, 'Enter a name (up to 80 characters).');
  if (id === req.user.id && (role !== 'admin' || !active)) return bad(res, "You can't remove your own admin access. Ask another admin.");
  if (u.role === 'admin' && (role !== 'admin' || !active)) {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND active = 1").get().c;
    if (admins <= 1) return bad(res, 'There must always be at least one active admin.');
  }
  db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(name, role, active, id);
  if (req.body.password) {
    const problem = auth.passwordProblem(req.body.password);
    if (problem) return bad(res, 'New password: ' + problem.toLowerCase());
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(req.body.password), id);
  }
  if (!active || req.body.password) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);   // sign them out everywhere
  audit(req.user.id, 'update', 'user', id, { role, active: !!active, passwordReset: !!req.body.password });
  ok(res);
});

router.use((req, res) => bad(res, 'Not found.', 404));

module.exports = router;
