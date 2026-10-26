// Renders the openings. The Careers page does not list or count them: candidates ask for them with the form,
// and the list is on the /job page (<!-- jobs:list -->), reached only from the personal link we email (see leads.js),
// grouped as Marketing & Sales and Others. On /job the rest of the site is hidden (body[data-portal]).
const jobs = require('./jobs');

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  rupee: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h11M7 9h11M7 4c6 0 8 2 8 5s-3 5-8 5l8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const city = loc => String(loc).split(',')[0].trim();
function locSummary(j) {
  const l = j.locations || [];
  if (!l.length) return '';
  return l.length === 1 ? l[0] : `${city(l[0])} +${l.length - 1} more`;
}

function list(items) {
  return items.length ? `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
}

// Full job details, shown in the job dialog on the Careers page
function detail(j) {
  const facts = [
    ['Locations', j.locations.join(' · ')],
    ['Experience', jobs.experienceLabel(j)],
    ['Employment type', j.employment_type],
    ['Work mode', j.work_mode],
    ['Salary', jobs.salaryLabel(j)],
    ['Openings', j.openings > 1 ? `${j.openings} positions` : ''],
    ['Education', j.education],
    ['Notice period', j.notice_period],
    ['Travel', j.travel],
    ['Two-wheeler', j.two_wheeler ? 'Two-wheeler with a valid driving licence required' : ''],
    ['Languages', j.languages.join(', ')],
    ['Reports to', j.reporting_to],
    ['Role category', j.role_category],
    ['Last date to apply', jobs.dateLabel(j.closes_at)]
  ].filter(f => f[1]);
  const sec = (h, s) => { const items = jobs.lines(s); return items.length ? `<h4>${h}</h4>${list(items)}` : ''; };
  return `
      <p class="jd-kicker">${esc(j.department)}<span aria-hidden="true"> · </span>Ref. ${esc(j.ref_code)}${j.posted_at ? `<span aria-hidden="true"> · </span>${esc(jobs.postedLabel(j))}` : ''}</p>
      <h2 class="jd-title" id="jobDlgTitle">${esc(j.title)}</h2>
      <dl class="jd-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${j.summary ? `<h4>About the role</h4><p>${esc(j.summary).replace(/\r?\n/g, '<br>')}</p>` : ''}
      ${sec('Key responsibilities', j.responsibilities)}
      ${sec('What we are looking for', j.requirements)}
      ${sec('Good to have', j.preferred)}
      ${j.skills.length ? `<h4>Key skills</h4><p class="jd-skills">${j.skills.map(s => `<span>${esc(s)}</span>`).join('')}</p>` : ''}
      ${sec('What we offer', j.benefits)}
      <p class="jd-eeo">Avana is an equal opportunity employer. We welcome applications from everyone.</p>`;
}

function card(j, token, applied, preview) {
  const chips = [
    [ICON.pin, locSummary(j)],
    [ICON.bag, [jobs.experienceLabel(j), j.employment_type].filter(Boolean).join(' · ')],
    [ICON.clock, j.work_mode],
    [ICON.rupee, jobs.salaryLabel(j)]
  ].filter(c => c[1]);
  return `<li class="job${applied ? ' job-applied' : ''}"${applied ? ' data-applied' : ''}>
          <a class="job-row" href="${preview ? `/job?preview=${esc(j.slug)}` : `/job?t=${esc(token)}&amp;job=${esc(j.slug)}`}" data-job="${esc(j.slug)}" aria-haspopup="dialog">
            <span class="job-main">
              <span class="job-dept">${esc(j.department)}</span>
              <span class="job-title">${esc(j.title)}</span>
              <span class="job-chips">${chips.map(([i, t]) => `<span>${i}${esc(t)}</span>`).join('')}</span>
            </span>
            <span class="job-side">
              ${applied ? '<span class="job-badge">Applied</span>' : `<span class="job-posted">${esc(jobs.postedLabel(j))}</span>`}
              <span class="job-go">View details<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
            </span>
          </a>
          <template data-detail>${detail(j)}</template>
        </li>`;
}

// The /job page list: Marketing & Sales first, then Others
function listHtml(items, token, applied = [], preview = false) {
  if (!items.length) {
    return `<div class="jobs-empty">
        <p><strong>There are no open positions right now.</strong></p>
        <p>New roles appear on this page as soon as they are posted. You are welcome to send your CV to <a href="mailto:info@avanamedical.com">info@avanamedical.com</a> for future openings.</p>
      </div>`;
  }
  return jobs.CATEGORIES.map((cat, i) => {
    const list = items.filter(j => jobs.category(j) === cat);
    return `<section class="job-cat" aria-labelledby="jobcat-${i}">
        <h2 class="job-cat-h" id="jobcat-${i}">${esc(cat)} <span class="job-cat-n">${list.length} open</span></h2>
        ${list.length
          ? `<ul class="jobs-list">\n          ${list.map(j => card(j, token, applied.includes(j.id), preview)).join('\n          ')}\n        </ul>`
          : '<p class="jobs-none">No openings in this area right now.</p>'}
      </section>`;
  }).join('\n      ');
}

// The Careers page: how many openings there are, and the button to get them by email
// The /job page when the link is missing, wrong or expired
function expiredHtml() {
  return `<div class="jobs-gate">
        <p class="jobs-gate-note" role="status">That openings link has expired or is no longer valid.</p>
        <p class="jobs-gate-lead">Share a few details and we will email you a new link to all our current openings.</p>
        <button type="button" class="btn" data-open-careers>Email me the openings</button>
      </div>`;
}

// opts: { lead, token, applied: [job ids] } on the /job page with a valid link; { expired: true } on /job without one;
// { preview: job } for signed-in staff: the page exactly as candidates see it, with that job open and applying switched off
// (a draft or closed job is added to the list so HR can check it before it goes live).
function renderJobsInto(html, opts = {}) {
  let items = jobs.listPublic();
  if (opts.preview) {
    if (!items.some(j => j.id === opts.preview.id)) items = items.concat(opts.preview);
    html = html.replace(/<body([^>]*)>/i, `<body$1 data-portal${items.length ? ' data-portal-list' : ''} data-preview="${esc(opts.preview.slug)}">`);
    html = html.replace(/<!-- jobs:list -->[\s\S]*?<!-- \/jobs:list -->/,
      `<!-- jobs:list -->\n      ${listHtml(items, '', [], true)}\n      <!-- /jobs:list -->`);
    html = html.replace(/(<p class="jobs-count" id="jobsCount"[^>]*>)[\s\S]*?(<\/p>)/,
      `$1${items.length} open position${items.length === 1 ? '' : 's'}$2`);
    return html.replace(/(<p class="jobs-lead" id="jobsLead">)[\s\S]*?(<\/p>)/,
      '$1<strong>Staff preview.</strong> This is how candidates see the openings. Applying is switched off here.$2');
  }
  const personal = !!opts.lead;
  if (personal || opts.expired) {
    html = html.replace(/<body([^>]*)>/i, `<body$1 data-portal${personal && items.length ? ' data-portal-list' : ''}>`);
    html = html.replace(/<!-- jobs:list -->[\s\S]*?<!-- \/jobs:list -->/,
      `<!-- jobs:list -->\n      ${personal ? listHtml(items, opts.token, opts.applied) : expiredHtml()}\n      <!-- /jobs:list -->`);
  }
  if (personal) {
    html = html.replace(/(<p class="jobs-count" id="jobsCount"[^>]*>)[\s\S]*?(<\/p>)/,
      `$1${items.length ? `${items.length} open position${items.length === 1 ? '' : 's'}` : ''}$2`);
    const first = opts.lead.name.trim().split(/\s+/)[0];
    html = html.replace(/(<p class="jobs-lead" id="jobsLead">)[\s\S]*?(<\/p>)/,
      `$1Hi ${esc(first)}, here are our current openings. Select a role to see the full details and apply online.$2`);
    html = html.replace(/<body([^>]*)>/i,
      `<body$1 data-openings-token="${esc(opts.token)}" data-lead-name="${esc(opts.lead.name)}" data-lead-email="${esc(opts.lead.email)}" ` +
      `data-lead-phone="${esc(opts.lead.phone)}" data-lead-city="${esc(opts.lead.city)}" data-lead-cv="${esc(opts.lead.cv_name)}">`);
  }
  return html;
}

module.exports = { renderJobsInto, detail };
