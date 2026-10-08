/* Avana Medical — website admin panel. Talks to /api; no framework. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { user: null, events: [], section: 'upcoming', editing: null, pendingImage: null, users: [], editingUser: null };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- helpers ---------- */

  async function api(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + url, opts);
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (res.status === 401 && url !== '/auth/login' && url !== '/auth/me') { showLogin(); throw new Error('Please sign in again.'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 6000 : 3000);
  }

  function showError(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }

  // Same formatting as the server, for the live preview
  function formatDates(a, b) {
    const p = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { d: +m[3], m: MONTHS[+m[2] - 1], y: +m[1] } : null; };
    const A = p(a), B = p(b);
    if (!A) return '';
    if (!B || (A.d === B.d && A.m === B.m && A.y === B.y)) return `${A.d} ${A.m} ${A.y}`;
    if (A.y !== B.y) return `${A.d} ${A.m} ${A.y} – ${B.d} ${B.m} ${B.y}`;
    if (A.m !== B.m) return `${A.d} ${A.m} – ${B.d} ${B.m} ${A.y}`;
    return `${A.d}–${B.d} ${A.m} ${A.y}`;
  }
  const whenLabel = e => [formatDates(e.start_date, e.end_date) || e.date_note, e.location].filter(Boolean).join(' · ');

  function ago(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    const mins = Math.round((Date.now() - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 60 * 24) return Math.round(mins / 60) + ' h ago';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function confirmDialog(title, text, yesLabel) {
    return new Promise(resolve => {
      const d = $('confirmDialog');
      $('confirmTitle').textContent = title;
      $('confirmText').textContent = text;
      $('confirmYes').textContent = yesLabel || 'Delete';
      const done = v => { d.close(); resolve(v); };
      $('confirmYes').onclick = () => done(true);
      d.onclose = () => resolve(false);
      d.showModal();
    });
  }

  // Close buttons and backdrop clicks for every dialog
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) d.close();
      else if (e.target === d && !['eventDialog', 'jobDialog'].includes(d.id)) d.close();   // long forms: don't lose work on a stray click
    });
  });

  /* ---------- sign in / routing ---------- */

  function showLogin() {
    state.user = null;
    $('appView').hidden = true;
    $('loginView').hidden = false;
    setTimeout(() => $('loginEmail').focus(), 0);
  }

  function showApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('whoName').textContent = state.user.name;
    $('accountWho').textContent = `${state.user.name} · ${state.user.email} · ${state.user.role === 'admin' ? 'Admin' : 'Editor'}`;
    document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = state.user.role !== 'admin'; });
    route();
  }

  function route() {
    let view = (location.hash || '#events').slice(1);
    if (!['events', 'jobs', 'applications', 'users', 'account'].includes(view) || (view === 'users' && state.user.role !== 'admin')) view = 'events';
    document.querySelectorAll('[data-view-panel]').forEach(p => { p.hidden = p.dataset.viewPanel !== view; });
    document.querySelectorAll('.tabs a').forEach(a => a.toggleAttribute('aria-current', a.dataset.view === view));
    document.querySelectorAll('.tabs a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
    if (view === 'events') loadEvents();
    if (view === 'jobs') loadJobs();
    if (view === 'applications') loadApplications();
    if (view === 'users') loadUsers();
    refreshBadge();
  }
  window.addEventListener('hashchange', () => state.user && route());

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    showError($('loginError'));
    const btn = e.submitter || $('loginForm').querySelector('button');
    btn.disabled = true;
    try {
      const r = await api('POST', '/auth/login', { email: $('loginEmail').value, password: $('loginPassword').value });
      state.user = r.user;
      $('loginPassword').value = '';
      showApp();
    } catch (err) {
      showError($('loginError'), err.message);
    } finally { btn.disabled = false; }
  });

  $('logoutBtn').addEventListener('click', async () => {
    try { await api('POST', '/auth/logout'); } catch (e) { /* ignore */ }
    showLogin();
  });

  /* ---------- events list ---------- */

  async function loadEvents() {
    try {
      state.events = (await api('GET', '/admin/events')).events;
      renderEvents();
    } catch (e) { toast(e.message, true); }
  }

  function renderEvents() {
    const list = state.events.filter(e => e.section === state.section);
    $('countUpcoming').textContent = state.events.filter(e => e.section === 'upcoming').length;
    $('countPast').textContent = state.events.filter(e => e.section === 'past').length;
    document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.section === state.section)));
    $('sectionHint').textContent = state.section === 'upcoming'
      ? 'Shown first on the News & Events page, in this order. Move events to "Moments we\'ve shared" once they have happened.'
      : 'Shown in the dark "Moments we\'ve shared" section, in this order.';
    $('eventsEmpty').hidden = list.length > 0;

    const today = new Date().toISOString().slice(0, 10);
    $('eventList').innerHTML = list.map((e, i) => {
      const over = e.section === 'upcoming' && (e.end_date || e.start_date) && (e.end_date || e.start_date) < today;
      return `<li class="ev-row${e.published ? '' : ' is-hidden'}" data-id="${e.id}">
        <div class="order">
          <button type="button" data-act="up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-act="down" aria-label="Move down" ${i === list.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div class="ev-thumb" style="${e.image ? `background-image:url('/${esc(e.image_small || e.image)}')` : ''}">${e.media === 'video' ? '<span class="vid">▶ Video</span>' : ''}</div>
        <div class="ev-info">
          <h3 title="${esc(e.title)}">${esc(e.title)}</h3>
          <div class="ev-sub">
            ${e.published ? '<span class="chip chip-live">Published</span>' : '<span class="chip chip-off">Hidden</span>'}
            ${over ? '<span class="chip chip-warn">Date has passed</span>' : ''}
            ${e.tag ? `<span class="chip chip-tag">${esc(e.tag)}</span>` : ''}
            <span>${esc(whenLabel(e)) || '<em>No date</em>'}</span>
          </div>
          <div class="ev-edited">${e.updated_by_name ? 'Edited by ' + esc(e.updated_by_name) + ' · ' : 'Imported · '}${ago(e.updated_at)}</div>
        </div>
        <div class="ev-actions">
          ${over ? '<button class="btn btn-ghost btn-sm" type="button" data-act="move">Move to past</button>' : ''}
          <button class="btn btn-ghost btn-sm" type="button" data-act="toggle">${e.published ? 'Hide' : 'Publish'}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="edit">Edit</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="delete" aria-label="Delete ${esc(e.title)}">Delete</button>
        </div>
      </li>`;
    }).join('');
  }

  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { state.section = b.dataset.section; renderEvents(); }));

  $('eventList').addEventListener('click', async ev => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.ev-row').dataset.id);
    const e = state.events.find(x => x.id === id);
    const act = btn.dataset.act;
    try {
      if (act === 'edit') return openEditor(e);
      if (act === 'toggle') {
        await api('PUT', `/admin/events/${id}`, { published: !e.published });
        toast(e.published ? 'Hidden from the website.' : 'Published on the website.');
      }
      if (act === 'move') {
        await api('PUT', `/admin/events/${id}`, { section: 'past' });
        toast('Moved to "Moments we\'ve shared".');
      }
      if (act === 'delete') {
        if (!await confirmDialog('Delete this event?', `"${e.title}" will be removed from the website. This can't be undone.`)) return;
        await api('DELETE', `/admin/events/${id}`);
        toast('Event deleted.');
      }
      if (act === 'up' || act === 'down') {
        const ids = state.events.filter(x => x.section === state.section).map(x => x.id);
        const i = ids.indexOf(id), j = act === 'up' ? i - 1 : i + 1;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        await api('POST', '/admin/events/reorder', { section: state.section, ids });
      }
      await loadEvents();
    } catch (err) { toast(err.message, true); }
  });

  /* ---------- event editor ---------- */

  const form = $('eventForm');
  const fields = { title: 'evTitle', description: 'evDesc', tag: 'evTag', location: 'evLocation', start_date: 'evStart', end_date: 'evEnd', date_note: 'evNote', image_alt: 'evAlt' };

  $('addEventBtn').addEventListener('click', () => openEditor(null));

  function openEditor(e) {
    state.editing = e;
    state.pendingImage = e ? { image: e.image, image_small: e.image_small } : null;
    $('eventDialogTitle').textContent = e ? 'Edit event' : 'Add event';
    form.reset();
    for (const [k, id] of Object.entries(fields)) $(id).value = e ? (e[k] || '') : '';
    form.querySelector(`input[name="section"][value="${e ? e.section : state.section}"]`).checked = true;
    $('evPublished').checked = e ? !!e.published : true;
    if (!e && state.section === 'upcoming') $('evNote').value = 'Dates to be announced';
    $('videoNote').hidden = !(e && e.media === 'video');
    $('imageStatus').textContent = e && e.image ? 'Current image kept unless you choose a new one.' : 'JPG, PNG or WebP, ideally 1600 px wide or more.';
    $('chooseImageBtn').textContent = e && e.image ? 'Replace image…' : 'Choose image…';
    $('eventMeta').textContent = e ? (e.updated_by_name ? `Last edited by ${e.updated_by_name}, ${ago(e.updated_at)}` : `Imported ${ago(e.updated_at)}`) : '';
    // suggestions for the category field
    const tags = [...new Set(state.events.map(x => x.tag).filter(Boolean))].sort();
    $('tagList').innerHTML = tags.map(t => `<option value="${esc(t)}">`).join('');
    showError($('eventError'));
    updatePreview();
    updateCounter();
    $('eventDialog').showModal();
    $('evTitle').focus();
  }

  function formValues() {
    const v = {};
    for (const [k, id] of Object.entries(fields)) v[k] = $(id).value.trim();
    v.section = form.querySelector('input[name="section"]:checked').value;
    v.published = $('evPublished').checked;
    v.start_date = v.start_date || null;
    v.end_date = v.end_date || null;
    if (state.pendingImage) { v.image = state.pendingImage.image || ''; v.image_small = state.pendingImage.image_small || ''; }
    return v;
  }

  function updatePreview() {
    const v = formValues();
    $('pvTitle').textContent = v.title || 'Event title';
    $('pvDesc').textContent = v.description;
    $('pvTag').textContent = v.tag;
    $('pvWhen').textContent = whenLabel(v);
    const img = state.pendingImage && (state.pendingImage.preview || state.pendingImage.image);
    const media = $('pvMedia');
    media.style.backgroundImage = img ? `url('${img.startsWith('blob:') || img.startsWith('data:') ? img : '/' + img}')` : '';
    media.querySelector('.pv-empty').hidden = !!img;
  }
  function updateCounter() { $('evDesc').nextElementSibling.textContent = `${$('evDesc').value.length} / 400`; }

  form.addEventListener('input', e => { updatePreview(); if (e.target.id === 'evDesc') updateCounter(); });
  form.addEventListener('change', updatePreview);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    showError($('eventError'));
    const v = formValues();
    if (!v.title) { showError($('eventError'), 'Add a title.'); $('evTitle').focus(); return; }
    if (v.end_date && !v.start_date) { showError($('eventError'), 'Add a start date, or clear the end date.'); return; }
    if (!v.image_alt && v.image) v.image_alt = v.title;
    const btn = $('saveEventBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (state.editing) await api('PUT', `/admin/events/${state.editing.id}`, v);
      else await api('POST', '/admin/events', v);
      $('eventDialog').close();
      state.section = v.section;
      toast(v.published ? 'Saved. It is live on the website.' : 'Saved as hidden.');
      await loadEvents();
    } catch (err) {
      showError($('eventError'), err.message);
    } finally { btn.disabled = false; btn.textContent = 'Save event'; }
  });

  /* ---------- image: choose → crop 16:10 → upload ---------- */

  let cropper = null, cropFile = null;
  $('chooseImageBtn').addEventListener('click', () => $('evFile').click());
  $('evFile').addEventListener('change', () => {
    const f = $('evFile').files[0];
    $('evFile').value = '';
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { toast('Choose a JPG, PNG or WebP image.', true); return; }
    if (f.size > 20 * 1024 * 1024) { toast('That image is larger than 20 MB.', true); return; }
    cropFile = f;
    const url = URL.createObjectURL(f);
    const img = $('cropImg');
    img.onload = () => {
      $('cropWarn').hidden = img.naturalWidth >= 1200;
      $('cropWarn').textContent = `This photo is only ${img.naturalWidth} px wide, so it may look soft on large screens. 1600 px or wider is best.`;
      if (cropper) cropper.destroy();
      cropper = new Cropper(img, { aspectRatio: 16 / 10, viewMode: 1, autoCropArea: 1, dragMode: 'move', background: false, responsive: true, toggleDragModeOnDblclick: false });
    };
    img.src = url;
    $('cropDialog').showModal();
  });
  $('zoomIn').addEventListener('click', () => cropper && cropper.zoom(0.1));
  $('zoomOut').addEventListener('click', () => cropper && cropper.zoom(-0.1));
  $('cropReset').addEventListener('click', () => cropper && cropper.reset());
  $('cropDialog').addEventListener('close', () => { if (cropper) { cropper.destroy(); cropper = null; } });

  $('cropUse').addEventListener('click', async () => {
    if (!cropper || !cropFile) return;
    const data = cropper.getData(true);  // pixels of the original photo
    const preview = cropper.getCroppedCanvas({ width: 800, height: 500 }).toDataURL('image/jpeg', 0.8);
    const fd = new FormData();
    fd.append('image', cropFile);
    fd.append('crop', JSON.stringify({ x: data.x, y: data.y, width: data.width, height: data.height }));
    const btn = $('cropUse');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const r = await api('POST', '/admin/uploads', fd);
      state.pendingImage = { image: r.image, image_small: r.image_small, preview };
      $('imageStatus').textContent = `New image ready (${r.kb} KB). Save the event to use it.`;
      $('chooseImageBtn').textContent = 'Replace image…';
      if (!$('evAlt').value) $('evAlt').placeholder = 'Describe the photo, e.g. "Partners on stage at the Dealers Meet"';
      $('cropDialog').close();
      updatePreview();
    } catch (err) {
      toast(err.message, true);
    } finally { btn.disabled = false; btn.textContent = 'Use this crop'; }
  });

  /* ---------- jobs ---------- */

  const jstate = { jobs: [], options: null, status: 'open', editing: null };
  const jform = $('jobForm');
  const LIST_FIELDS = ['locations', 'skills', 'languages'];
  const fmt = n => (n === null || n === undefined ? '' : String(n));

  async function refreshBadge() {
    try {
      const r = await api('GET', '/admin/jobs');
      jstate.jobs = r.jobs; jstate.options = r.options;
      const n = r.applications.fresh || 0;
      $('newAppsBadge').textContent = n; $('newAppsBadge').hidden = !n;
    } catch (e) { /* ignore */ }
  }

  async function loadJobs() {
    try {
      const r = await api('GET', '/admin/jobs');
      jstate.jobs = r.jobs; jstate.options = r.options;
      renderJobs();
    } catch (e) { toast(e.message, true); }
  }

  function jobWhere(j) {
    const l = j.locations || [];
    return l.length > 2 ? `${l[0].split(',')[0]}, ${l[1].split(',')[0]} +${l.length - 2}` : l.map(x => x.split(',')[0]).join(', ');
  }

  function renderJobs() {
    const by = s => jstate.jobs.filter(j => j.status === s);
    $('jcOpen').textContent = by('open').length; $('jcDraft').textContent = by('draft').length; $('jcClosed').textContent = by('closed').length;
    document.querySelectorAll('[data-jstatus]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.jstatus === jstate.status)));
    const list = by(jstate.status);
    $('jobsEmpty').hidden = list.length > 0;
    const today = new Date().toISOString().slice(0, 10);
    $('jobList').innerHTML = list.map((j, i) => {
      const expired = j.status === 'open' && j.closes_at && j.closes_at < today;
      return `<li class="ev-row job" data-id="${j.id}">
        <div class="order">
          <button type="button" data-act="up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-act="down" aria-label="Move down" ${i === list.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div class="ev-info">
          <h3 title="${esc(j.title)}">${esc(j.title)}</h3>
          <div class="ev-sub">
            ${j.status === 'open' ? (expired ? '<span class="chip chip-warn">Last date passed · hidden</span>' : '<span class="chip chip-live">On website</span>') : j.status === 'draft' ? '<span class="chip chip-off">Draft</span>' : '<span class="chip chip-off">Closed</span>'}
            ${j.department ? `<span class="chip chip-tag">${esc(j.department)}</span>` : ''}
            <span>${esc(j.ref_code)}</span>
            ${jobWhere(j) ? `<span>${esc(jobWhere(j))}</span>` : ''}
            ${j.experience ? `<span>${esc(j.experience)}</span>` : ''}
          </div>
          <div class="job-row-meta">
            <a class="applicants" href="#applications" data-act="apps">${j.applicants} applicant${j.applicants === 1 ? '' : 's'}${j.new_applicants ? `<span class="new">${j.new_applicants} new</span>` : ''}</a>
            ${j.posted_at ? `<span>Posted ${esc(j.posted_at)}</span>` : ''}${j.closes_at ? `<span>Apply by ${esc(j.closes_at)}</span>` : ''}
            <span>${j.updated_by_name ? 'Edited by ' + esc(j.updated_by_name) + ' · ' : ''}${ago(j.updated_at)}</span>
          </div>
        </div>
        <div class="ev-actions">
          ${j.status === 'open' ? '<button class="btn btn-ghost btn-sm" type="button" data-act="close">Close job</button>' : `<button class="btn btn-ghost btn-sm" type="button" data-act="open">${j.status === 'draft' ? 'Publish' : 'Reopen'}</button>`}
          ${j.live ? `<a class="btn btn-ghost btn-sm" href="/jobs/${esc(j.slug)}" target="_blank" rel="noopener">View</a>` : ''}
          <button class="btn btn-ghost btn-sm" type="button" data-act="edit">Edit</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="dup">Duplicate</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="delete" aria-label="Delete ${esc(j.title)}">Delete</button>
        </div>
      </li>`;
    }).join('');
  }

  document.querySelectorAll('[data-jstatus]').forEach(b => b.addEventListener('click', () => { jstate.status = b.dataset.jstatus; renderJobs(); }));

  $('jobList').addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.ev-row').dataset.id);
    const j = jstate.jobs.find(x => x.id === id);
    const act = btn.dataset.act;
    try {
      if (act === 'edit') return openJob(j);
      if (act === 'apps') { appFilter.job = String(id); return; }      // the link itself switches to #applications
      if (act === 'open' || act === 'close') {
        await api('PUT', `/admin/jobs/${id}`, { status: act === 'open' ? 'open' : 'closed' });
        toast(act === 'open' ? 'Job is now on the Careers page.' : 'Job closed and removed from the Careers page.');
        jstate.status = act === 'open' ? 'open' : 'closed';
      }
      if (act === 'dup') {
        const r = await api('POST', `/admin/jobs/${id}/duplicate`);
        toast('Copy saved as a draft.');
        jstate.status = 'draft';
        await loadJobs();
        return openJob(r.job);
      }
      if (act === 'delete') {
        const msg = j.applicants ? `"${j.title}" has ${j.applicants} application(s). They will be kept, but the job will be gone. Closing the job is usually better.` : `"${j.title}" will be removed permanently.`;
        if (!await confirmDialog('Delete this job?', msg)) return;
        await api('DELETE', `/admin/jobs/${id}`);
        toast('Job deleted.');
      }
      if (act === 'up' || act === 'down') {
        const ids = jstate.jobs.filter(x => x.status === jstate.status).map(x => x.id);
        const i = ids.indexOf(id), k = act === 'up' ? i - 1 : i + 1;
        [ids[i], ids[k]] = [ids[k], ids[i]];
        // keep other statuses' order after these
        await api('POST', '/admin/jobs/reorder', { ids: ids.concat(jstate.jobs.filter(x => x.status !== jstate.status).map(x => x.id)) });
      }
      await loadJobs();
    } catch (err) { toast(err.message, true); }
  });

  $('addJobBtn').addEventListener('click', () => openJob(null));

  function fillSelect(sel, opts, labels) {
    sel.innerHTML = opts.map(o => `<option value="${esc(o)}">${esc((labels && labels[o]) || o || 'Not specified')}</option>`).join('');
  }

  async function openJob(j) {
    if (!jstate.options) await loadJobs();
    const o = jstate.options;
    jstate.editing = j;
    jform.reset();
    fillSelect(jform.elements.employment_type, o.employment_type);
    fillSelect(jform.elements.work_mode, o.work_mode);
    fillSelect(jform.elements.notice_period, o.notice_period);
    fillSelect(jform.elements.travel, o.travel);
    $('deptList').innerHTML = [...new Set(o.departments.concat(jstate.jobs.map(x => x.department).filter(Boolean)))].map(d => `<option value="${esc(d)}">`).join('');
    $('jobDialogTitle').textContent = j ? `Edit job · ${j.ref_code}` : 'Post a job';
    const v = j || { employment_type: 'Full-time', work_mode: 'Field-based', openings: 1, status: 'draft', notice_period: '', travel: '' };
    for (const el of jform.elements) {
      if (!el.name) continue;
      const val = v[el.name];
      if (el.type === 'checkbox') el.checked = !!val;
      else if (LIST_FIELDS.includes(el.name)) el.value = (val || []).join(el.tagName === 'TEXTAREA' ? '\n' : ', ');
      else el.value = fmt(val);
    }
    $('jobMeta').textContent = j ? `${j.applicants} applicant(s) · ${j.updated_by_name ? 'last edited by ' + j.updated_by_name + ', ' : ''}${ago(j.updated_at)}` : 'New jobs start as drafts until you set the status to Open.';
    showError($('jobError'));
    $('jobDialog').showModal();
    jform.elements.title.focus();
  }

  jform.addEventListener('submit', async e => {
    e.preventDefault();
    showError($('jobError'));
    const body = {};
    for (const el of jform.elements) {
      if (!el.name) continue;
      body[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    }
    const btn = $('saveJobBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (jstate.editing) await api('PUT', `/admin/jobs/${jstate.editing.id}`, body);
      else await api('POST', '/admin/jobs', body);
      $('jobDialog').close();
      jstate.status = body.status;
      toast(body.status === 'open' ? 'Saved. The job is on the Careers page.' : body.status === 'draft' ? 'Saved as a draft (not on the website).' : 'Saved as closed.');
      await loadJobs();
    } catch (err) {
      showError($('jobError'), err.message);
      $('jobError').scrollIntoView({ block: 'nearest' });
    } finally { btn.disabled = false; btn.textContent = 'Save job'; }
  });

  /* ---------- applications ---------- */

  const STATUS = { new: 'New', shortlisted: 'Shortlisted', interview: 'Interview', offered: 'Offered', hired: 'Hired', rejected: 'Rejected' };
  const appFilter = { job: '', status: '' };
  let apps = [], openApp = null;
  fillSelect($('appStatusFilter'), [''].concat(Object.keys(STATUS)), Object.assign({ '': 'All statuses' }, STATUS));
  fillSelect($('appStatus'), Object.keys(STATUS), STATUS);

  async function loadApplications() {
    try {
      if (!jstate.options) await loadJobs();
      $('appJobFilter').innerHTML = '<option value="">All jobs</option>' + jstate.jobs.map(j => `<option value="${j.id}">${esc(j.title)} (${esc(j.ref_code)})</option>`).join('');
      $('appJobFilter').value = appFilter.job;
      $('appStatusFilter').value = appFilter.status;
      const q = new URLSearchParams(); if (appFilter.job) q.set('job', appFilter.job); if (appFilter.status) q.set('status', appFilter.status);
      apps = (await api('GET', '/admin/applications?' + q)).applications;
      $('appsEmpty').hidden = apps.length > 0;
      const lpa = n => (n === null ? '–' : n + ' L');
      $('appRows').innerHTML = apps.map(a => `<tr class="clickable" data-id="${a.id}">
        <td><span class="cand">${esc(a.name)}</span><small>${esc(a.city)}${a.current_role ? ' · ' + esc(a.current_role) : ''}</small></td>
        <td>${esc(a.job_title)}<small>${esc(a.ref_code || 'job removed')}</small></td>
        <td>${a.total_exp === null ? '–' : a.total_exp + ' yrs'}</td>
        <td>${lpa(a.current_ctc)} → ${lpa(a.expected_ctc)}</td>
        <td>${esc(a.notice_period || '–')}</td>
        <td>${ago(a.created_at)}</td>
        <td><span class="st st-${a.status}">${STATUS[a.status]}</span></td>
        <td><button class="btn btn-ghost btn-sm" type="button">Open</button></td>
      </tr>`).join('');
      refreshBadge();
    } catch (e) { toast(e.message, true); }
  }

  $('appJobFilter').addEventListener('change', () => { appFilter.job = $('appJobFilter').value; loadApplications(); });
  $('appStatusFilter').addEventListener('change', () => { appFilter.status = $('appStatusFilter').value; loadApplications(); });
  $('appRows').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) openApplication(apps.find(a => a.id === Number(tr.dataset.id)));
  });

  function openApplication(a) {
    openApp = a;
    $('appName').textContent = a.name;
    $('appSub').textContent = `Applied for ${a.job_title}${a.ref_code ? ' (' + a.ref_code + ')' : ''} · ${ago(a.created_at)}`;
    const rows = [
      ['Email', `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`],
      ['Mobile', `<a href="tel:${esc(a.phone.replace(/[^\d+]/g, ''))}">${esc(a.phone)}</a>`],
      ['Current city', esc(a.city)],
      ['Total experience', a.total_exp === null ? '–' : esc(a.total_exp) + ' years'],
      ['Current CTC', a.current_ctc === null ? '–' : '₹' + esc(a.current_ctc) + ' LPA'],
      ['Expected CTC', a.expected_ctc === null ? '–' : '₹' + esc(a.expected_ctc) + ' LPA'],
      ['Notice period', esc(a.notice_period || '–')],
      ['Current employer', esc(a.current_employer || '–')],
      ['Current designation', esc(a.current_role || '–')],
      ['Qualification', esc(a.qualification || '–')],
      ['LinkedIn', a.linkedin ? `<a href="${esc(a.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(a.linkedin)}</a>` : '–'],
      ['CV file', esc(a.cv_name)],
      ['Consent given', esc(a.consent_at) + ' (UTC)']
    ];
    $('appDetails').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('appCover').hidden = !a.cover_note;
    $('appCover').textContent = a.cover_note;
    $('appCv').href = `/api/admin/applications/${a.id}/cv`;
    $('appStatus').value = a.status;
    $('appNotes').value = a.notes;
    showError($('appError'));
    $('appDialog').showModal();
  }

  $('appSave').addEventListener('click', async () => {
    try {
      await api('PUT', `/admin/applications/${openApp.id}`, { status: $('appStatus').value, notes: $('appNotes').value });
      $('appDialog').close();
      toast('Application updated.');
      loadApplications();
    } catch (err) { showError($('appError'), err.message); }
  });

  $('appDelete').addEventListener('click', async () => {
    if (!await confirmDialog('Delete this application?', `${openApp.name}'s application and CV will be permanently deleted (for example, when a candidate asks for their data to be removed).`)) return;
    try {
      await api('DELETE', `/admin/applications/${openApp.id}`);
      $('appDialog').close();
      toast('Application deleted.');
      loadApplications();
    } catch (err) { toast(err.message, true); }
  });

  /* ---------- users ---------- */

  async function loadUsers() {
    try {
      state.users = (await api('GET', '/admin/users')).users;
      $('userRows').innerHTML = state.users.map(u => `<tr data-id="${u.id}">
        <td><strong>${esc(u.name)}</strong>${u.id === state.user.id ? ' <span class="muted">(you)</span>' : ''}</td>
        <td>${esc(u.email)}</td>
        <td>${u.role === 'admin' ? 'Admin' : 'Editor'}</td>
        <td>${u.active ? '<span class="chip chip-live">Active</span>' : '<span class="chip chip-off">Disabled</span>'}</td>
        <td class="muted">${u.last_login_at ? ago(u.last_login_at) : 'Never'}</td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-edit-user>Edit</button></td>
      </tr>`).join('');
    } catch (e) { toast(e.message, true); }
  }

  function genPassword() {
    const words = 'surgeon,knee,shoulder,gold,arthro,ligament,summit,chennai,mumbai,delhi,anchor,repair,motion,stride,orbit'.split(',');
    const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    return `${words[r(words.length)]}-${words[r(words.length)]}-${100 + r(900)}`;
  }

  $('addUserBtn').addEventListener('click', () => openUser(null));
  $('userRows').addEventListener('click', e => {
    if (!e.target.closest('[data-edit-user]')) return;
    openUser(state.users.find(u => u.id === Number(e.target.closest('tr').dataset.id)));
  });
  $('genPw').addEventListener('click', () => { $('usPassword').value = genPassword(); });

  function openUser(u) {
    state.editingUser = u;
    $('userForm').reset();
    $('userDialogTitle').textContent = u ? 'Edit user' : 'Add user';
    $('usName').value = u ? u.name : '';
    $('usEmail').value = u ? u.email : '';
    $('usEmail').disabled = !!u;
    $('userForm').querySelector(`input[name="role"][value="${u ? u.role : 'editor'}"]`).checked = true;
    $('usPassword').value = u ? '' : genPassword();
    $('usPwLabel').textContent = u ? 'Reset password (optional)' : 'Temporary password';
    $('usPwHint').textContent = u ? 'Leave empty to keep their current password. Resetting signs them out everywhere.' : 'Share it with them privately. They can change it under My account.';
    $('usActiveRow').hidden = !u;
    $('usActive').checked = u ? !!u.active : true;
    showError($('userError'));
    $('userDialog').showModal();
    $('usName').focus();
  }

  $('userForm').addEventListener('submit', async e => {
    e.preventDefault();
    showError($('userError'));
    const body = {
      name: $('usName').value.trim(),
      role: $('userForm').querySelector('input[name="role"]:checked').value,
      password: $('usPassword').value || undefined
    };
    try {
      if (state.editingUser) {
        body.active = $('usActive').checked;
        await api('PUT', `/admin/users/${state.editingUser.id}`, body);
        toast('User updated.');
      } else {
        body.email = $('usEmail').value.trim();
        await api('POST', '/admin/users', body);
        toast(`Account created. Send ${body.email} their temporary password.`);
      }
      $('userDialog').close();
      loadUsers();
    } catch (err) { showError($('userError'), err.message); }
  });

  /* ---------- my account ---------- */

  $('passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    showError($('pwError'));
    if ($('pwNew').value !== $('pwRepeat').value) { showError($('pwError'), 'The new passwords do not match.'); return; }
    try {
      await api('POST', '/auth/password', { current: $('pwCurrent').value, password: $('pwNew').value });
      $('passwordForm').reset();
      toast('Password updated.');
    } catch (err) { showError($('pwError'), err.message); }
  });

  /* ---------- start ---------- */

  api('GET', '/auth/me').then(r => { state.user = r.user; showApp(); }).catch(showLogin);
})();
