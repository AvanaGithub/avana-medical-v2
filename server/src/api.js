// JSON API for the admin panel (/api/...). Everything except sign-in needs a session.
const express = require('express');
const multer = require('multer');
const { db, audit } = require('./db');
const auth = require('./auth');
const events = require('./events');
const images = require('./images');

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
