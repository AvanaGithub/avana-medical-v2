// "See open positions" requests: a job seeker gives their full profile and CV once and gets a personal link to the
// current openings by email. The link (/job?t=<token>) is the only way to see and apply for jobs; applying reuses the
// saved profile and CV, so it is one click. Only a SHA-256 hash of each token is stored, so the database alone can't
// be used to open anyone's link.
const fs = require('fs');
const crypto = require('crypto');
const { db } = require('./db');
const config = require('./config');
const jobs = require('./jobs');
const apps = require('./applications');
const mailer = require('./mailer');

const MARITAL = ['Single', 'Married', 'Prefer not to say'];
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const sqlTime = d => d.toISOString().slice(0, 19).replace('T', ' ');
const yes = v => v === true || v === 'yes' || v === 'on' || v === 'true';

// The request form: who they are (age, marital status, education, why Avana) plus the same profile an
// application needs (phone, city, experience, CTC, notice period, employer, LinkedIn). The CV is checked separately.
function validate(b) {
  const l = {
    name: str(b.name, 80), email: str(b.email, 120).toLowerCase(), age: Number(b.age),
    marital_status: str(b.marital_status, 30), education: str(b.education, 120), why_join: str(b.why_join, 600)
  };
  if (l.name.length < 2) return { error: 'Please enter your full name.', field: 'name' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(l.email)) return { error: 'Please enter a valid email address, like name@example.com.', field: 'email' };
  if (!/^\d{2}$/.test(String(b.age ?? '').trim()) || l.age < 18 || l.age > 65) return { error: 'Please enter your age in years, between 18 and 65.', field: 'age' };
  if (!MARITAL.includes(l.marital_status)) return { error: 'Please choose your marital status.', field: 'marital_status' };
  if (l.education.length < 2) return { error: 'Please enter your highest qualification.', field: 'education' };
  if (l.education.length > 120) return { error: 'Please keep your qualification under 120 characters.', field: 'education' };
  const p = apps.validate(Object.assign({}, b, { qualification: l.education, cover_note: '' }));
  if (p.error) return p;
  // work experience can't start before about age 15
  if (p.value.total_exp > l.age - 15) return { error: `At age ${l.age}, total experience can be at most ${l.age - 15} years.`, field: 'total_exp' };
  if (!yes(b.truthful)) return { error: 'Please confirm that your details are truthful to continue.', field: 'truthful' };
  const { phone, city, total_exp, current_ctc, expected_ctc, notice_period, current_employer, current_role, linkedin } = p.value;
  return { value: Object.assign(l, { phone, city, total_exp, current_ctc, expected_ctc, notice_period, current_employer, current_role, linkedin }) };
}

function newToken(id) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expires = sqlTime(new Date(Date.now() + config.openingsLinkDays * 864e5));
  db.prepare("UPDATE job_leads SET token_hash = ?, expires_at = ?, updated_at = datetime('now') WHERE id = ?").run(hash(token), expires, id);
  return token;
}

const PROFILE = ['name', 'age', 'marital_status', 'education', 'why_join', 'phone', 'city', 'total_exp', 'current_ctc', 'expected_ctc',
  'notice_period', 'current_employer', 'current_role', 'linkedin'];

function dropCv(file) { const p = file && apps.cvPath(file); if (p) fs.rm(p, { force: true }, () => {}); }

// Saves the request with its CV ({ file, name } from apps.saveCv). One row per email address: asking again
// updates the profile and replaces the CV. Returns { lead, token }.
function save(l, cv) {
  const old = db.prepare('SELECT id, cv_file FROM job_leads WHERE email = ?').get(l.email);
  const row = Object.assign({}, l, { cv_file: cv.file, cv_name: cv.name });
  let id;
  if (old) {
    id = old.id;
    db.prepare(`UPDATE job_leads SET ${PROFILE.map(k => `${k} = @${k}`).join(', ')}, cv_file = @cv_file, cv_name = @cv_name,
      requests = requests + 1, consent_at = datetime('now'), updated_at = datetime('now') WHERE id = @id`).run(Object.assign({ id }, row));
    if (old.cv_file !== cv.file) dropCv(old.cv_file);
  } else {
    id = db.prepare(`INSERT INTO job_leads (email, ${PROFILE.join(', ')}, cv_file, cv_name, token_hash, expires_at, consent_at)
      VALUES (@email, ${PROFILE.map(k => '@' + k).join(', ')}, @cv_file, @cv_name, @tmp, datetime('now'), datetime('now'))`)
      .run(Object.assign({ tmp: 'new-' + crypto.randomBytes(8).toString('hex') }, row)).lastInsertRowid;
  }
  return { lead: get(id), token: newToken(id) };
}

// A replacement CV given while applying becomes their CV from then on
function replaceCv(lead, cv) {
  db.prepare("UPDATE job_leads SET cv_file = ?, cv_name = ?, updated_at = datetime('now') WHERE id = ?").run(cv.file, cv.name, lead.id);
  dropCv(lead.cv_file);
  return get(lead.id);
}

// An application built from the saved profile. The CV is copied, so the application keeps it even if the
// request is later deleted or the CV replaced. Returns { id } or { error, code, field? }.
function apply(lead, job, coverNote) {
  if (db.prepare('SELECT 1 FROM applications WHERE lead_id = ? AND job_id = ?').get(lead.id, job.id)) {
    return { error: 'You have already applied for this position. Our HR team will contact you if your profile matches.', code: 409 };
  }
  const src = apps.cvPath(lead.cv_file);
  if (!src || !fs.existsSync(src)) return { error: 'Please attach your CV (PDF or Word, up to 5 MB).', code: 400, field: 'cv' };
  const copy = apps.saveCv(fs.readFileSync(src), lead.cv_name);
  const a = {
    name: lead.name, email: lead.email, phone: lead.phone, city: lead.city, total_exp: lead.total_exp, current_ctc: lead.current_ctc,
    expected_ctc: lead.expected_ctc, notice_period: lead.notice_period, current_employer: lead.current_employer,
    current_role: lead.current_role, qualification: lead.education, linkedin: lead.linkedin, cover_note: str(coverNote, 1500)
  };
  return { id: apps.create(job, a, copy, lead.id) };
}

const appliedJobIds = leadId => db.prepare('SELECT job_id FROM applications WHERE lead_id = ? AND job_id IS NOT NULL').all(leadId).map(r => r.job_id);

const get = id => db.prepare('SELECT * FROM job_leads WHERE id = ?').get(id);

// The lead a link belongs to, or null if the link is unknown or expired
function findByToken(token) {
  if (!/^[\w-]{20,64}$/.test(String(token || ''))) return null;
  const l = db.prepare("SELECT * FROM job_leads WHERE token_hash = ? AND expires_at > datetime('now')").get(hash(token));
  return l || null;
}

function recordVisit(id) {
  db.prepare("UPDATE job_leads SET visits = visits + 1, last_visit_at = datetime('now') WHERE id = ?").run(id);
}

function list() {
  return db.prepare(`
    SELECT l.id, l.name, l.email, l.age, l.marital_status, l.education, l.why_join, l.phone, l.city, l.total_exp, l.current_ctc,
      l.expected_ctc, l.notice_period, l.current_employer, l.current_role, l.linkedin, l.cv_name, l.cv_file != '' AS has_cv,
      l.expires_at, l.requests, l.email_status, l.email_error, l.emailed_at, l.visits, l.last_visit_at, l.created_at, l.updated_at,
      l.expires_at > datetime('now') AS link_active,
      (SELECT COUNT(*) FROM applications a WHERE a.lead_id = l.id) AS applications
    FROM job_leads l ORDER BY l.updated_at DESC, l.id DESC`).all();
}

function remove(id) {
  const l = get(id);
  db.prepare('DELETE FROM job_leads WHERE id = ?').run(id);
  if (l) dropCv(l.cv_file);                 // applications keep their own copy
}

const counts = () => db.prepare("SELECT COUNT(*) total, SUM(created_at > datetime('now','-7 days')) week FROM job_leads").get();

/* ---------- the email ---------- */

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstName = n => String(n).trim().split(/\s+/)[0];

// No list or count of jobs in the email: "View jobs" opens the /job page, which shows every opening in its two groups.
function openingsEmail(lead, url) {
  const days = config.openingsLinkDays;
  const closer = 'You’re one step closer to joining the Avana family';
  const subject = closer;

  const text = [
    `Hi ${firstName(lead.name)},`, '',
    'Thank you for your interest in joining Avana Medical Devices.', '',
    `View our current openings and apply online: ${url}`, '',
    `This link is personal to you and works for ${days} days. Please don't forward it.`,
    'You received this email because you asked for our openings on avanamedical.com. If that wasn\'t you, you can ignore it.', '',
    'Avana Medical Devices Pvt. Ltd. · Chennai, India'
  ].join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F3EFE5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EFE5"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-top:4px solid #B27F0D">
      <tr><td style="background:#172025;padding:26px 32px">
        <div style="font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#D19A1E">Careers at Avana</div>
        <div style="font:800 26px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;margin-top:10px">${esc(closer)}</div>
      </td></tr>
      <tr><td style="padding:28px 32px 8px;font:16px/1.6 Arial,Helvetica,sans-serif;color:#2E3538">
        <p style="margin:0 0 14px">Hi ${esc(firstName(lead.name))},</p>
        <p style="margin:0 0 14px">Thank you for your interest in joining Avana Medical Devices. Click the button below to see our current openings, with the full details of each role, and apply online.</p>
      </td></tr>
      <tr><td style="padding:14px 32px 8px">
        <a href="${esc(url)}" style="display:inline-block;background:#B27F0D;color:#ffffff;font:700 15px/1 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:16px 26px">View jobs</a>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;font:13px/1.6 Arial,Helvetica,sans-serif;color:#6B7275">
        This link is personal to you and works for ${days} days. Please don't forward it.<br>
        You received this email because you asked for our openings on avanamedical.com. If that wasn't you, you can ignore it.
      </td></tr>
      <tr><td style="background:#172025;padding:16px 32px;font:12px/1.6 Arial,Helvetica,sans-serif;color:#AAB2B2">
        Avana Medical Devices Pvt. Ltd. · Chennai, India · <a href="mailto:${esc(config.mail.replyTo)}" style="color:#D19A1E">${esc(config.mail.replyTo)}</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, text, html };
}

const linkFor = (siteUrl, token) => `${siteUrl}/job?t=${token}`;

// Emails the openings link and records how it went. Returns the mailer result.
async function sendLink(lead, token, siteUrl) {
  const mail = openingsEmail(lead, linkFor(siteUrl, token));
  const r = await mailer.send(Object.assign({ to: lead.email }, mail));
  db.prepare(`UPDATE job_leads SET email_status = ?, email_error = ?, emailed_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE emailed_at END
    WHERE id = ?`).run(r.status, r.error || '', r.status, lead.id);
  return r;
}

// Optional heads-up to HR (HR_NOTIFY_EMAIL). Fire and forget.
function notifyHr(lead, siteUrl) {
  if (!config.mail.hrNotify) return;
  const text = [`New request for current openings from the website:`, '',
    `Name: ${lead.name}`, `Email: ${lead.email}`, `Age: ${lead.age}`, `Marital status: ${lead.marital_status}`,
    `Education: ${lead.education}`, `Why Avana: ${lead.why_join || '-'}`, '', `See all requests: ${siteUrl}/admin`].join('\n');
  mailer.send({ to: config.mail.hrNotify, subject: `Openings request: ${lead.name}`, text }).catch(() => {});
}

// Heads-up for HR each time someone applies (APPLICATION_NOTIFY_EMAIL, copied to APPLICATION_NOTIFY_CC). Fire and forget; the CV stays in the admin panel.
function notifyApplication(lead, job, coverNote, siteUrl) {
  if (!config.mail.applicationNotify) return;
  const lpa = n => (n === null || n === undefined ? '-' : n + ' LPA');
  const link = `${siteUrl}/admin/#applications`;
  const rows = [
    ['Position', `${job.title} (${job.ref_code})`], ['Name', lead.name], ['Email', lead.email], ['Mobile', lead.phone],
    ['City', lead.city], ['Experience', lead.total_exp === null ? '-' : lead.total_exp + ' years'],
    ['Current employer', [lead.current_role, lead.current_employer].filter(Boolean).join(', ') || '-'],
    ['CTC now → expected', `${lpa(lead.current_ctc)} → ${lpa(lead.expected_ctc)}`], ['Notice period', lead.notice_period || '-'],
    ['Education', lead.education], ['Note', String(coverNote || '').trim() || '-']
  ];
  const subject = `New application: ${job.title} – ${lead.name}`;
  const text = ['A new job application has been received on the website.', '',
    ...rows.map(([k, v]) => `${k}: ${v}`), '', `Review it and download the CV in the admin panel: ${link}`].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#F3EFE5;font:15px/1.6 Arial,Helvetica,sans-serif;color:#2E3538">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-top:4px solid #B27F0D">
    <tr><td style="padding:22px 28px;background:#172025;color:#fff;font:800 20px/1.3 Arial,Helvetica,sans-serif">New application received</td></tr>
    <tr><td style="padding:20px 28px 6px">${esc(lead.name)} applied for <b>${esc(job.title)}</b>.</td></tr>
    <tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map(([k, v]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#6B7275;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`).join('')}</table></td></tr>
    <tr><td style="padding:20px 28px 26px"><a href="${esc(link)}" style="display:inline-block;background:#B27F0D;color:#fff;font:700 14px/1 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 22px">Open in the admin panel</a></td></tr>
  </table></body></html>`;
  mailer.send({ to: config.mail.applicationNotify, cc: config.mail.applicationNotifyCc, subject, text, html }).catch(() => {});
}

module.exports = { validate, save, replaceCv, apply, appliedJobIds, get, newToken, findByToken, recordVisit, list, remove, counts, sendLink, notifyHr, notifyApplication, openingsEmail, linkFor, MARITAL };
