// Builds the site's page from index.html: the Careers openings (render-jobs.js) and, for a section's own
// address, its title, description and link-preview tags (pages.js).
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { renderJobsInto } = require('./render-jobs');
const { seoHead } = require('./pages');

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// With { route, siteUrl } it opens that section with its own title and description (see pages.js).
// With { lead, token } it is a job seeker's personal openings page; { expired: true } adds the "link expired" note.
function renderIndex(opts = {}) {
  let html = fs.readFileSync(path.join(config.siteRoot, 'index.html'), 'utf8');
  html = renderJobsInto(html, opts);
  if (opts.route) html = seoHead(html, opts);
  return html;
}

module.exports = { renderIndex, esc };
