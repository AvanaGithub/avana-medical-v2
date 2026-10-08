// Sessions and access control for /api/admin.
// - Passwords: bcrypt. Session tokens: random 32 bytes, only their SHA-256 hash is stored.
// - Cookie is HttpOnly + SameSite=Lax (+ Secure in production).
// - Every changing request must send the X-Requested-With header, which a cross-site form cannot.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('./db');
const config = require('./config');

const COOKIE = 'am_sess';
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.sessionHours * 3600e3);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)')
    .run(sha256(token), userId, expires.toISOString());
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires, path: '/' });
}

function destroySession(req, res) {
  const token = req.cookies && req.cookies[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

function currentUser(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND u.active = 1`).get(sha256(token));
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

// Blocks cross-site form posts: browsers only let same-origin scripts set this header.
function requireAjax(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') return res.status(403).json({ error: 'Request blocked.' });
  next();
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can manage users.' });
  next();
}

// Simple in-memory limiter: 8 failed sign-ins per email+IP per 15 minutes.
const failures = new Map();
function loginLimited(key) {
  const now = Date.now();
  const list = (failures.get(key) || []).filter(t => now - t < 15 * 60e3);
  failures.set(key, list);
  return list.length >= 8;
}
function loginFailed(key) { (failures.get(key) || failures.set(key, []).get(key)).push(Date.now()); }
function loginSucceeded(key) { failures.delete(key); }

const hashPassword = pw => bcrypt.hashSync(pw, 12);
const checkPassword = (pw, hash) => bcrypt.compareSync(pw, hash);

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Use at least 10 characters.';
  if (pw.length > 200) return 'That password is too long.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use a mix of letters and numbers.';
  return null;
}

module.exports = {
  createSession, destroySession, currentUser, requireAjax, requireUser, requireAdmin,
  loginLimited, loginFailed, loginSucceeded, hashPassword, checkPassword, passwordProblem
};
