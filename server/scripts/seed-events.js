// One-time import: copies the event cards currently written in index.html into the database.
// Does nothing if the database already has events (so it can't overwrite admin edits).
//   npm run seed-events
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { db } = require('../src/db');
const events = require('../src/events');

if (db.prepare('SELECT COUNT(*) c FROM events').get().c > 0) {
  console.log('Events already exist in the database; nothing imported.');
  process.exit(0);
}

const html = fs.readFileSync(path.join(config.siteRoot, 'index.html'), 'utf8');
const decode = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const attr = (s, name) => { const m = s.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? decode(m[1]) : ''; };
const inner = (s, re) => { const m = s.match(re); return m ? decode(m[1]) : ''; };

let count = 0;
for (const section of ['upcoming', 'past']) {
  const m = html.match(new RegExp(`<!-- events:${section}:cards -->([\\s\\S]*?)<!-- /events:${section}:cards -->`));
  if (!m) { console.warn('No marked cards for', section); continue; }
  for (const li of m[1].split(/<li class="ev-card/).slice(1)) {
    const isVideo = li.startsWith(' ev-card--video');
    const img = li.match(/<img [^>]*>/);
    const vid = li.match(/<video [^>]*>/);
    const when = inner(li, /<span class="ev-when">([\s\S]*?)<\/span>/);
    // "FY26 · Delhi" → date note + location; "Next cohort · Dates to be announced" stays one note
    let date_note = when, location = '';
    const parts = when.split(' · ');
    if (parts.length === 2 && !/announced/i.test(parts[1])) { date_note = parts[0]; location = parts[1]; }
    const r = events.validate({
      section,
      title: inner(li, /<h3>([\s\S]*?)<\/h3>/),
      description: inner(li, /<p class="ev-desc">([\s\S]*?)<\/p>/),
      tag: inner(li, /<span class="ev-tag">([\s\S]*?)<\/span>/),
      date_note, location,
      image: isVideo ? attr(vid[0], 'poster') : (img ? attr(img[0], 'src') : ''),
      image_alt: isVideo ? attr(vid[0], 'aria-label') : (img ? attr(img[0], 'alt') : ''),
      published: true
    });
    if (r.error) { console.error('Skipped a card:', r.error); continue; }
    if (isVideo) r.value.media = 'video';
    events.create(r.value, null);
    count++;
  }
}
console.log(`Imported ${count} events from index.html.`);
