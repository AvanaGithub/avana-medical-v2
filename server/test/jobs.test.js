// Job board tests: posting, the openings-by-email link, applying with a CV, privacy of CVs and links.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avana-jobs-'));
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.SITE_URL = 'https://new.avanamedical.com';
const app = require('../src/index');
const { db } = require('../src/db');
const auth = require('../src/auth');
const jobs = require('../src/jobs');

let base, server, admin;
const ADMIN = { email: 'hr@test.local', password: 'hrpassword123' };

function client() {
  let cookie = '';
  return async (method, url, body, extra = {}) => {
    const headers = { 'X-Requested-With': 'fetch' };
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: extra.redirect || 'follow' });
    const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body: data, headers: res.headers };
  };
}

const JOB = {
  title: 'Territory Manager – Sports Medicine', department: 'Sales', role_category: 'Field Sales',
  employment_type: 'Full-time', work_mode: 'Field-based', openings: 2,
  locations: 'Chennai, Tamil Nadu\nBengaluru, Karnataka', exp_min: 3, exp_max: 6, salary_min: 6, salary_max: 9, show_salary: true,
  education: 'B.Pharm / B.Sc / B.E. Biomedical', skills: 'Orthopaedic sales, Arthroscopy, Key accounts',
  languages: 'English, Tamil', notice_period: 'Up to 30 days', travel: 'Extensive (field role)', two_wheeler: true,
  reporting_to: 'Regional Sales Manager', summary: 'Grow Arthrex sports medicine sales across hospitals in your territory.',
  responsibilities: 'Meet surgeons and OT teams\nSupport cases in the operating room', requirements: '3+ years in orthopaedic device sales',
  benefits: 'Incentives\nHealth insurance', status: 'open'
};

function cvForm(fields, file = { data: '%PDF-1.4\n%test cv\n', name: 'Priya CV.pdf', type: 'application/pdf' }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append('cv', new Blob([file.data], { type: file.type }), file.name);
  return fd;
}
const CANDIDATE = { name: 'Priya Raman', email: 'priya@example.com', phone: '+91 98765 43210', city: 'Chennai', total_exp: '4.5',
  current_ctc: '6.2', expected_ctc: '8', notice_period: '30 days', current_employer: 'MedCo', current_role: 'Sales Executive',
  qualification: 'B.Pharm', linkedin: 'https://linkedin.com/in/priya', cover_note: 'Keen on sports medicine.', consent: 'yes' };

test.before(async () => {
  db.prepare("INSERT INTO users (email, name, role, password_hash) VALUES (?, 'HR', 'admin', ?)").run(ADMIN.email, auth.hashPassword(ADMIN.password));
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = 'http://127.0.0.1:' + server.address().port;
  admin = client();
  await admin('POST', '/api/auth/login', ADMIN);
});
test.after(() => server.close());

test('labels: experience, salary (₹ LPA)', () => {
  assert.strictEqual(jobs.experienceLabel({ exp_min: 3, exp_max: 6 }), '3–6 yrs');
  assert.strictEqual(jobs.experienceLabel({ exp_min: 0, exp_max: null }), 'Freshers');
  assert.strictEqual(jobs.experienceLabel({ exp_min: 5, exp_max: null }), '5+ yrs');
  assert.strictEqual(jobs.salaryLabel({ show_salary: 1, salary_min: 6, salary_max: 9.5 }), '₹6–9.5 LPA');
  assert.strictEqual(jobs.salaryLabel({ show_salary: 0, salary_min: 6, salary_max: 9 }), '');
});

const SEEKER = { name: 'Priya Raman', email: 'Priya@Example.com', age: 27, marital_status: 'Single', education: 'B.Pharm',
  why_join: 'Keen on sports medicine.', consent: true, truthful: true };
const outbox = () => path.join(tmp, 'outbox');
const lastEmail = () => {
  const files = fs.readdirSync(outbox()).sort();
  return fs.readFileSync(path.join(outbox(), files[files.length - 1]), 'utf8');
};
const linkIn = html => html.match(/href="(https:\/\/new\.avanamedical\.com\/openings\?t=[\w-]+)"/)[1];
let token;   // Priya's current openings link token

test('posting a job: validation; the public Careers page only invites people to ask for the openings', async () => {
  assert.match((await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { locations: '' }))).body.error, /location/);
  assert.match((await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { exp_min: 6, exp_max: 2 }))).body.error, /experience/);

  const draft = (await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { status: 'draft', title: 'Draft role' }))).body.job;
  const r = await admin('POST', '/api/admin/jobs', JOB);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const job = r.body.job;
  assert.match(job.ref_code, /^AMD-\d{2}-\d{3}$/);
  assert.strictEqual(job.slug, 'territory-manager-sports-medicine');
  assert.ok(job.posted_at, 'posted date set when opened');
  assert.ok(draft.id);

  const page = await (await fetch(base + '/')).text();
  assert.ok(!page.includes('Territory Manager – Sports Medicine'), 'jobs are not listed publicly');
  assert.ok(page.includes('We have 1 open position right now.'));
  assert.ok(page.includes('data-open-careers'));

  // old public job links go to the Careers page
  const old = await fetch(base + '/jobs/territory-manager-sports-medicine', { redirect: 'manual' });
  assert.strictEqual(old.status, 302);
  assert.strictEqual(old.headers.get('location'), '/#careers');
});

test('asking for the openings: validation, then an email with a personal link', async () => {
  const pub = client();
  const ask = b => pub('POST', '/api/openings-request', b);
  assert.strictEqual((await ask(Object.assign({}, SEEKER, { email: 'nope' }))).body.field, 'email');
  assert.strictEqual((await ask(Object.assign({}, SEEKER, { age: 16 }))).body.field, 'age');
  assert.strictEqual((await ask(Object.assign({}, SEEKER, { marital_status: 'Other' }))).body.field, 'marital_status');
  assert.strictEqual((await ask(Object.assign({}, SEEKER, { truthful: false }))).body.field, 'truthful');

  const r = await ask(SEEKER);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.delivered, false, 'no SMTP in tests: saved to the outbox instead');

  const mail = lastEmail();
  assert.match(mail, /To: priya@example\.com/);
  assert.match(mail, /Subject: 1 open position at Avana Medical Devices/);
  assert.ok(mail.includes('Hi Priya,'));
  assert.ok(mail.includes('Territory Manager – Sports Medicine'));
  assert.ok(!mail.includes('Draft role'));
  token = new URL(linkIn(mail)).searchParams.get('t');
  assert.ok(token.length >= 30);
  assert.ok(mail.includes(`openings?t=${token}&amp;job=territory-manager-sports-medicine`), 'each job links straight to its details');

  // only a hash of the token is stored
  const row = db.prepare('SELECT * FROM job_leads').get();
  assert.ok(!JSON.stringify(row).includes(token));
  assert.strictEqual(row.email, 'priya@example.com');
  assert.strictEqual(row.email_status, 'not_configured');
});

test('the personal link shows the openings; a wrong link shows the "expired" note', async () => {
  const res = await fetch(`${base}/openings?t=${token}`);
  assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.strictEqual(res.headers.get('referrer-policy'), 'no-referrer');
  const html = await res.text();
  assert.ok(html.includes('Territory Manager – Sports Medicine'));
  assert.ok(html.includes('₹6–9 LPA') && html.includes('3–6 yrs · Full-time') && html.includes('Chennai, Tamil Nadu'));
  assert.ok(!html.includes('Draft role'), 'drafts stay off the website');
  assert.match(html, /1 open position</);
  assert.ok(html.includes('Hi Priya, here are our current openings.'));
  assert.ok(html.includes(`data-openings-token="${token}"`));
  assert.strictEqual(db.prepare('SELECT visits FROM job_leads').get().visits, 1);

  const bad = await (await fetch(`${base}/openings?t=not-a-real-token-1234567890`)).text();
  assert.ok(!bad.includes('Territory Manager – Sports Medicine'));
  assert.ok(bad.includes('That openings link has expired'));
});

test('applying: needs the personal link; validation, CV type check, consent, success', async () => {
  const pub = client();
  const url = '/api/apply/territory-manager-sports-medicine';
  const withToken = (o, file) => cvForm(Object.assign({ token }, o), file);
  const noLink = await pub('POST', url, cvForm(CANDIDATE));
  assert.strictEqual(noLink.status, 403, 'no link, no application');
  assert.match(noLink.body.error, /expired/);

  assert.strictEqual((await pub('POST', url, withToken(Object.assign({}, CANDIDATE, { phone: '123' })))).body.field, 'phone');
  assert.strictEqual((await pub('POST', url, withToken(Object.assign({}, CANDIDATE, { consent: '' })))).body.field, 'consent');
  assert.strictEqual((await pub('POST', url, withToken(CANDIDATE, null))).body.field, 'cv');
  const fake = await pub('POST', url, withToken(CANDIDATE, { data: 'MZ this is a program', name: 'cv.pdf', type: 'application/pdf' }));
  assert.strictEqual(fake.body.field, 'cv', 'a non-PDF renamed to .pdf is refused');

  const ok = await pub('POST', url, withToken(CANDIDATE));
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));

  const list = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'Priya Raman');
  assert.strictEqual(list[0].expected_ctc, 8);
  assert.strictEqual(list[0].status, 'new');
  assert.strictEqual(list[0].lead_age, 27, 'the application carries what they told us when asking for the openings');
  assert.strictEqual(list[0].lead_marital, 'Single');

  // CV: downloadable by staff only, never from a public URL
  const cv = await admin('GET', `/api/admin/applications/${list[0].id}/cv`);
  assert.strictEqual(cv.status, 200);
  assert.ok(String(cv.body).startsWith('%PDF'));
  assert.strictEqual((await client()('GET', `/api/admin/applications/${list[0].id}/cv`)).status, 401);
  assert.strictEqual((await fetch(`${base}/uploads/../cv/${list[0].cv_file}`)).status, 404);
  assert.ok(!fs.existsSync(path.join(process.env.UPLOADS_DIR, 'cv')), 'CVs are not stored in the public uploads folder');

  // status + notes
  const upd = await admin('PUT', `/api/admin/applications/${list[0].id}`, { status: 'shortlisted', notes: 'Call on Monday' });
  assert.strictEqual(upd.body.application.status, 'shortlisted');
});

test('admin: requests list, resend gives a fresh link (old one stops), delete keeps applications', async () => {
  const r = await admin('GET', '/api/admin/leads');
  assert.strictEqual(r.body.mailConfigured, false);
  assert.strictEqual(r.body.leads.length, 1);
  const lead = r.body.leads[0];
  assert.strictEqual(lead.applications, 1);
  assert.strictEqual(lead.visits, 1);
  assert.strictEqual(lead.link_active, 1);
  assert.strictEqual((await client()('GET', '/api/admin/leads')).status, 401);

  const re = await admin('POST', `/api/admin/leads/${lead.id}/resend`);
  assert.strictEqual(re.body.status, 'not_configured');
  const fresh = new URL(re.body.link).searchParams.get('t');
  assert.notStrictEqual(fresh, token);
  assert.ok((await (await fetch(`${base}/openings?t=${token}`)).text()).includes('That openings link has expired'), 'old link stops working');
  assert.ok((await (await fetch(`${base}/openings?t=${fresh}`)).text()).includes('Territory Manager – Sports Medicine'));
  token = fresh;

  // asking again with the same email updates the same request instead of adding another
  await client()('POST', '/api/openings-request', Object.assign({}, SEEKER, { education: 'M.Pharm' }));
  const again = (await admin('GET', '/api/admin/leads')).body.leads;
  assert.strictEqual(again.length, 1);
  assert.strictEqual(again[0].requests, 2);
  assert.strictEqual(again[0].education, 'M.Pharm');
  token = new URL(linkIn(lastEmail())).searchParams.get('t');

  // expired link
  db.prepare("UPDATE job_leads SET expires_at = datetime('now', '-1 minute')").run();
  assert.ok((await (await fetch(`${base}/openings?t=${token}`)).text()).includes('That openings link has expired'));
  assert.strictEqual((await client()('POST', '/api/apply/territory-manager-sports-medicine', cvForm(Object.assign({ token }, CANDIDATE)))).status, 403);
  db.prepare("UPDATE job_leads SET expires_at = datetime('now', '+30 days')").run();

  assert.strictEqual((await admin('DELETE', `/api/admin/leads/${lead.id}`)).status, 200);
  assert.strictEqual((await admin('GET', '/api/admin/leads')).body.leads.length, 0);
  assert.strictEqual((await admin('GET', '/api/admin/applications')).body.applications.length, 1, 'applications stay');
  // give later tests a fresh link
  await client()('POST', '/api/openings-request', SEEKER);
  token = new URL(linkIn(lastEmail())).searchParams.get('t');
});

test('closed or expired jobs leave the site and refuse applications', async () => {
  const j = jobs.getBySlug('territory-manager-sports-medicine');
  await admin('PUT', `/api/admin/jobs/${j.id}`, { closes_at: '2020-01-01' });
  assert.ok(!(await (await fetch(`${base}/openings?t=${token}`)).text()).includes('Territory Manager – Sports Medicine'), 'expired job hidden');
  assert.strictEqual((await client()('POST', '/api/apply/territory-manager-sports-medicine', cvForm(Object.assign({ token }, CANDIDATE)))).status, 410);

  await admin('PUT', `/api/admin/jobs/${j.id}`, { closes_at: '', status: 'closed' });
  assert.ok((await (await fetch(`${base}/openings?t=${token}`)).text()).includes('There are no open positions right now.'));
  assert.ok(!(await (await fetch(base + '/')).text()).includes('open position right now'));

  // deleting a job keeps its applications
  await admin('DELETE', `/api/admin/jobs/${j.id}`);
  const list = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].job_title, 'Territory Manager – Sports Medicine');
});

test('job titles and names are escaped on the website and in the email', async () => {
  await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { title: '<img src=x onerror=alert(1)>' }));
  const page = await (await fetch(`${base}/openings?t=${token}`)).text();
  assert.ok(!page.includes('<img src=x onerror=alert(1)>'));
  assert.ok(page.includes('&lt;img src=x onerror=alert(1)&gt;'));

  await client()('POST', '/api/openings-request', Object.assign({}, SEEKER, { email: 'x@example.com', name: '<b>Eve</b> "x"' }));
  const mail = lastEmail();
  assert.ok(!mail.includes('<b>Eve</b>') && mail.includes('&lt;b&gt;Eve&lt;/b&gt;'));
  assert.ok(!mail.includes('<img src=x'));
  const t = new URL(linkIn(mail)).searchParams.get('t');
  const own = await (await fetch(`${base}/openings?t=${t}`)).text();
  assert.ok(!own.includes('<b>Eve</b>'));
});
