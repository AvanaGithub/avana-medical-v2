/* Careers: job list filters, job details dialog and online application.
   The job list itself is written into the page by the server (see server/src/render-jobs.js). */
(function () {
  var list = document.getElementById('jobsList');
  var dlg = document.getElementById('jobDialog');
  if (!dlg) return;

  var detail = document.getElementById('jobDetail');
  var view = document.getElementById('jobView');
  var form = document.getElementById('applyForm');
  var done = document.getElementById('applyDone');
  var err = document.getElementById('applyErr');
  var submit = document.getElementById('applySubmit');
  var current = null;   // { slug, title }

  /* ---------- filters ---------- */
  if (list) {
    var q = document.getElementById('jobSearch'), dept = document.getElementById('jobDept'), cityF = document.getElementById('jobCity');
    var none = document.getElementById('jobsNone'), count = document.getElementById('jobsCount');
    var total = list.children.length;
    function filter() {
      var words = (q.value || '').toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      [].forEach.call(list.children, function (li) {
        var ok = (!dept.value || li.getAttribute('data-dept') === dept.value)
          && (!cityF.value || li.getAttribute('data-cities').split('|').indexOf(cityF.value) > -1)
          && words.every(function (w) { return li.getAttribute('data-search').indexOf(w) > -1; });
        li.hidden = !ok;
        if (ok) shown++;
      });
      none.hidden = shown > 0;
      count.textContent = shown === total ? total + (total === 1 ? ' open position' : ' open positions') : 'Showing ' + shown + ' of ' + total;
    }
    [q, dept, cityF].forEach(function (el) { el.addEventListener('input', filter); });

    list.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-job]');
      if (!a) return;
      e.preventDefault();
      open(a.getAttribute('data-job'));
    });
  }

  /* ---------- dialog ---------- */
  function cardFor(slug) {
    var a = list && list.querySelector('a[data-job="' + slug.replace(/"/g, '') + '"]');
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
    try { history.replaceState(null, '', 'jobs/' + slug); } catch (e) { /* file:// */ }
  }

  function close() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('close', function () {
    try { if (/\/jobs\//.test(location.pathname)) history.replaceState(null, '', '/#careers'); } catch (e) { /* ignore */ }
  });
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-job-close]')) close();
  });

  document.getElementById('jobApplyBtn').addEventListener('click', function () {
    show('form');
    err.hidden = true;
    form.querySelector('input[name="name"]').focus();
  });
  document.getElementById('applyBack').addEventListener('click', function () { show('view'); });

  document.getElementById('jobShareBtn').addEventListener('click', function () {
    var btn = this, url = location.origin + '/jobs/' + current.slug;
    var fallback = function () { window.prompt('Copy this link:', url); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
      btn.textContent = 'Link copied'; setTimeout(function () { btn.textContent = 'Copy link'; }, 2000);
    }, fallback); else fallback();
  });

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

  /* ---------- opened from a job link (/jobs/<slug>) ---------- */
  var slug = document.body.getAttribute('data-open-job');
  if (slug) {
    location.hash = 'careers';
    setTimeout(function () { open(slug); }, 60);
  }
})();
