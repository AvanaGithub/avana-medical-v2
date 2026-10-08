// Renders the Careers page job list (between <!-- jobs:list --> markers in index.html)
// and the extra <head> tags for a single job's page (/jobs/<slug>), including Google Jobs data.
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

function card(j) {
  const chips = [
    [ICON.pin, locSummary(j)],
    [ICON.bag, [jobs.experienceLabel(j), j.employment_type].filter(Boolean).join(' · ')],
    [ICON.clock, j.work_mode],
    [ICON.rupee, jobs.salaryLabel(j)]
  ].filter(c => c[1]);
  const search = [j.title, j.department, j.role_category, j.locations.join(' '), j.skills.join(' '), j.ref_code].join(' ').toLowerCase();
  return `<li class="job" data-dept="${esc(j.department)}" data-cities="${esc(j.locations.map(city).join('|'))}" data-search="${esc(search)}">
          <a class="job-row" href="jobs/${esc(j.slug)}" data-job="${esc(j.slug)}" aria-haspopup="dialog">
            <span class="job-main">
              <span class="job-dept">${esc(j.department)}</span>
              <span class="job-title">${esc(j.title)}</span>
              <span class="job-chips">${chips.map(([i, t]) => `<span>${i}${esc(t)}</span>`).join('')}</span>
            </span>
            <span class="job-side">
              <span class="job-posted">${esc(jobs.postedLabel(j))}</span>
              <span class="job-go">View &amp; apply<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
            </span>
          </a>
          <template data-detail>${detail(j)}</template>
        </li>`;
}

function listHtml(items) {
  if (!items.length) {
    return `<div class="jobs-empty">
        <p><strong>There are no open positions right now.</strong></p>
        <p>New roles are posted here first. You are welcome to send your CV to <a href="mailto:info@avanamedical.com">info@avanamedical.com</a> for future openings.</p>
      </div>`;
  }
  const depts = [...new Set(items.map(j => j.department).filter(Boolean))].sort();
  const cities = [...new Set(items.flatMap(j => j.locations.map(city)))].sort();
  return `<div class="jobs-filters" role="search">
        <label class="jf-search"><span class="sr-only">Search jobs</span>
          <input type="search" id="jobSearch" placeholder="Search by title, skill or city" autocomplete="off"></label>
        <label><span class="sr-only">Department</span>
          <select id="jobDept"><option value="">All departments</option>${depts.map(d => `<option>${esc(d)}</option>`).join('')}</select></label>
        <label><span class="sr-only">Location</span>
          <select id="jobCity"><option value="">All locations</option>${cities.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <ul class="jobs-list" id="jobsList">
        ${items.map(card).join('\n        ')}
      </ul>
      <p class="jobs-none" id="jobsNone" hidden>No openings match your search. Try another department or location.</p>`;
}

function renderJobsInto(html) {
  const items = jobs.listPublic();
  html = html.replace(/<!-- jobs:list -->[\s\S]*?<!-- \/jobs:list -->/, `<!-- jobs:list -->\n      ${listHtml(items)}\n      <!-- /jobs:list -->`);
  html = html.replace(/(<p class="jobs-count" id="jobsCount"[^>]*>)[\s\S]*?(<\/p>)/,
    `$1${items.length ? `${items.length} open position${items.length === 1 ? '' : 's'}` : ''}$2`);
  return html;
}

/* ---------- a single job's page: /jobs/<slug> ---------- */

const EMPLOYMENT = { 'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME', Contract: 'CONTRACTOR', Internship: 'INTERN', Temporary: 'TEMPORARY' };

function jobPostingJsonLd(j, siteUrl) {
  const places = j.locations.map(l => {
    const parts = l.split(',').map(s => s.trim());
    return { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: parts[0], addressRegion: parts[1] || undefined, addressCountry: 'IN' } };
  });
  const desc = [j.summary, ...['responsibilities', 'requirements', 'preferred', 'benefits'].map(k => jobs.lines(j[k]).join('\n'))]
    .filter(Boolean).join('\n\n');
  const data = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: j.title,
    description: `<p>${esc(desc).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
    identifier: { '@type': 'PropertyValue', name: 'Avana Medical Devices', value: j.ref_code },
    datePosted: j.posted_at,
    validThrough: j.closes_at ? j.closes_at + 'T23:59:59+05:30' : undefined,
    employmentType: EMPLOYMENT[j.employment_type],
    hiringOrganization: { '@type': 'Organization', name: 'Avana Medical Devices Pvt. Ltd.', sameAs: siteUrl, logo: siteUrl + '/images/logos/avana-dark.png' },
    jobLocation: places.length ? places : undefined,
    jobLocationType: j.work_mode === 'Remote' ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: j.work_mode === 'Remote' ? { '@type': 'Country', name: 'India' } : undefined,
    directApply: true,
    industry: 'Medical Devices',
    occupationalCategory: j.role_category || undefined,
    educationRequirements: j.education || undefined,
    skills: j.skills.length ? j.skills.join(', ') : undefined,
    experienceRequirements: j.exp_min ? { '@type': 'OccupationalExperienceRequirements', monthsOfExperience: Math.round(j.exp_min * 12) } : undefined,
    baseSalary: j.show_salary && (j.salary_min || j.salary_max) ? {
      '@type': 'MonetaryAmount', currency: 'INR',
      value: { '@type': 'QuantitativeValue', minValue: (j.salary_min || j.salary_max) * 1e5, maxValue: (j.salary_max || j.salary_min) * 1e5, unitText: 'YEAR' }
    } : undefined
  };
  // "</" can't appear inside the script tag
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function jobPageHead(html, j, siteUrl) {
  const title = `${j.title} · Careers · Avana Medical Devices`;
  const description = (j.summary || `${j.title} at Avana Medical Devices`).replace(/\s+/g, ' ').slice(0, 155);
  const url = `${siteUrl}/jobs/${j.slug}`;
  const head = `<base href="/">
  <link rel="canonical" href="${esc(url)}">
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <script type="application/ld+json">${jobPostingJsonLd(j, siteUrl)}</script>`;
  return html
    .replace(/<head>/i, `<head>\n  ${head}`)
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<body([^>]*)>/i, `<body$1 data-open-job="${esc(j.slug)}">`);
}

module.exports = { renderJobsInto, jobPageHead, detail };
