// Job board: field options, validation, queries and display formatting (Indian conventions: ₹ LPA, notice period).
const { db } = require('./db');

const OPTIONS = {
  employment_type: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'],
  work_mode: ['On-site', 'Hybrid', 'Remote', 'Field-based'],
  notice_period: ['', 'Immediate joiners', 'Up to 15 days', 'Up to 30 days', 'Up to 60 days', 'Up to 90 days', 'Any'],
  travel: ['', 'No travel', 'Occasional', 'Up to 25%', 'Up to 50%', 'Up to 75%', 'Extensive (field role)'],
  status: ['draft', 'open', 'closed'],
  // Suggestions only — admins can type any department
  departments: ['Sales', 'Marketing', 'Medical Education', 'Clinical Support', 'Product Specialist', 'Service & Technical',
    'Supply Chain & Logistics', 'Customer Service', 'Finance & Accounts', 'Human Resources', 'Administration', 'IT', 'Regulatory & Quality'],
  application_status: ['new', 'shortlisted', 'interview', 'offered', 'hired', 'rejected']
};

const TEXT_LIMITS = {
  title: 120, department: 60, role_category: 80, education: 200, reporting_to: 80,
  summary: 1200, responsibilities: 4000, requirements: 4000, preferred: 2000, benefits: 2000
};

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z'));
const today = () => new Date().toISOString().slice(0, 10);

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'job';
}

function uniqueSlug(base, exceptId) {
  let slug = base, n = 2;
  while (db.prepare('SELECT 1 FROM jobs WHERE slug = ? AND id IS NOT ?').get(slug, exceptId || null)) slug = `${base}-${n++}`;
  return slug;
}

function nextRefCode() {
  const yy = new Date().getFullYear().toString().slice(2);
  const row = db.prepare("SELECT ref_code FROM jobs WHERE ref_code LIKE ? ORDER BY id DESC LIMIT 1").get(`AMD-${yy}-%`);
  const n = row ? parseInt(row.ref_code.split('-')[2], 10) + 1 : 1;
  return `AMD-${yy}-${String(n).padStart(3, '0')}`;
}

// Locations are "City, State" so they are split by line (or ";"); skills and languages also split on commas
function cleanList(v, max, maxLen, splitter = /[\n,;]/) {
  const arr = Array.isArray(v) ? v : String(v || '').split(splitter);
  return [...new Set(arr.map(s => String(s).trim()).filter(Boolean))].slice(0, max).map(s => s.slice(0, maxLen));
}

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
}

// Returns { value } or { error } with a message for the admin
function validate(input, existing) {
  const j = Object.assign({}, existing || {});
  const has = k => input[k] !== undefined;

  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    if (has(k)) j[k] = String(input[k] ?? '').trim();
    if (j[k] === undefined || j[k] === null) j[k] = '';
    if (j[k].length > max) return { error: `${LABELS[k]} is too long (max ${max} characters).` };
  }
  if (!j.title) return { error: 'Add a job title.' };

  for (const k of ['employment_type', 'work_mode', 'notice_period', 'travel', 'status']) {
    if (has(k)) j[k] = String(input[k] ?? '');
    if (j[k] === undefined) j[k] = OPTIONS[k][0];
    if (!OPTIONS[k].includes(j[k])) return { error: `Choose a valid ${LABELS[k].toLowerCase()}.` };
  }

  if (has('locations')) j.locations = cleanList(input.locations, 15, 60, /[\n;]/);
  if (!Array.isArray(j.locations)) j.locations = JSON.parse(j.locations || '[]');
  if (has('skills')) j.skills = cleanList(input.skills, 25, 40);
  if (!Array.isArray(j.skills)) j.skills = JSON.parse(j.skills || '[]');
  if (has('languages')) j.languages = cleanList(input.languages, 10, 30);
  if (!Array.isArray(j.languages)) j.languages = JSON.parse(j.languages || '[]');

  for (const k of ['exp_min', 'exp_max', 'salary_min', 'salary_max']) {
    if (has(k)) j[k] = num(input[k]);
    if (j[k] === undefined) j[k] = null;
    if (Number.isNaN(j[k]) || (j[k] !== null && (j[k] < 0 || j[k] > (k.startsWith('exp') ? 50 : 500)))) return { error: `${LABELS[k]} must be a number.` };
  }
  if (j.exp_min !== null && j.exp_max !== null && j.exp_max < j.exp_min) return { error: 'Maximum experience is less than the minimum.' };
  if (j.salary_min !== null && j.salary_max !== null && j.salary_max < j.salary_min) return { error: 'Maximum salary is less than the minimum.' };

  if (has('openings')) j.openings = parseInt(input.openings, 10);
  if (j.openings === undefined) j.openings = 1;
  if (!Number.isInteger(j.openings) || j.openings < 1 || j.openings > 500) return { error: 'Number of openings must be between 1 and 500.' };

  for (const k of ['show_salary', 'two_wheeler']) {
    if (has(k)) j[k] = input[k] ? 1 : 0;
    if (j[k] === undefined) j[k] = 0;
  }

  for (const k of ['posted_at', 'closes_at']) {
    if (has(k)) j[k] = input[k] ? String(input[k]) : null;
    if (j[k] === undefined) j[k] = null;
    if (j[k] && !isDate(j[k])) return { error: `${LABELS[k]} is not a valid date.` };
  }

  if (j.status === 'open') {
    if (!j.department) return { error: 'Add a department before opening the job.' };
    if (!j.locations.length) return { error: 'Add at least one location before opening the job.' };
    if (!j.summary) return { error: 'Add a short job summary before opening the job.' };
    if (!j.posted_at) j.posted_at = today();
  }
  return { value: j };
}

const LABELS = {
  title: 'Job title', department: 'Department', role_category: 'Role category', education: 'Education',
  reporting_to: 'Reports to', summary: 'Summary', responsibilities: 'Responsibilities', requirements: 'Requirements',
  preferred: 'Good to have', benefits: 'Benefits', employment_type: 'Employment type', work_mode: 'Work mode',
  notice_period: 'Notice period', travel: 'Travel', status: 'Status', exp_min: 'Minimum experience',
  exp_max: 'Maximum experience', salary_min: 'Minimum salary', salary_max: 'Maximum salary',
  posted_at: 'Posted date', closes_at: 'Last date to apply'
};

const COLS = ['ref_code', 'slug', 'title', 'department', 'role_category', 'employment_type', 'work_mode', 'locations', 'openings',
  'exp_min', 'exp_max', 'salary_min', 'salary_max', 'show_salary', 'education', 'skills', 'languages', 'notice_period', 'travel',
  'two_wheeler', 'reporting_to', 'summary', 'responsibilities', 'requirements', 'preferred', 'benefits', 'status', 'posted_at',
  'closes_at', 'sort_order', 'updated_by'];

function toRow(j) {
  return Object.assign({}, j, {
    locations: JSON.stringify(j.locations || []), skills: JSON.stringify(j.skills || []), languages: JSON.stringify(j.languages || [])
  });
}
function fromRow(r) {
  if (!r) return r;
  return Object.assign({}, r, { locations: JSON.parse(r.locations), skills: JSON.parse(r.skills), languages: JSON.parse(r.languages) });
}

function get(id) { return fromRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)); }
function getBySlug(slug) { return fromRow(db.prepare('SELECT * FROM jobs WHERE slug = ?').get(slug)); }

// Open jobs whose last date hasn't passed — what the website shows
function listPublic() {
  return db.prepare("SELECT * FROM jobs WHERE status = 'open' AND (closes_at IS NULL OR closes_at >= ?) ORDER BY sort_order, posted_at DESC, id DESC")
    .all(today()).map(fromRow);
}
function isLive(j) { return j && j.status === 'open' && (!j.closes_at || j.closes_at >= today()); }

function listAdmin() {
  return db.prepare(`
    SELECT j.*, u.name AS updated_by_name,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'new') AS new_applicants
    FROM jobs j LEFT JOIN users u ON u.id = j.updated_by
    ORDER BY CASE j.status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, j.sort_order, j.id DESC`).all().map(fromRow);
}

function create(j, userId) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) m FROM jobs').get().m;
  const row = toRow(Object.assign({}, j, {
    slug: uniqueSlug(slugify(j.title)), ref_code: nextRefCode(), sort_order: max + 10, updated_by: userId || null
  }));
  const info = db.prepare(`INSERT INTO jobs (${COLS.join(',')}) VALUES (${COLS.map(c => '@' + c).join(',')})`).run(row);
  return get(info.lastInsertRowid);
}

function update(id, j, userId) {
  const before = get(id);
  // The link only changes while the job is still a draft, so shared links keep working
  const slug = before.status === 'draft' && before.title !== j.title ? uniqueSlug(slugify(j.title), id) : before.slug;
  const row = toRow(Object.assign({}, j, { slug, ref_code: before.ref_code, sort_order: before.sort_order, updated_by: userId || null }));
  db.prepare(`UPDATE jobs SET ${COLS.map(c => `${c}=@${c}`).join(',')}, updated_at=datetime('now') WHERE id=@id`).run(Object.assign(row, { id }));
  return get(id);
}

function reorder(ids) {
  db.transaction(() => ids.forEach((id, i) => db.prepare('UPDATE jobs SET sort_order = ? WHERE id = ?').run((i + 1) * 10, id)))();
}

function remove(id) { db.prepare('DELETE FROM jobs WHERE id = ?').run(id); }

/* ---------- display ---------- */

const fmtNum = n => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
function experienceLabel(j) {
  const a = j.exp_min, b = j.exp_max;
  if (a === null && b === null) return '';
  if (a === 0 && (b === null || b === 0)) return 'Freshers';
  if (b === null) return `${fmtNum(a)}+ yrs`;
  if (a === null || a === b) return `${fmtNum(b)} yrs`;
  return `${fmtNum(a)}–${fmtNum(b)} yrs`;
}
function salaryLabel(j) {
  if (!j.show_salary) return '';
  const a = j.salary_min, b = j.salary_max;
  if (a === null && b === null) return '';
  if (a !== null && b !== null && a !== b) return `₹${fmtNum(a)}–${fmtNum(b)} LPA`;
  return `₹${fmtNum(a ?? b)} LPA`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateLabel(s) { if (!isDate(s)) return ''; const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; }
function postedLabel(j) {
  if (!j.posted_at) return '';
  const days = Math.round((Date.parse(today()) - Date.parse(j.posted_at)) / 864e5);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  return 'Posted ' + dateLabel(j.posted_at);
}
const lines = s => String(s || '').split(/\r?\n/).map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

module.exports = {
  OPTIONS, validate, get, getBySlug, listPublic, listAdmin, isLive, create, update, reorder, remove,
  experienceLabel, salaryLabel, postedLabel, dateLabel, lines, slugify, today
};
