/* Careers: the job list on the /job page, the job details dialog and the online application.
   The job list is written by the server on the /job page, reached only from the personal link we email
   (/job?t=…, see server/src/render-jobs.js). Applying needs that link's token. */
(function () {
  var token = document.body.getAttribute('data-openings-token');
  var dlg = document.getElementById('jobDialog');
  if (!dlg) return;

  var detail = document.getElementById('jobDetail');
  var view = document.getElementById('jobView');
  var form = document.getElementById('applyForm');
  var done = document.getElementById('applyDone');
  var err = document.getElementById('applyErr');
  var submit = document.getElementById('applySubmit');
  var current = null;   // { slug, title }

  /* ---------- job list: a job's link opens its details ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-job]');
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('data-job'));
  });

  /* ---------- dialog ---------- */
  function cardFor(slug) {
    var a = document.querySelector('.jobs-list a[data-job="' + slug.replace(/"/g, '') + '"]');
    return a ? a.closest('li') : null;
  }

  function show(which) {
    view.hidden = which !== 'view';
    form.hidden = which !== 'form';
    done.hidden = which !== 'done';
    dlg.querySelector('.job-dlg-in').scrollTop = 0;
  }

  function open(slug) {
    var li = cardFor(slug);
    if (!li) return;
    current = { slug: slug, title: li.querySelector('.job-title').textContent, li: li };
    detail.innerHTML = li.querySelector('template[data-detail]').innerHTML;
    document.getElementById('applyTitle').textContent = current.title;
    var applied = li.hasAttribute('data-applied');
    applyBtn.disabled = applied;
    applyBtn.textContent = applied ? 'You have applied for this job' : 'Apply for this job';
    show('view');
    if (!dlg.open) dlg.showModal();
  }

  function close() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-job-close]')) close();
  });

  /* ---------- one-click apply: the profile and CV they gave when asking for the openings ---------- */
  var me = function (k) { return document.body.getAttribute('data-lead-' + k) || ''; };
  document.getElementById('applyMeName').textContent = me('name');
  document.getElementById('applyMeSub').textContent = [me('email'), me('phone'), me('city')].filter(Boolean).join(' · ');
  document.getElementById('applyMeCv').textContent = me('cv') || 'the CV you sent us';

  var applyBtn = document.getElementById('jobApplyBtn');
  applyBtn.addEventListener('click', function () {
    show('form');
    err.hidden = true;
    submit.focus();
  });
  document.getElementById('applyBack').addEventListener('click', function () { show('view'); });

  function fieldError(name, msg) {
    err.textContent = msg;
    err.hidden = false;
    var el = name && form.elements[name];
    if (el && el.focus) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
  form.addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var cv = form.elements.cv.files[0];          // optional newer CV; the server checks it again
    if (cv && !/\.(pdf|docx?)$/i.test(cv.name)) return fieldError('cv', 'Upload your CV as a PDF or Word file.');
    if (cv && cv.size > 5 * 1024 * 1024) return fieldError('cv', 'Your CV must be smaller than 5 MB.');

    document.getElementById('applyToken').value = token || '';
    submit.disabled = true;
    submit.textContent = 'Sending…';
    fetch('/api/apply/' + encodeURIComponent(current.slug), {
      method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    }).then(function (res) {
      if (!res.ok && res.status !== 409) return fieldError(res.d.field, res.d.error || 'We could not send your application. Please try again.');
      if (cv) document.getElementById('applyMeCv').textContent = cv.name;
      markApplied(current.li);
      document.getElementById('applyDoneName').textContent = me('name').split(' ')[0];
      document.getElementById('applyDoneJob').textContent = current.title;
      form.reset();
      show('done');
      done.focus();
    }).catch(function () {
      fieldError(null, 'We could not reach the server. Check your connection and try again, or email your CV to info@avanamedical.com.');
    }).then(function () {
      submit.disabled = false;
      submit.textContent = 'Submit application';
    });
  });

  function markApplied(li) {
    li.setAttribute('data-applied', '');
    li.classList.add('job-applied');
    var side = li.querySelector('.job-posted');
    if (side) side.outerHTML = '<span class="job-badge">Applied</span>';
  }

  /* ---------- arriving from the emailed link: open the job it pointed to, if any ---------- */
  var slug = (location.search.match(/[?&]job=([\w-]+)/) || [])[1];
  if (token && slug) setTimeout(function () { if (cardFor(slug)) open(slug); }, 80);
})();
