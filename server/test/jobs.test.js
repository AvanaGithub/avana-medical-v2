// Job board tests: posting, careers page rendering, Google Jobs data, applying with a CV, privacy of CVs.
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

test('posting a job: validation, then it appears on the Careers page', async () => {
  assert.match((await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { locations: '' }))).body.error, /location/);
  assert.match((await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { exp_min: 6, exp_max: 2 }))).body.error, /experience/);

  const draft = (await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { status: 'draft', title: 'Draft role' }))).body.job;
  const r = await admin('POST', '/api/admin/jobs', JOB);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const job = r.body.job;
  assert.match(job.ref_code, /^AMD-\d{2}-\d{3}$/);
  assert.strictEqual(job.slug, 'territory-manager-sports-medicine');
  assert.ok(job.posted_at, 'posted date set when opened');

  const page = (await fetch(base + '/')).text ? await (await fetch(base + '/')).text() : '';
  assert.ok(page.includes('Territory Manager – Sports Medicine'));
  assert.ok(page.includes('₹6–9 LPA') && page.includes('3–6 yrs · Full-time') && page.includes('Chennai, Tamil Nadu'));
  assert.ok(!page.includes('Draft role'), 'drafts stay off the website');
  assert.match(page, /1 open position</);
  assert.ok(draft.id);
});

test('a job page has its own title and Google Jobs data', async () => {
  const html = await (await fetch(base + '/jobs/territory-manager-sports-medicine')).text();
  assert.match(html, /<title>Territory Manager – Sports Medicine · Careers · Avana Medical Devices<\/title>/);
  assert.ok(html.includes('<base href="/">'));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(ld['@type'], 'JobPosting');
  assert.strictEqual(ld.employmentType, 'FULL_TIME');
  assert.strictEqual(ld.baseSalary.currency, 'INR');
  assert.strictEqual(ld.baseSalary.value.minValue, 600000);
  assert.deepStrictEqual(ld.jobLocation.map(p => p.address.addressLocality), ['Chennai', 'Bengaluru']);
  assert.strictEqual(ld.hiringOrganization.sameAs, 'https://new.avanamedical.com');
  // unknown job → back to careers
  const miss = await fetch(base + '/jobs/no-such-job', { redirect: 'manual' });
  assert.strictEqual(miss.status, 302);
  assert.strictEqual(miss.headers.get('location'), '/#careers');
});

test('applying: validation, CV type check, consent, success', async () => {
  const pub = client();
  const url = '/api/apply/territory-manager-sports-medicine';
  assert.strictEqual((await pub('POST', url, cvForm(Object.assign({}, CANDIDATE, { phone: '123' })))).body.field, 'phone');
  assert.strictEqual((await pub('POST', url, cvForm(Object.assign({}, CANDIDATE, { consent: '' })))).body.field, 'consent');
  assert.strictEqual((await pub('POST', url, cvForm(CANDIDATE, null))).body.field, 'cv');
  const fake = await pub('POST', url, cvForm(CANDIDATE, { data: 'MZ this is a program', name: 'cv.pdf', type: 'application/pdf' }));
  assert.strictEqual(fake.body.field, 'cv', 'a non-PDF renamed to .pdf is refused');

  const ok = await pub('POST', url, cvForm(CANDIDATE));
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));

  const list = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'Priya Raman');
  assert.strictEqual(list[0].expected_ctc, 8);
  assert.strictEqual(list[0].status, 'new');

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

test('closed or expired jobs leave the site and refuse applications', async () => {
  const j = jobs.getBySlug('territory-manager-sports-medicine');
  await admin('PUT', `/api/admin/jobs/${j.id}`, { closes_at: '2020-01-01' });
  assert.ok(!(await (await fetch(base + '/')).text()).includes('Territory Manager – Sports Medicine'), 'expired job hidden');
  assert.strictEqual((await client()('POST', '/api/apply/territory-manager-sports-medicine', cvForm(CANDIDATE))).status, 410);

  await admin('PUT', `/api/admin/jobs/${j.id}`, { closes_at: '', status: 'closed' });
  const page = await (await fetch(base + '/')).text();
  assert.ok(page.includes('There are no open positions right now.'));

  // deleting a job keeps its applications
  await admin('DELETE', `/api/admin/jobs/${j.id}`);
  const list = (await admin('GET', '/api/admin/applications')).body.applications;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].job_title, 'Territory Manager – Sports Medicine');
});

test('job titles are escaped on the website', async () => {
  await admin('POST', '/api/admin/jobs', Object.assign({}, JOB, { title: '<img src=x onerror=alert(1)>' }));
  const page = await (await fetch(base + '/')).text();
  assert.ok(!page.includes('<img src=x onerror=alert(1)>'));
  assert.ok(page.includes('&lt;img src=x onerror=alert(1)&gt;'));
});
