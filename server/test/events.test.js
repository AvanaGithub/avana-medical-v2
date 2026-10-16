// Event records: date labels and validation. (News & Events is no longer on the website; the events stay in the database.)
// Run: npm test   (uses a throwaway database in the OS temp folder)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Tests never send real email, whatever server/.env says: messages go to the outbox folder instead
process.env.SMTP_HOST = '';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'avana-test-'));
process.env.UPLOADS_DIR = path.join(process.env.DATA_DIR, 'uploads');
const events = require('../src/events');


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
