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
    current = { slug: slug, title: li.querySelector('.job-title').textContent };
    detail.innerHTML = li.querySelector('template[data-detail]').innerHTML;
    document.getElementById('applyTitle').textContent = current.title;
    show('view');
    if (!dlg.open) dlg.showModal();
  }

  function close() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-job-close]')) close();
  });

  // the details they gave when asking for the openings
  function prefill() {
    var f = form.elements;
    if (!f.name.value) f.name.value = document.body.getAttribute('data-lead-name') || '';
    if (!f.email.value) f.email.value = document.body.getAttribute('data-lead-email') || '';
    if (!f.qualification.value) f.qualification.value = document.body.getAttribute('data-lead-education') || '';
  }

  document.getElementById('jobApplyBtn').addEventListener('click', function () {
    prefill();
    show('form');
    err.hidden = true;
    var first = [].filter.call(form.querySelectorAll('input[required]'), function (i) { return !i.value && i.type !== 'file'; })[0];
    (first || form.querySelector('input[name="name"]')).focus();
  });
  document.getElementById('applyBack').addEventListener('click', function () { show('view'); });

  /* ---------- application ---------- */
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
    var f = form.elements;
    // Quick checks in the browser; the server checks everything again
    if (f.name.value.trim().length < 2) return fieldError('name', 'Enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return fieldError('email', 'Enter a valid email address.');
    if (f.phone.value.replace(/\D/g, '').length < 10) return fieldError('phone', 'Enter a valid mobile number (10 digits).');
    if (!f.city.value.trim()) return fieldError('city', 'Enter your current city.');
    if (f.total_exp.value === '') return fieldError('total_exp', 'Enter your total experience in years (0 for freshers).');
    var cv = f.cv.files[0];
    if (!cv) return fieldError('cv', 'Attach your CV (PDF or Word, up to 5 MB).');
    if (!/\.(pdf|docx?)$/i.test(cv.name)) return fieldError('cv', 'Upload your CV as a PDF or Word file.');
    if (cv.size > 5 * 1024 * 1024) return fieldError('cv', 'Your CV must be smaller than 5 MB.');
    if (!f.consent.checked) return fieldError('consent', 'Please agree to the privacy notice so we can review your application.');

    document.getElementById('applyToken').value = token || '';
    submit.disabled = true;
    submit.textContent = 'Sending…';
    fetch('/api/apply/' + encodeURIComponent(current.slug), {
      method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (!res.ok) return fieldError(res.d.field, res.d.error || 'We could not send your application. Please try again.');
      document.getElementById('applyDoneName').textContent = f.name.value.trim().split(' ')[0];
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

  /* ---------- arriving from the emailed link: open the job it pointed to, if any ---------- */
  var slug = (location.search.match(/[?&]job=([w-]+)/) || [])[1];
  if (token && slug) setTimeout(function () { if (cardFor(slug)) open(slug); }, 80);
})();
