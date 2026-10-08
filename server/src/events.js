// Event data: validation, queries, and the date/location label shown on each card.
const { db } = require('./db');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null; // rejects 2026-02-31
}

// "12 Mar 2027", "12–14 Mar 2027", "28 Feb – 2 Mar 2027", "30 Dec 2026 – 2 Jan 2027"
function formatDates(start, end) {
  const a = parseDate(start), b = parseDate(end);
  if (!a) return '';
  const D = d => d.getUTCDate(), M = d => MONTHS[d.getUTCMonth()], Y = d => d.getUTCFullYear();
  if (!b || +b === +a) return `${D(a)} ${M(a)} ${Y(a)}`;
  if (Y(a) !== Y(b)) return `${D(a)} ${M(a)} ${Y(a)} – ${D(b)} ${M(b)} ${Y(b)}`;
  if (M(a) !== M(b)) return `${D(a)} ${M(a)} – ${D(b)} ${M(b)} ${Y(a)}`;
  return `${D(a)}–${D(b)} ${M(a)} ${Y(a)}`;
}

// What appears next to the tag on the card, e.g. "12–14 Mar 2027 · Chennai" or "FY26 · Delhi"
function whenLabel(e) {
  const date = formatDates(e.start_date, e.end_date) || e.date_note;
  return [date, e.location].filter(Boolean).join(' · ');
}

const LIMITS = { title: 120, description: 400, tag: 40, date_note: 80, location: 80, image_alt: 200 };

// Returns { value } with a clean event object, or { error } with a message for the admin.
function validate(input, existing) {
  const e = Object.assign({}, existing || {});
  const str = k => (input[k] === undefined ? e[k] : String(input[k] ?? '').trim());
  for (const k of Object.keys(LIMITS)) {
    e[k] = str(k) ?? '';
    if (e[k].length > LIMITS[k]) return { error: `${label(k)} is too long (max ${LIMITS[k]} characters).` };
  }
  if (!e.title) return { error: 'Add a title.' };

  if (input.section !== undefined) e.section = input.section;
  if (!['upcoming', 'past'].includes(e.section)) return { error: 'Choose Upcoming or Past.' };

  for (const k of ['start_date', 'end_date']) {
    if (input[k] !== undefined) e[k] = input[k] ? String(input[k]) : null;
    if (e[k] && !parseDate(e[k])) return { error: `${label(k)} is not a valid date.` };
  }
  if (e.end_date && !e.start_date) return { error: 'Add a start date, or clear the end date.' };
  if (e.start_date && e.end_date && e.end_date < e.start_date) return { error: 'The end date is before the start date.' };

  for (const k of ['image', 'image_small']) {
    if (input[k] !== undefined) e[k] = String(input[k] || '');
    if (e[k] === undefined || e[k] === null) e[k] = '';
    // Only site-relative paths inside images/ or uploads/ are accepted
    if (e[k] && !/^(images|uploads)\/[a-z0-9\-_\/.]+\.(jpg|jpeg|png|webp)$/i.test(e[k])) return { error: 'That image path is not allowed.' };
    if (e[k] && e[k].includes('..')) return { error: 'That image path is not allowed.' };
  }
  if (input.published !== undefined) e.published = input.published ? 1 : 0;
  if (e.published === undefined) e.published = 1;
  if (!e.media) e.media = 'image';
  return { value: e };
}

function label(k) {
  return { title: 'Title', description: 'Description', tag: 'Category', date_note: 'Date note', location: 'Location',
    image_alt: 'Image description', start_date: 'Start date', end_date: 'End date' }[k] || k;
}

function list({ publishedOnly } = {}) {
  return db.prepare(`
    SELECT e.*, u.name AS updated_by_name
    FROM events e LEFT JOIN users u ON u.id = e.updated_by
    ${publishedOnly ? 'WHERE e.published = 1' : ''}
    ORDER BY e.section DESC, e.sort_order, e.id`).all();   // 'upcoming' before 'past'
}

function get(id) { return db.prepare('SELECT * FROM events WHERE id = ?').get(id); }

function create(e, userId) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) m FROM events WHERE section = ?').get(e.section).m;
  const info = db.prepare(`
    INSERT INTO events (section, title, description, tag, start_date, end_date, date_note, location,
                        image, image_small, image_alt, media, published, sort_order, updated_by)
    VALUES (@section, @title, @description, @tag, @start_date, @end_date, @date_note, @location,
            @image, @image_small, @image_alt, @media, @published, @sort_order, @updated_by)`)
    .run(Object.assign({ start_date: null, end_date: null }, e, { sort_order: max + 10, updated_by: userId || null }));
  return get(info.lastInsertRowid);
}

function update(id, e, userId) {
  const before = get(id);
  // Moving to the other section puts the event at the end of that list
  const sort = before.section !== e.section
    ? db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 m FROM events WHERE section = ?').get(e.section).m
    : before.sort_order;
  db.prepare(`
    UPDATE events SET section=@section, title=@title, description=@description, tag=@tag,
      start_date=@start_date, end_date=@end_date, date_note=@date_note, location=@location,
      image=@image, image_small=@image_small, image_alt=@image_alt, published=@published,
      sort_order=@sort_order, updated_at=datetime('now'), updated_by=@updated_by
    WHERE id=@id`).run(Object.assign({}, e, { id, sort_order: sort, updated_by: userId || null }));
  return get(id);
}

function reorder(section, ids) {
  const tx = db.transaction(() => {
    ids.forEach((id, i) => db.prepare('UPDATE events SET sort_order = ? WHERE id = ? AND section = ?').run((i + 1) * 10, id, section));
  });
  tx();
}

function remove(id) { db.prepare('DELETE FROM events WHERE id = ?').run(id); }

module.exports = { list, get, create, update, reorder, remove, validate, whenLabel, formatDates };
