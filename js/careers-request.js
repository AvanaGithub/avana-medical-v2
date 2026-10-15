/* Careers: the "See open positions" form. The job seeker shares a few details and the server emails
   them a personal link to the current openings (see server/src/leads.js). Any [data-open-careers] button opens it. */
(function () {
  var ov = document.getElementById('careersModal');
  if (!ov) return;
  var panel = ov.querySelector('.cm-panel'), form = document.getElementById('cmForm'), done = document.getElementById('cmDone'),
      sub = document.getElementById('cmSubmit'), ferr = document.getElementById('cmFormErr'),
      why = document.getElementById('cm-why'), whyN = document.getElementById('cm-why-n'), hint = document.getElementById('cmReadyHint'),
      sending = false, last = null;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var rules = {
    'cm-name': function (v) { return v.length < 2 ? 'Please enter your full name.' : ''; },
    'cm-email': function (v) { return !v ? 'Please enter your email address.' : (!EMAIL_RE.test(v) ? 'Please enter a valid email address, like name@example.com.' : ''); },
    'cm-age': function (v) { var n = Number(v); return !v ? 'Please enter your age.' : (!Number.isInteger(n) || n < 18 || n > 65 ? 'Please enter an age between 18 and 65.' : ''); },
    'cm-marital': function (v) { return !v ? 'Please choose your marital status.' : ''; },
    'cm-edu': function (v) { return v.length < 2 ? 'Please enter your highest qualification.' : ''; },
    'cm-consent': function (v, el) { return el.checked ? '' : 'Please tick this box to continue.'; },
    'cm-truth': function (v, el) { return el.checked ? '' : 'Please confirm that your details are truthful to continue.'; }
  };
  // the server names fields by their form name; map them back to the inputs
  var byName = { name: 'cm-name', email: 'cm-email', age: 'cm-age', marital_status: 'cm-marital', education: 'cm-edu', consent: 'cm-consent', truthful: 'cm-truth' };
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
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (el.getAttribute('aria-invalid') === 'true' || el.type === 'checkbox')
        setErr(id, el.type === 'checkbox' && !el.checked && el.getAttribute('aria-invalid') !== 'true' ? '' : msgFor(id));
      refresh();
    });
    if (el.type !== 'checkbox') el.addEventListener('blur', function () { if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') setErr(id, msgFor(id)); });
  });
  why.addEventListener('input', function () { whyN.textContent = why.value.length; });

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
    var v = function (id) { return document.getElementById(id).value.trim(); };
    return { name: v('cm-name'), email: v('cm-email'), age: Number(v('cm-age')), marital_status: v('cm-marital'), education: v('cm-edu'),
      why_join: why.value.trim(), consent: true, truthful: true, website: document.getElementById('cm-website').value };
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
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify(d)
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
