/* Careers: the "See open positions" form. The job seeker gives their profile once (the CV comes with their first
   application on the /job page), and the server emails
   them a personal link to the current openings (see server/src/leads.js). Any [data-open-careers] button opens it. */
(function () {
  var ov = document.getElementById('careersModal');
  if (!ov) return;
  var panel = ov.querySelector('.cm-panel'), form = document.getElementById('cmForm'), done = document.getElementById('cmDone'),
      sub = document.getElementById('cmSubmit'), ferr = document.getElementById('cmFormErr'),
      why = document.getElementById('cm-why'), whyN = document.getElementById('cm-why-n'), hint = document.getElementById('cmReadyHint'),
      sending = false, last = null;

  // Same rules as the server (server/src/applications.js and leads.js)
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NAME_RE = /^\p{L}[\p{L}\p{M} .'-]*$/u;
  var LINKEDIN_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/[\w%-]+\/?(\?\S*)?$/i;
  var DEC_RE = /^\d{1,3}(\.\d)?$/;
  function mobileOk(v) { var d = v.replace(/[\s()-]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, ''); return /^[6-9]\d{9}$/.test(d); }
  function ageNow() { var a = document.getElementById('cm-age').value.trim(); return /^\d{2}$/.test(a) ? Number(a) : null; }
  var rules = {
    'cm-name': function (v) { return v.length < 2 ? 'Please enter your full name.' : (!NAME_RE.test(v) ? 'Please use letters only (no numbers or symbols).' : ''); },
    'cm-email': function (v) { return !v ? 'Please enter your email address.' : (!EMAIL_RE.test(v) || v.length > 120 ? 'Please enter a valid email address, like name@example.com.' : ''); },
    'cm-age': function (v) { var n = Number(v); return !v ? 'Please enter your age.' : (!/^\d{2}$/.test(v) || n < 18 || n > 65 ? 'Please enter an age between 18 and 65.' : ''); },
    'cm-marital': function (v) { return !v ? 'Please choose your marital status.' : ''; },
    'cm-edu': function (v) { return v.length < 2 ? 'Please enter your highest qualification.' : (v.length > 120 ? 'Please keep this under 120 characters.' : ''); },
    'cm-phone': function (v) { return !v ? 'Please enter your mobile number.' : (!mobileOk(v) ? 'Please enter a valid 10-digit Indian mobile number, like 98765 43210.' : ''); },
    'cm-city': function (v) { return !v ? 'Please enter your current city.' : (v.length < 2 || !NAME_RE.test(v) ? 'Please enter your city using letters only.' : ''); },
    'cm-exp': function (v) {
      if (v === '') return 'Please enter your total experience in years (0 for freshers).';
      var n = Number(v), age = ageNow();
      if (!DEC_RE.test(v) || n > 50) return 'Please enter years of experience, 0 to 50 (e.g. 4 or 4.5).';
      return age && n > age - 15 ? 'At age ' + age + ', experience can be at most ' + (age - 15) + ' years.' : '';
    },
    'cm-ctc': function (v) { return v && (!DEC_RE.test(v) || Number(v) > 500) ? 'Enter CTC in lakh per annum, 0 to 500 (e.g. 6.5).' : ''; },
    'cm-ectc': function (v) { return v && (!DEC_RE.test(v) || Number(v) > 500) ? 'Enter CTC in lakh per annum, 0 to 500 (e.g. 8).' : ''; },
    'cm-linkedin': function (v) { return v && !LINKEDIN_RE.test(v) ? 'Enter your LinkedIn profile link, like https://www.linkedin.com/in/your-name' : ''; },
    'cm-consent': function (v, el) { return el.checked ? '' : 'Please tick this box to continue.'; },
    'cm-truth': function (v, el) { return el.checked ? '' : 'Please confirm that your details are truthful to continue.'; }
  };
  // the server names fields by their form name; map them back to the inputs
  var byName = { name: 'cm-name', email: 'cm-email', age: 'cm-age', marital_status: 'cm-marital', education: 'cm-edu', consent: 'cm-consent', truthful: 'cm-truth',
    phone: 'cm-phone', city: 'cm-city', total_exp: 'cm-exp', current_ctc: 'cm-ctc', expected_ctc: 'cm-ectc', linkedin: 'cm-linkedin' };
  var ids = Object.keys(rules);

  function msgFor(id) { var el = document.getElementById(id); return rules[id](el.type === 'checkbox' ? '' : el.value.trim(), el); }
  function refresh() {
    var ok = ids.every(function (id) { return !msgFor(id); });
    if (!sending) sub.setAttribute('aria-disabled', ok ? 'false' : 'true');
    hint.hidden = ok;
  }
  function setErr(id, msg) {
    var el = document.getElementById(id), er = document.getElementById(id + '-e');
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) el.setAttribute('aria-describedby', id + '-e'); else el.removeAttribute('aria-describedby');
    er.textContent = msg || '';
  }
  function clearErr() { ids.forEach(function (i) { setErr(i, ''); }); ferr.textContent = ''; }

  ids.forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener(el.type === 'checkbox' || el.type === 'file' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (el.getAttribute('aria-invalid') === 'true' || el.type === 'checkbox')
        setErr(id, el.type === 'checkbox' && !el.checked && el.getAttribute('aria-invalid') !== 'true' ? '' : msgFor(id));
      refresh();
    });
    if (el.type !== 'checkbox' && el.type !== 'file') el.addEventListener('blur', function () { if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') setErr(id, msgFor(id)); });
  });
  why.addEventListener('input', function () { whyN.textContent = why.value.length; });
  var KEEP = { 'cm-age': /[^\d]/g, 'cm-exp': /[^\d.]/g, 'cm-ctc': /[^\d.]/g, 'cm-ectc': /[^\d.]/g, 'cm-phone': /[^\d+ ()-]/g };
  Object.keys(KEEP).forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('input', function () {
      var v = el.value.replace(KEEP[id], '');
      if (id !== 'cm-age' && id !== 'cm-phone') v = v.replace(/^(\d*\.\d?).*$/, '$1');   // one decimal place at most
      if (el.maxLength > 0) v = v.slice(0, el.maxLength);
      if (v !== el.value) el.value = v;
    });
  });
  // experience is checked against age, so re-check it when the age changes
  document.getElementById('cm-age').addEventListener('input', function () {
    var exp = document.getElementById('cm-exp');
    if (exp.value) setErr('cm-exp', msgFor('cm-exp'));
  });

  /* ---------- open / close ---------- */
  function focusables() {
    return [].slice.call(panel.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter(function (e) { return !e.disabled && e.offsetParent !== null; });
  }
  function openM() {
    last = document.activeElement;
    form.reset(); whyN.textContent = '0'; clearErr();
    form.hidden = false; done.hidden = true; sending = false; sub.disabled = false; sub.textContent = 'Send me the link'; refresh();
    ov.hidden = false; document.documentElement.classList.add('cm-lock');
    requestAnimationFrame(function () { ov.classList.add('open'); });
    setTimeout(function () { document.getElementById('cm-name').focus(); }, 60);
  }
  function closeM() {
    ov.classList.remove('open'); document.documentElement.classList.remove('cm-lock');
    setTimeout(function () { ov.hidden = true; }, 220);
    if (last && last.focus) last.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open-careers]');
    if (t) { e.preventDefault(); openM(); }
  });
  ['cmClose', 'cmCancel', 'cmDoneClose'].forEach(function (id) { document.getElementById(id).addEventListener('click', closeM); });
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeM(); });
  ov.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closeM(); return; }
    if (e.key === 'Tab') {
      var f = focusables(); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  /* ---------- send ---------- */
  function validate() {
    var bad = [];
    ids.forEach(function (id) { var m = msgFor(id); setErr(id, m); if (m) bad.push(id); });
    if (bad.length) { document.getElementById(bad[0]).focus(); return null; }
    return { name: document.getElementById('cm-name').value.trim(), email: document.getElementById('cm-email').value.trim() };
  }
  function success(d, delivered) {
    form.hidden = true; done.hidden = false;
    document.getElementById('cmDoneTitle').textContent = delivered ? 'Check your inbox' : 'Thank you';
    document.getElementById('cmDoneSent').hidden = !delivered;
    document.getElementById('cmDoneLater').hidden = delivered;
    [].forEach.call(done.querySelectorAll('.cm-done-name'), function (s) { s.textContent = d.name.split(' ')[0]; });
    [].forEach.call(done.querySelectorAll('.cm-done-email'), function (s) { s.textContent = d.email; });
    done.focus();
  }
  function failed(msg, field) {
    sending = false; sub.disabled = false; sub.textContent = 'Send me the link'; refresh();
    if (field && byName[field]) { setErr(byName[field], msg); document.getElementById(byName[field]).focus(); }
    else ferr.textContent = msg;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    ferr.textContent = '';
    var d = validate();
    if (!d) { refresh(); return; }
    sending = true; sub.disabled = true; sub.removeAttribute('aria-disabled'); sub.textContent = 'Sending…';
    fetch('/api/openings-request', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch' },
      body: new FormData(form)                       // every field + the CV file
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; });
    }).then(function (res) {
      if (!res.ok) return failed(res.b.error || 'We couldn\'t send your request just now. Please try again, or write to us at info@avanamedical.com.', res.b.field);
      success(d, res.b.delivered !== false);
    }).catch(function () {
      failed('We couldn\'t reach our server. Check your connection and try again, or write to us at info@avanamedical.com.');
    });
  });
})();
