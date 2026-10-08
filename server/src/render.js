// Fills the News & Events carousels in index.html with events from the database.
// index.html marks each carousel with HTML comments:
//   <!-- events:upcoming --> <section>…<!-- events:upcoming:cards -->…cards…<!-- /events:upcoming:cards -->…</section> <!-- /events:upcoming -->
// The static cards between the markers are what GitHub Pages (or a server without a database) shows.
const fs = require('fs');
const path = require('path');
const config = require('./config');
const events = require('./events');

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pad = n => (n < 10 ? '0' : '') + n;

const PAUSE_PLAY = `
                <svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor"/></svg>
                <svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>`;

function media(e, isFirstVideo) {
  const alt = esc(e.image_alt || e.title);
  if (e.media === 'video' && isFirstVideo) {
    // The highlights film: main.js and videos.js look for these exact ids
    return `<div class="ev-media">
              <video class="ev-vid" id="evVideo" muted loop playsinline preload="auto" poster="${esc(e.image)}" aria-label="${alt}"></video>
              <span class="ev-badge" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>Video</span>
              <button class="vid-toggle ev-vbtn" id="evVideoToggle" type="button" aria-label="Pause highlights film" aria-pressed="false">${PAUSE_PLAY}
              </button>
            </div>`;
  }
  if (!e.image) return '<div class="ev-media"></div>';
  const srcset = e.image_small ? ` srcset="${esc(e.image_small)} 800w, ${esc(e.image)} 1600w" sizes="(max-width:640px) 88vw, (max-width:980px) 80vw, 560px"` : '';
  return `<div class="ev-media"><img src="${esc(e.image)}"${srcset} alt="${alt}" loading="lazy" width="1600" height="1000"></div>`;
}

function card(e, i, n, isFirstVideo) {
  const when = events.whenLabel(e);
  return `<li class="ev-card${e.media === 'video' && isFirstVideo ? ' ev-card--video' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}">
          <article>
            ${media(e, isFirstVideo)}
            <div class="ev-cap">
              <p class="ev-meta">${e.tag ? `<span class="ev-tag">${esc(e.tag)}</span>` : ''}${when ? `<span class="ev-when">${esc(when)}</span>` : ''}</p>
              <h3>${esc(e.title)}</h3>
              ${e.description ? `<p class="ev-desc">${esc(e.description)}</p>` : ''}
            </div>
          </article>
        </li>`;
}

function fillSection(html, section, list, videoUsed) {
  const open = `<!-- events:${section} -->`, close = `<!-- /events:${section} -->`;
  const a = html.indexOf(open), b = html.indexOf(close);
  if (a < 0 || b < a) return { html, videoUsed };
  // No published events: leave the whole section out (the carousel needs at least one card)
  if (!list.length) return { html: html.slice(0, a) + html.slice(b + close.length), videoUsed };

  let block = html.slice(a, b + close.length);
  const n = list.length;
  const cards = list.map((e, i) => {
    const first = e.media === 'video' && !videoUsed;
    if (first) videoUsed = true;
    return card(e, i, n, first);
  }).join('\n        ');
  block = block.replace(
    new RegExp(`<!-- events:${section}:cards -->[\\s\\S]*?<!-- /events:${section}:cards -->`),
    `<!-- events:${section}:cards -->\n        ${cards}\n        <!-- /events:${section}:cards -->`);
  block = block.replace(/(<ul class="ev-track"[^>]*aria-label="[^"]*?: )\d+ events?(")/, `$1${n} event${n === 1 ? '' : 's'}$2`);
  block = block.replace(/<span class="ev-count" aria-hidden="true">[\s\S]*?<\/span>/, `<span class="ev-count" aria-hidden="true"><b>01</b> / ${pad(n)}</span>`);
  return { html: html.slice(0, a) + block + html.slice(b + close.length), videoUsed };
}

function renderIndex() {
  let html = fs.readFileSync(path.join(config.siteRoot, 'index.html'), 'utf8');
  const all = events.list({ publishedOnly: true });
  let videoUsed = false;
  for (const section of ['upcoming', 'past']) {
    const r = fillSection(html, section, all.filter(e => e.section === section), videoUsed);
    html = r.html; videoUsed = r.videoUsed;
  }
  return html;
}

module.exports = { renderIndex, esc };
