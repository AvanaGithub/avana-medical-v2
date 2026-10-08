// End-to-end API tests against a throwaway database and upload folder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avana-api-'));
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
const app = require('../src/index');
const { db } = require('../src/db');
const auth = require('../src/auth');
const config = require('../src/config');

let base, server;
const ADMIN = { email: 'admin@test.local', password: 'adminpass123' };
const EDITOR = { email: 'editor@test.local', password: 'editorpass123' };

function client() {
  let cookie = '';
  return async function call(method, url, body, opts = {}) {
    const headers = Object.assign({ 'X-Requested-With': 'fetch' }, opts.headers || {});
    if (opts.noAjax) delete headers['X-Requested-With'];
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: res.status, body: json };
  };
}

test.before(async () => {
  db.prepare("INSERT INTO users (email, name, role, password_hash) VALUES (?, 'Ada Admin', 'admin', ?)").run(ADMIN.email, auth.hashPassword(ADMIN.password));
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

test('sign-in rules', async () => {
  const c = client();
  assert.strictEqual((await c('GET', '/api/admin/events')).status, 401);
  assert.strictEqual((await c('POST', '/api/auth/login', { email: ADMIN.email, password: 'wrong-password1' })).status, 401);
  assert.strictEqual((await c('POST', '/api/auth/login', ADMIN, { noAjax: true })).status, 403, 'cross-site style request must be blocked');
  const r = await c('POST', '/api/auth/login', ADMIN);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.user.role, 'admin');
  assert.strictEqual((await c('GET', '/api/auth/me')).body.user.email, ADMIN.email);
});

test('too many wrong passwords are blocked', async () => {
  const c = client();
  for (let i = 0; i < 8; i++) await c('POST', '/api/auth/login', { email: 'nobody@test.local', password: 'wrongpass99' });
  assert.strictEqual((await c('POST', '/api/auth/login', { email: 'nobody@test.local', password: 'wrongpass99' })).status, 429);
});

test('event lifecycle: upload + crop, create, show on site, edit, reorder, hide, delete', async () => {
  const c = client();
  await c('POST', '/api/auth/login', ADMIN);

  // upload a real photo with a crop box
  const photo = fs.readFileSync(path.join(config.siteRoot, 'images', 'careers', 'growth', '01.jpg'));
  const fd = new FormData();
  fd.append('image', new Blob([photo], { type: 'image/jpeg' }), 'photo.jpg');
  fd.append('crop', JSON.stringify({ x: 0, y: 100, width: 800, height: 500 }));
  const up = await c('POST', '/api/admin/uploads', fd);
  assert.strictEqual(up.status, 200, JSON.stringify(up.body));
  const sharp = require('sharp');
  const big = await sharp(path.join(process.env.UPLOADS_DIR, up.body.image.slice(8))).metadata();
  const small = await sharp(path.join(process.env.UPLOADS_DIR, up.body.image_small.slice(8))).metadata();
  assert.deepStrictEqual([big.width, big.height, small.width, small.height], [1600, 1000, 800, 500]);

  // non-image upload is refused
  const bad = new FormData();
  bad.append('image', new Blob(['not an image'], { type: 'image/jpeg' }), 'x.jpg');
  assert.strictEqual((await c('POST', '/api/admin/uploads', bad)).status, 400);

  const a = (await c('POST', '/api/admin/events', {
    section: 'upcoming', title: 'Arthro Knee 2027', description: 'Academic programme.', tag: 'Medical Education',
    start_date: '2027-08-06', end_date: '2027-08-08', location: 'Mumbai', image: up.body.image, image_small: up.body.image_small, image_alt: 'Stage'
  })).body.event;
  const b = (await c('POST', '/api/admin/events', { section: 'upcoming', title: 'Second event', date_note: 'Dates to be announced' })).body.event;
  assert.ok(a.id && b.id);

  let page = (await c('GET', '/')).body;
  assert.ok(page.includes('Arthro Knee 2027') && page.includes('6–8 Aug 2027 · Mumbai'), 'new event on the site with its date label');
  assert.ok(page.includes(up.body.image_small + ' 800w'), 'small image offered to phones');
  assert.ok(page.indexOf('Arthro Knee 2027') < page.indexOf('Second event'));

  // uploaded image is served
  const img = await fetch(base + '/' + up.body.image);
  assert.strictEqual(img.status, 200);

  // validation message comes back to the admin
  assert.match((await c('PUT', `/api/admin/events/${a.id}`, { end_date: '2027-08-01' })).body.error, /before the start/);

  // reorder: second first
  await c('POST', '/api/admin/events/reorder', { section: 'upcoming', ids: [b.id, a.id] });
  page = (await c('GET', '/')).body;
  assert.ok(page.indexOf('Second event') < page.indexOf('Arthro Knee 2027'));

  // hide, then delete
  await c('PUT', `/api/admin/events/${b.id}`, { published: false });
  assert.ok(!(await c('GET', '/')).body.includes('Second event'));
  await c('DELETE', `/api/admin/events/${a.id}`);
  assert.ok(!(await c('GET', '/')).body.includes('Arthro Knee 2027'));
  assert.ok(!fs.existsSync(path.join(process.env.UPLOADS_DIR, up.body.image.slice(8))), 'deleted event removes its uploaded image');

  // audit trail records who did what
  assert.ok(db.prepare("SELECT COUNT(*) c FROM audit_log WHERE entity = 'event'").get().c >= 5);
});

test('users: admin manages users, editor cannot; safeguards', async () => {
  const admin = client();
  await admin('POST', '/api/auth/login', ADMIN);
  assert.match((await admin('POST', '/api/admin/users', { email: EDITOR.email, name: 'Ed', role: 'editor', password: 'short' })).body.error, /10 characters/);
  const created = await admin('POST', '/api/admin/users', Object.assign({ name: 'Ed Editor', role: 'editor' }, EDITOR));
  assert.strictEqual(created.status, 200);

  const ed = client();
  assert.strictEqual((await ed('POST', '/api/auth/login', EDITOR)).status, 200);
  assert.strictEqual((await ed('GET', '/api/admin/events')).status, 200, 'editor can manage events');
  assert.strictEqual((await ed('GET', '/api/admin/users')).status, 403, 'editor cannot see users');

  const me = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN.email).id;
  assert.match((await admin('PUT', `/api/admin/users/${me}`, { role: 'editor' })).body.error, /your own admin/);

  // disabling a user signs them out immediately
  await admin('PUT', `/api/admin/users/${created.body.id}`, { active: false });
  assert.strictEqual((await ed('GET', '/api/admin/events')).status, 401);
  assert.strictEqual((await ed('POST', '/api/auth/login', EDITOR)).status, 401);
});

test('private files are never served', async () => {
  for (const p of ['/server/src/index.js', '/server/data/app.db', '/server/.env', '/.git/config', '/README.md', '/uploads/../server/.env']) {
    assert.strictEqual((await fetch(base + p)).status, 404, p);
  }
});
