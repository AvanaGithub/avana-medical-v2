// Checks that the server-rendered News & Events matches the static cards in index.html when the
// database holds the same events, and that the date labels format correctly.
// Run: npm test   (uses a throwaway database in the OS temp folder)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'avana-test-'));
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
const config = require('../src/config');
const events = require('../src/events');
const { renderIndex } = require('../src/render');

const text = html => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();
const section = (html, s) => {
  const m = html.match(new RegExp(`<!-- events:${s} -->([\\s\\S]*?)<!-- /events:${s} -->`));
  return m ? m[1] : null;
};

test('date labels', () => {
  assert.strictEqual(events.formatDates('2027-03-12'), '12 Mar 2027');
  assert.strictEqual(events.formatDates('2027-03-12', '2027-03-14'), '12–14 Mar 2027');
  assert.strictEqual(events.formatDates('2027-02-28', '2027-03-02'), '28 Feb – 2 Mar 2027');
  assert.strictEqual(events.formatDates('2026-12-30', '2027-01-02'), '30 Dec 2026 – 2 Jan 2027');
  assert.strictEqual(events.whenLabel({ start_date: '2027-03-12', location: 'Chennai' }), '12 Mar 2027 · Chennai');
  assert.strictEqual(events.whenLabel({ date_note: 'FY26', location: 'Delhi' }), 'FY26 · Delhi');
});

test('validation', () => {
  assert.match(events.validate({ section: 'upcoming', title: '' }).error, /title/i);
  assert.match(events.validate({ section: 'upcoming', title: 'x', start_date: '2027-02-31' }).error, /not a valid date/);
  assert.match(events.validate({ section: 'upcoming', title: 'x', start_date: '2027-03-12', end_date: '2027-03-01' }).error, /before/);
  assert.match(events.validate({ section: 'upcoming', title: 'x', image: '../server/data/app.db' }).error, /not allowed/);
  assert.ok(events.validate({ section: 'past', title: 'x', image: 'uploads/events/2026-10/abc.jpg' }).value);
});

test('rendered page matches the static page after import', () => {
  require('../scripts/seed-events.js');
  const original = fs.readFileSync(path.join(config.siteRoot, 'index.html'), 'utf8');
  const rendered = renderIndex();
  for (const s of ['upcoming', 'past']) {
    assert.strictEqual(text(section(rendered, s)), text(section(original, s)), s + ' section text differs');
  }
  // the highlights film keeps the ids main.js / videos.js rely on
  assert.ok(rendered.includes('id="evVideo"') && rendered.includes('id="evVideoToggle"'));
});

test('empty section is left out; text is escaped', () => {
  const { db } = require('../src/db');
  db.prepare("UPDATE events SET published = 0 WHERE section = 'upcoming'").run();
  const e = events.create(events.validate({ section: 'past', title: '<script>alert(1)</script>', published: true }).value);
  const html = renderIndex();
  assert.strictEqual(section(html, 'upcoming'), null, 'upcoming should be removed when empty');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(html, /aria-label="Moments we've shared: 6 events"/);
  events.remove(e.id);
});
