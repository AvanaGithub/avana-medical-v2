// Job applications: validation, CV storage (private folder, never served publicly) and queries.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db');
const config = require('./config');

const CV_DIR = path.join(config.dataDir, 'cv');
const CV_MAX = 5 * 1024 * 1024;
const NOTICE = ['Immediate', '15 days', '30 days', '60 days', '90 days', 'More than 90 days', 'Currently serving notice'];

// Recognise PDF / DOC / DOCX by their first bytes, not by the name the browser sent
function cvType(buf, name) {
  const ext = path.extname(name || '').toLowerCase();
  if (buf.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.slice(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) && ext === '.doc') return 'doc';
  if (buf.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && ext === '.docx') return 'docx';
  return null;
}

const num = v => { if (v === '' || v === undefined || v === null) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : NaN; };
const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Shared rules for the candidate forms (js/careers-request.js mirrors them so people see errors before sending)
const RULES = {
  NAME: /^\p{L}[\p{L}\p{M} .'-]*$/u,                                  // letters, spaces, . ' - (no digits or symbols)
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  LINKEDIN: /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/[\w%-]+\/?(\?\S*)?$/i
};
// Indian mobile: 10 digits starting 6–9, with or without +91 / 91 / 0 in front. Returns "+91 98765 43210" or null.
function indianMobile(v) {
  const d = String(v ?? '').replace(/[\s()-]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : null;
}
// A number with at most one decimal place, between min and max; null when empty, NaN when invalid
function decimal(v, min, max) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  if (!/^\d{1,3}(\.\d)?$/.test(s)) return NaN;
  const n = Number(s);
  return n >= min && n <= max ? n : NaN;
}

function validate(b) {
  const a = {
    name: str(b.name, 200).replace(/\s+/g, ' '), email: str(b.email, 200).toLowerCase(), phone: str(b.phone, 30), city: str(b.city, 200).replace(/\s+/g, ' '),
    total_exp: decimal(b.total_exp, 0, 50), current_ctc: decimal(b.current_ctc, 0, 500), expected_ctc: decimal(b.expected_ctc, 0, 500),
    notice_period: str(b.notice_period, 40), current_employer: str(b.current_employer, 100), current_role: str(b.current_role, 100),
    qualification: str(b.qualification, 120), linkedin: str(b.linkedin, 200), cover_note: str(b.cover_note, 1500)
  };
  if (a.name.length < 2 || a.name.length > 80 || !RULES.NAME.test(a.name)) return { error: 'Enter your full name using letters only (2–80 characters).', field: 'name' };
  if (a.email.length > 120 || !RULES.EMAIL.test(a.email)) return { error: 'Enter a valid email address, like name@example.com.', field: 'email' };
  const phone = indianMobile(a.phone);
  if (!phone) return { error: 'Enter a valid 10-digit Indian mobile number, like 98765 43210.', field: 'phone' };
  a.phone = phone;
  if (a.city.length < 2 || a.city.length > 60 || !RULES.NAME.test(a.city)) return { error: 'Enter your current city using letters only.', field: 'city' };
  if (a.total_exp === null || Number.isNaN(a.total_exp)) return { error: 'Enter your total experience in years, 0 to 50 (e.g. 4 or 4.5; 0 for freshers).', field: 'total_exp' };
  for (const k of ['current_ctc', 'expected_ctc']) {
    if (Number.isNaN(a[k])) return { error: 'Enter CTC in lakh per annum, 0 to 500 (e.g. 6.5).', field: k };
  }
  if (a.notice_period && !NOTICE.includes(a.notice_period)) return { error: 'Choose your notice period.', field: 'notice_period' };
  if (a.linkedin && !RULES.LINKEDIN.test(a.linkedin)) return { error: 'Enter your LinkedIn profile link, like https://www.linkedin.com/in/your-name', field: 'linkedin' };
  if (!(b.consent === 'yes' || b.consent === true || b.consent === 'on')) return { error: 'Please agree to the privacy notice so we can review your application.', field: 'consent' };
  return { value: a };
}

function saveCv(buf, originalName) {
  const type = cvType(buf, originalName);
  if (!type) return { error: 'Upload your CV as a PDF or Word file (.pdf, .doc, .docx).' };
  fs.mkdirSync(CV_DIR, { recursive: true });
  const file = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${type}`;
  fs.writeFileSync(path.join(CV_DIR, file), buf);
  return { file, name: path.basename(String(originalName || 'cv.' + type)).replace(/[^\w.\- ()]/g, '_').slice(0, 120) };
}

function cvPath(file) {
  if (!/^[\w-]+\.(pdf|doc|docx)$/.test(file)) return null;
  return path.join(CV_DIR, file);
}

function create(job, a, cv, leadId = null) {
  const info = db.prepare(`
    INSERT INTO applications (job_id, job_title, name, email, phone, city, total_exp, current_ctc, expected_ctc, notice_period,
      current_employer, current_role, qualification, linkedin, cover_note, cv_file, cv_name, lead_id, consent_at)
    VALUES (@job_id, @job_title, @name, @email, @phone, @city, @total_exp, @current_ctc, @expected_ctc, @notice_period,
      @current_employer, @current_role, @qualification, @linkedin, @cover_note, @cv_file, @cv_name, @lead_id, datetime('now'))`)
    .run(Object.assign({}, a, { job_id: job.id, job_title: job.title, cv_file: cv.file, cv_name: cv.name, lead_id: leadId }));
  return info.lastInsertRowid;
}

function list({ jobId, status } = {}) {
  const where = [], args = [];
  if (jobId) { where.push('a.job_id = ?'); args.push(jobId); }
  if (status) { where.push('a.status = ?'); args.push(status); }
  return db.prepare(`
    SELECT a.*, j.ref_code, u.name AS updated_by_name, l.age AS lead_age, l.marital_status AS lead_marital, l.education AS lead_education
    FROM applications a LEFT JOIN jobs j ON j.id = a.job_id LEFT JOIN users u ON u.id = a.updated_by LEFT JOIN job_leads l ON l.id = a.lead_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.created_at DESC, a.id DESC`).all(...args);
}

function get(id) { return db.prepare('SELECT * FROM applications WHERE id = ?').get(id); }

function update(id, { status, notes }, userId) {
  const a = get(id);
  db.prepare("UPDATE applications SET status = ?, notes = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?")
    .run(status ?? a.status, notes ?? a.notes, userId, id);
  return get(id);
}

function remove(id) {
  const a = get(id);
  if (!a) return;
  db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  const p = cvPath(a.cv_file);
  if (p) fs.rm(p, { force: true }, () => {});
}

const counts = () => db.prepare("SELECT COUNT(*) total, SUM(status = 'new') fresh FROM applications").get();

module.exports = { validate, saveCv, cvPath, create, list, get, update, remove, counts, NOTICE, CV_MAX };
