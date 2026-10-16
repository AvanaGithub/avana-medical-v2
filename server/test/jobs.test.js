// Job board tests: posting, the openings-by-email link, applying with a CV, privacy of CVs and links.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avana-jobs-'));
// Tests never send real email, whatever server/.env says: messages go to the outbox folder instead
process.env.SMTP_HOST = '';
process.env.APPLICATION_NOTIFY_EMAIL = 'hr-alerts@test.local';
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


// The request form: full profile + CV (multipart)
const SEEKER = { name: 'Priya Raman', email: 'Priya@Example.com', age: '27', marital_status: 'Single', education: 'B.Pharm',
  why_join: 'Keen on sports medicine.', phone: '+91 98765 43210', city: 'Chennai', total_exp: '4.5', current_ctc: '6.2',
  expected_ctc: '8', notice_period: '30 days', current_employer: 'MedCo', current_role: 'Sales Executive',
  linkedin: 'https://linkedin.com/in/priya', consent: 'on', truthful: 'on' };
const ask = (pub, o = {}, file) => pub('POST', '/api/openings-request', cvForm(Object.assign({}, SEEKER, o), file));
const outbox = () => path.join(tmp, 'outbox');
const lastEmail = () => {
  const files = fs.readdirSync(outbox()).sort();
  return fs.readFileSync(path.join(outbox(), files[files.length - 1]), 'utf8');
};
const linkIn = html => html.match(/href="(https:\/\/new\.avanamedical\.com\/job\?t=[\w-]+)"/)[1];
const APPLY = '/api/apply/territory-manager-sports-medicine';
const applyForm = (fields, file = null) => cvForm(fields, file);
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
  assert.strictEqual(old.status, 301);
  assert.strictEqual(old.headers.get('location'), '/careers/');
});

test('asking for the openings: full profile and CV, then an email with a personal link', async () => {
  const pub = client();
  assert.strictEqual((await ask(pub, { email: 'nope' })).body.field, 'email');
  assert.strictEqual((await ask(pub, { age: '16' })).body.field, 'age');
  assert.strictEqual((await ask(pub, { marital_status: 'Other' })).body.field, 'marital_status');
  assert.strictEqual((await ask(pub, { phone: '123' })).body.field, 'phone');
  assert.strictEqual((await ask(pub, { total_exp: '' })).body.field, 'total_exp');
  assert.strictEqual((await ask(pub, { consent: '' })).body.field, 'consent');
  assert.strictEqual((await ask(pub, { truthful: '' })).body.field, 'truthful');
  assert.strictEqual((await ask(pub, {}, null)).body.field, 'cv', 'a CV is required');
  const fake = await ask(pub, {}, { data: 'MZ this is a program', name: 'cv.pdf', type: 'application/pdf' });
  assert.strictEqual(fake.body.field, 'cv', 'a non-PDF renamed to .pdf is refused');
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM job_leads').get().n, 0, 'nothing saved from refused requests');

  const r = await ask(pub);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.delivered, false, 'no SMTP in tests: saved to the outbox instead');

  const mail = lastEmail();
  assert.match(mail, /To: priya@example\.com/);
  assert.match(mail, /Subject: You’re one step closer to joining the Avana family – 1 open position/);
  assert.ok(mail.includes('one step closer to joining the Avana family</div>'), 'also the heading');
  assert.ok(mail.includes('Hi Priya,'));
  assert.ok(mail.includes('Territory Manager – Sports Medicine'));
  assert.ok(!mail.includes('Draft role'));
  token = new URL(linkIn(mail)).searchParams.get('t');
  assert.ok(token.length >= 30);
  assert.ok(mail.includes(`job?t=${token}&amp;job=territory-manager-sports-medicine`), 'each job links straight to its details');
  assert.ok(mail.includes('Sales &amp; Marketing') && !mail.includes('Other roles'), 'grouped like the /job page; empty groups left out');

  const row = db.prepare('SELECT * FROM job_leads').get();
  assert.ok(!JSON.stringify(row).includes(token), 'only a hash of the token is stored');
  assert.strictEqual(row.email, 'priya@example.com');
  assert.strictEqual(row.phone, '+91 98765 43210');
  assert.strictEqual(row.total_exp, 4.5);
  assert.strictEqual(row.cv_name, 'Priya CV.pdf');
  assert.strictEqual(row.email_status, 'not_configured');
});

test('the personal link shows the openings; a wrong link shows the "expired" note', async () => {
  const res = await fetch(`${base}/job?t=${token}`);
  assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.strictEqual(res.headers.get('referrer-policy'), 'no-referrer');
  const html = await res.text();
  assert.ok(html.includes('Territory Manager – Sports Medicine'));
  assert.ok(html.includes('₹6–9 LPA') && html.includes('3–6 yrs · Full-time') && html.includes('Chennai, Tamil Nadu'));
  assert.ok(!html.includes('Draft role'), 'drafts stay off the website');
  assert.match(html, /1 open position</);
  assert.ok(html.includes('Hi Priya, here are our current openings.'));
  assert.ok(html.includes('Sales &amp; Marketing <span class="job-cat-n">1 open</span>'), 'the Sales job sits in Sales & Marketing');
  assert.ok(html.includes('Other roles <span class="job-cat-n">0 open</span>'));
  assert.ok(html.includes('data-route="jobs"'));
  assert.ok(html.includes(`data-openings-token="${token}"`));
  assert.ok(html.includes('data-lead-cv="Priya CV.pdf"'), 'the page knows which CV will be sent');
  assert.strictEqual(db.prepare('SELECT visits FROM job_leads').get().visits, 1);
  const careers = await (await fetch(`${base}/careers/`)).text();
  assert.ok(!careers.includes('Territory Manager – Sports Medicine') && careers.includes('We have 1 open position right now.'),
    'the Careers page shows only the count');
  // links emailed before the page moved still work
  const moved = await fetch(`${base}/openings?t=${token}&job=x`, { redirect: 'manual' });
  assert.strictEqual(moved.status, 301);
  assert.strictEqual(moved.headers.get('location'), `/job?t=${token}&job=x`);

  const bad = await (await fetch(`${base}/job?t=not-a-real-token-1234567890`)).text();
  assert.ok(!bad.includes('Territory Manager – Sports Medicine'));
  assert.ok(bad.includes('That openings link has expired'));
});

test('applying is one click: the saved profile and CV are used; once per job', async () => {
  const pub = client();
  const noLink = await pub('POST', APPLY, applyForm({}));
  assert.strictEqual(noLink.status, 403, 'no link, no application');
  assert.match(noLink.body.error, /expired/);

  const ok = await pub('POST', APPLY, applyForm({ token, cover_note: 'I have 4 years in arthroscopy sales.' }));
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  // HR gets a heads-up with the admin link
  const alert = fs.readdirSync(outbox()).filter(f => f.includes('hr-alerts@test.local'));
  assert.strictEqual(alert.length, 1, 'one alert per application');
  const alertMail = fs.readFileSync(path.join(outbox(), alert[0]), 'utf8');
  assert.match(alertMail, /Subject: New application: Territory Manager – Sports Medicine – Priya Raman/);
  assert.ok(alertMail.includes('https://new.avanamedical.com/admin/#applications'));
  assert.ok(alertMail.includes('I have 4 years in arthroscopy sales.'));
  const again = await pub('POST', APPLY, applyForm({ token }));
  assert.strictEqual(again.status, 409, 'one application per job');

  const list = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.strictEqual(list.length, 1);
  const a = list[0];
  assert.strictEqual(a.name, 'Priya Raman');
  assert.strictEqual(a.phone, '+91 98765 43210');
  assert.strictEqual(a.expected_ctc, 8);
  assert.strictEqual(a.qualification, 'B.Pharm');
  assert.strictEqual(a.cover_note, 'I have 4 years in arthroscopy sales.');
  assert.strictEqual(a.status, 'new');
  assert.strictEqual(a.lead_age, 27, 'the application carries what they told us when asking for the openings');
  assert.strictEqual(a.lead_marital, 'Single');
  assert.ok((await (await fetch(`${base}/job?t=${token}`)).text()).includes('<span class="job-badge">Applied</span>'), 'the job shows as applied');

  // CV: copied for the application; downloadable by staff only, never from a public URL
  const cv = await admin('GET', `/api/admin/applications/${a.id}/cv`);
  assert.strictEqual(cv.status, 200);
  assert.ok(String(cv.body).startsWith('%PDF'));
  assert.notStrictEqual(a.cv_file, db.prepare('SELECT cv_file FROM job_leads').get().cv_file, 'the application has its own copy');
  assert.strictEqual((await client()('GET', `/api/admin/applications/${a.id}/cv`)).status, 401);
  assert.strictEqual((await fetch(`${base}/uploads/../cv/${a.cv_file}`)).status, 404);
  assert.ok(!fs.existsSync(path.join(process.env.UPLOADS_DIR, 'cv')), 'CVs are not stored in the public uploads folder');

  // status + notes
  const upd = await admin('PUT', `/api/admin/applications/${a.id}`, { status: 'shortlisted', notes: 'Call on Monday' });
  assert.strictEqual(upd.body.application.status, 'shortlisted');
});

test('applying with a different CV: checked, then used from then on', async () => {
  const second = Object.assign({}, JOB, { title: 'Product Specialist – Knee', department: 'Medical Education' });
  assert.strictEqual((await admin('POST', '/api/admin/jobs', second)).status, 200);
  const url = '/api/apply/product-specialist-knee';
  const pub = client();
  const fake = await pub('POST', url, applyForm({ token }, { data: 'MZ not a cv', name: 'new.pdf', type: 'application/pdf' }));
  assert.strictEqual(fake.body.field, 'cv');
  const ok = await pub('POST', url, applyForm({ token }, { data: '%PDF-1.4\n%newer cv\n', name: 'Priya CV 2026.pdf', type: 'application/pdf' }));
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.strictEqual(db.prepare('SELECT cv_name FROM job_leads').get().cv_name, 'Priya CV 2026.pdf');
  const html = await (await fetch(`${base}/job?t=${token}`)).text();
  assert.ok(html.includes('Other roles <span class="job-cat-n">1 open</span>'), 'Medical Education sits in Other roles');
  await admin('DELETE', `/api/admin/jobs/${jobs.getBySlug('product-specialist-knee').id}`);
});

test('admin: requests list with CV, resend gives a fresh link (old one stops), delete keeps applications', async () => {
  const r = await admin('GET', '/api/admin/leads');
  assert.strictEqual(r.body.mailConfigured, false);
  assert.strictEqual(r.body.leads.length, 1);
  const lead = r.body.leads[0];
  assert.strictEqual(lead.applications, 2);
  assert.strictEqual(lead.city, 'Chennai');
  assert.strictEqual(lead.has_cv, 1);
  assert.strictEqual((await client()('GET', '/api/admin/leads')).status, 401);
  const leadCv = await admin('GET', `/api/admin/leads/${lead.id}/cv`);
  assert.strictEqual(leadCv.status, 200);
  assert.ok(String(leadCv.body).includes('newer cv'));
  assert.strictEqual((await client()('GET', `/api/admin/leads/${lead.id}/cv`)).status, 401);

  const re = await admin('POST', `/api/admin/leads/${lead.id}/resend`);
  assert.strictEqual(re.body.status, 'not_configured');
  const fresh = new URL(re.body.link).searchParams.get('t');
  assert.notStrictEqual(fresh, token);
  assert.ok((await (await fetch(`${base}/job?t=${token}`)).text()).includes('That openings link has expired'), 'old link stops working');
  assert.ok((await (await fetch(`${base}/job?t=${fresh}`)).text()).includes('Territory Manager – Sports Medicine'));
  token = fresh;

  // asking again with the same email updates the same request instead of adding another
  await ask(client(), { education: 'M.Pharm' });
  const again = (await admin('GET', '/api/admin/leads')).body.leads;
  assert.strictEqual(again.length, 1);
  assert.strictEqual(again[0].requests, 2);
  assert.strictEqual(again[0].education, 'M.Pharm');
  token = new URL(linkIn(lastEmail())).searchParams.get('t');

  // expired link
  db.prepare("UPDATE job_leads SET expires_at = datetime('now', '-1 minute')").run();
  assert.ok((await (await fetch(`${base}/job?t=${token}`)).text()).includes('That openings link has expired'));
  assert.strictEqual((await client()('POST', APPLY, applyForm({ token }))).status, 403);
  db.prepare("UPDATE job_leads SET expires_at = datetime('now', '+30 days')").run();

  const cvFile = db.prepare('SELECT cv_file FROM job_leads').get().cv_file;
  assert.strictEqual((await admin('DELETE', `/api/admin/leads/${lead.id}`)).status, 200);
  assert.strictEqual((await admin('GET', '/api/admin/leads')).body.leads.length, 0);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(!fs.existsSync(path.join(tmp, 'cv', cvFile)), 'their CV is deleted with the request');
  const apps = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.strictEqual(apps.length, 2, 'applications stay');
  assert.strictEqual((await admin('GET', `/api/admin/applications/${apps[apps.length - 1].id}/cv`)).status, 200, 'with their own CV copy');
  // give later tests a fresh link
  await ask(client());
  token = new URL(linkIn(lastEmail())).searchParams.get('t');
});

test('closed or expired jobs leave the site and refuse applications', async () => {
  const j = jobs.getBySlug('territory-manager-sports-medicine');
  await admin('PUT', `/api/admin/jobs/${j.id}`, { closes_at: '2020-01-01' });
  assert.ok(!(await (await fetch(`${base}/job?t=${token}`)).text()).includes('Territory Manager – Sports Medicine'), 'expired job hidden');
  assert.strictEqual((await client()('POST', APPLY, applyForm({ token }))).status, 410);

  await admin('PUT', `/api/admin/jobs/${j.id}`, { closes_at: '', status: 'closed' });
  assert.ok((await (await fetch(`${base}/job?t=${token}`)).text()).includes('There are no open positions right now.'));
  assert.ok(!(await (await fetch(base + '/')).text()).includes('open position right now'));

  // deleting a job keeps its applications
  await admin('DELETE', `/api/admin/jobs/${j.id}`);
  const list = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.ok(list.some(a => a.job_title === 'Territory Manager – Sports Medicine'));
});

test('job titles and names are escaped on the website and in the email', async () => {
  await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { title: '<img src=x onerror=alert(1)>' }));
  const page = await (await fetch(`${base}/job?t=${token}`)).text();
  assert.ok(!page.includes('<img src=x onerror=alert(1)>'));
  assert.ok(page.includes('&lt;img src=x onerror=alert(1)&gt;'));

  // names with markup are refused outright; an apostrophe is fine and is escaped where it is shown
  assert.strictEqual((await ask(client(), { email: 'x@example.com', name: '<b>Eve</b> "x"' })).body.field, 'name');
  await ask(client(), { email: 'x@example.com', name: "Eve D'Souza" });
  const mail = lastEmail();
  assert.ok(mail.includes('Hi Eve,'));
  assert.ok(!mail.includes('<img src=x'));
  const t = new URL(linkIn(mail)).searchParams.get('t');
  const own = await (await fetch(`${base}/job?t=${t}`)).text();
  assert.ok(own.includes('data-lead-name="Eve D&#39;Souza"'));
});

test('form rules: age, mobile, name, city, experience, CTC, LinkedIn', async () => {
  const pub = client();
  const field = async o => (await ask(pub, Object.assign({ email: 'rules@example.com' }, o))).body.field;
  for (const age of ['150', '7', '17', '66', '27.5', '2a']) assert.strictEqual(await field({ age }), 'age', 'age ' + age);
  for (const phone of ['12345 67890', '98765', '+1 202 555 0100', '98765432101']) assert.strictEqual(await field({ phone }), 'phone', 'phone ' + phone);
  assert.strictEqual(await field({ name: 'Priya 2' }), 'name');
  assert.strictEqual(await field({ city: '600001' }), 'city');
  assert.strictEqual(await field({ total_exp: '13' }), 'total_exp', 'more experience than age allows (27 - 15 = 12)');
  assert.strictEqual(await field({ total_exp: '4.25' }), 'total_exp');
  assert.strictEqual(await field({ current_ctc: '1500' }), 'current_ctc');
  assert.strictEqual(await field({ linkedin: 'https://example.com/me' }), 'linkedin');
  // accepted formats are stored the same way
  const ok = await ask(pub, { email: 'rules@example.com', phone: '09876543210' });
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.strictEqual(db.prepare("SELECT phone FROM job_leads WHERE email = 'rules@example.com'").get().phone, '+91 98765 43210');
});
