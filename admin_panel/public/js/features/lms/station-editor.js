// Station editor: one modal (#lms-station-editor-modal) for a station's details, gallery and content.
//   - editing an existing station: three tabs (مشخصات | نگارستان | بخش‌ها و محتوا) and ONE save button.
//     Every field edit is kept in a draft (ED.edits, keyed "station.title", "sess.<id>.title", "clip.<id>.videoUrl"...)
//     and "ذخیره تغییرات" (or Ctrl+S) sends them all at once. Structural actions (add / delete a category, session,
//     part or quiz, batch tools) still hit the server right away (content-manager.js, quiz.js); the editor is then
//     redrawn from the fresh data with the draft re-applied, so nothing typed is lost.
//   - creating a station: the same modal as a four-step wizard (مشخصات → نگارستان → بخش‌ها → مرور و ثبت) that
//     creates the station with one request at the end.
// Drag and drop (js/features/lms/station-dnd.js): sessions and categories in the side list and video parts save
// right away; gallery pictures and the wizard's categories only reorder the draft.
// Previews: video links play in NopaLightbox (js/ui/lightbox.js); pictures with data-zoom enlarge on click.
// Styles: .lse-* in css/stations.css (the station page's look: glass panel, round buttons, inverted pills).

(function() {
  const MODAL_ID = 'lms-station-editor-modal';
  const TABS = [
    { id: 'info', icon: 'fa-solid fa-pen-to-square', label: 'مشخصات' },
    { id: 'gallery', icon: 'fa-solid fa-images', label: 'نگارستان' },
    { id: 'content', icon: 'fa-solid fa-layer-group', label: 'بخش‌ها و محتوا' }
  ];
  const STEPS = [
    { id: 'info', label: 'مشخصات' },
    { id: 'gallery', label: 'نگارستان' },
    { id: 'cats', label: 'بخش‌ها' },
    { id: 'review', label: 'مرور و ثبت' }
  ];
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v|m3u8|mkv)(\?|#|$)/i;
  const isVideo = url => (window.NopaLightbox ? window.NopaLightbox.isVideoUrl(url) : VIDEO_EXT.test(String(url || '')));

  // mode: 'edit' | 'create'; sel: 'cat:<id>' | 'sess:<id>' (content tab); draft: the wizard's data
  const ED = { mode: null, stationId: null, tab: 'info', step: 0, maxStep: 0, sel: null, edits: {}, draft: null, draftStart: '', saving: false };

  const modal = () => document.getElementById(MODAL_ID);
  const isOpen = () => { const m = modal(); return !!m && m.style.display !== 'none' && m.style.display !== ''; };
  const station = () => (window.lmsStationsMasterList || []).find(s => String(s.id) === String(ED.stationId));
  const args = (...a) => esc(JSON.stringify(a.map(String)));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function pad2(n) { return String(n).padStart(2, '0'); }
  function localDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function dateInput(v) {
    if (!v) return '';
    try { const d = new Date(v); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; } catch (_) { return ''; }
  }

  function findStationFlexible(stationId) {
    const list = window.lmsStationsMasterList || [];
    return list.find(s => String(s.id) === String(stationId))
      || list.find(s => ('MZ' + (s.orderIndex ?? s.index)) === String(stationId))
      || null;
  }

  function sessionsOf(cat) {
    return (cat.sessions || []).filter(s => !s.isDeleted)
      .slice().sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
  }
  function clipsOf(sess) {
    return (sess.videoClips || []).slice().sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0));
  }
  function quizzesOfClip(sess, clip, index) {
    if (clip.quizzes && clip.quizzes.length) return clip.quizzes;
    return (sess.quizzes || []).filter(q => q.clipId === clip.id || (!q.clipId && q.orderIndex === (clip.clipOrder || index + 1)));
  }
  function quizQuestion(quiz) {
    try {
      const parsed = typeof quiz.questionsJson === 'string' ? JSON.parse(quiz.questionsJson) : quiz.questionsJson;
      if (Array.isArray(parsed) && parsed[0] && parsed[0].question) return parsed[0].question;
    } catch (_) {}
    return quiz.title || 'آزمونک';
  }

  function findEntity(kind, id) {
    const st = station();
    if (!st) return null;
    for (const c of st.categories || []) {
      if (kind === 'cat' && String(c.id) === id) return c;
      for (const s of c.sessions || []) {
        if (s.isDeleted) continue;
        if (kind === 'sess' && String(s.id) === id) return s;
        if (kind === 'clip') {
          const clip = (s.videoClips || []).find(x => String(x.id) === id);
          if (clip) return clip;
        }
      }
    }
    return null;
  }
  function sessionOfClip(clipId) {
    const st = station();
    for (const c of (st && st.categories) || []) {
      for (const s of c.sessions || []) {
        if ((s.videoClips || []).some(x => String(x.id) === clipId)) return s;
      }
    }
    return null;
  }

  // A part's unlock moment as the date / time inputs show it (local time)
  function clipUnlock(clip) {
    let date = clip.unlockDate || '';
    let time = clip.unlockTime || '';
    if (!date && clip.scheduledUnlockTime) {
      const dt = new Date(clip.scheduledUnlockTime);
      if (!isNaN(dt.getTime())) { date = localDate(dt); time = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`; }
    }
    return { date, time };
  }

  function normGallery(list) {
    return (list || []).map((it, i) => ({
      id: it.id || `anim_${i + 1}`,
      title: it.title || '',
      url: it.url || it.videoUrl || '',
      coverImageUrl: it.coverImageUrl || '',
      description: it.description || ''
    }));
  }

  // ==================== DRAFT ====================

  // The saved value behind a draft key; undefined when the record no longer exists
  function original(key) {
    const [kind, a, b] = key.split('.');
    if (kind === 'station') {
      const st = station();
      if (!st) return undefined;
      switch (a) {
        case 'title': return st.title || '';
        case 'releaseDate': return dateInput(st.releaseDate);
        case 'stayDuration': return st.stayDuration || '';
        case 'animationCount': return st.animationCount == null ? '' : String(st.animationCount);
        case 'description': return st.description || '';
        case 'iconUrl': return st.iconUrl || '';
        case 'orderIndex': return String(st.orderIndex ?? '');
        case 'gallery': return JSON.stringify(normGallery(lmsStationGallery(st)));
        default: return undefined;
      }
    }
    const ent = findEntity(kind, a);
    if (!ent) return undefined;
    if (kind === 'clip' && (b === 'unlockDate' || b === 'unlockTime')) {
      const u = clipUnlock(ent);
      return b === 'unlockDate' ? u.date : u.time;
    }
    return ent[b] == null ? '' : String(ent[b]);
  }

  function val(key) {
    if (has(ED.edits, key)) return ED.edits[key];
    const o = original(key);
    return o === undefined ? '' : o;
  }

  function setVal(key, value) {
    const o = original(key);
    if (o === undefined) return;
    if (String(value) === o) delete ED.edits[key];
    else ED.edits[key] = String(value);
    refreshDirty();
  }

  function pruneEdits() {
    Object.keys(ED.edits).forEach(key => {
      const o = original(key);
      if (o === undefined || o === ED.edits[key]) delete ED.edits[key];
    });
  }

  // Station fields read / written the same way in both modes
  function field(name) {
    if (ED.mode === 'create') return ED.draft[name] ?? '';
    return val('station.' + name);
  }
  function setField(name, value) {
    if (ED.mode === 'create') { ED.draft[name] = value; return; }
    setVal('station.' + name, value);
  }
  function getGallery() {
    try { return JSON.parse(field('gallery') || '[]'); } catch (_) { return []; }
  }
  function setGallery(list) {
    setField('gallery', JSON.stringify(list));
  }
  function galleryForSave() {
    return getGallery().filter(it => String(it.url || '').trim()).map((it, i) => ({
      id: it.id || `anim_${i + 1}`,
      title: String(it.title || '').trim() || `تصویر ${i + 1}`,
      url: it.url.trim(),
      videoUrl: it.url.trim(),
      coverImageUrl: String(it.coverImageUrl || '').trim(),
      description: String(it.description || '').trim(),
      orderIndex: i + 1
    }));
  }

  function dirtyCount() {
    if (ED.mode === 'create') return 0;
    return Object.keys(ED.edits).length;
  }
  function isDirty() {
    if (ED.mode === 'create') return JSON.stringify(ED.draft) !== ED.draftStart;
    return dirtyCount() > 0;
  }

  // Footer text, tab dots and the dots on edited sessions / categories
  function refreshDirty() {
    const m = modal();
    if (!m || ED.mode !== 'edit') return;
    const keys = Object.keys(ED.edits);
    const n = keys.length;
    const note = m.querySelector('#lse-dirty');
    if (note) {
      note.classList.toggle('is-dirty', n > 0);
      note.innerHTML = n
        ? `<span class="lse-dot"></span> ${lmsFaDigits(n)} تغییر ذخیره‌نشده <small>· ذخیره با دکمه یا Ctrl+S</small>`
        : '<i class="fa-solid fa-circle-check"></i> همه تغییرات ذخیره شده است <small>· افزودن و حذف بلافاصله ثبت می‌شود</small>';
    }
    const save = m.querySelector('#lse-save');
    if (save && !ED.saving) save.disabled = n === 0;

    const tabDirty = {
      info: keys.some(k => k.startsWith('station.') && k !== 'station.gallery'),
      gallery: has(ED.edits, 'station.gallery'),
      content: keys.some(k => !k.startsWith('station.'))
    };
    m.querySelectorAll('[data-tab-dot]').forEach(el => el.classList.toggle('is-on', !!tabDirty[el.getAttribute('data-tab-dot')]));

    const dirtySess = new Set();
    const dirtyCat = new Set();
    const dirtyClip = new Set(keys.filter(k => k.startsWith('clip.')).map(k => k.split('.')[1]));
    keys.forEach(k => {
      const [kind, id] = k.split('.');
      if (kind === 'sess') dirtySess.add(id);
      else if (kind === 'cat') dirtyCat.add(id);
      else if (kind === 'clip') { const s = sessionOfClip(id); if (s) dirtySess.add(String(s.id)); }
    });
    m.querySelectorAll('[data-dirty-sess]').forEach(el => el.classList.toggle('is-dirty', dirtySess.has(el.getAttribute('data-dirty-sess'))));
    m.querySelectorAll('[data-clip-id].lse-tree-clip').forEach(el => el.classList.toggle('is-dirty', dirtyClip.has(el.getAttribute('data-clip-id'))));
    m.querySelectorAll('[data-dirty-cat]').forEach(el => el.classList.toggle('is-dirty', dirtyCat.has(el.getAttribute('data-dirty-cat'))));
  }

  // Texts that mirror a field while it is typed (titles in the header, the tree and the card preview)
  function mirror(key, value) {
    const m = modal();
    if (!m) return;
    m.querySelectorAll(`[data-live="${key}"]`).forEach(el => { el.textContent = value || el.getAttribute('data-live-empty') || ''; });
    m.querySelectorAll(`[data-live-src="${key}"]`).forEach(img => {
      img.src = value || '';
      img.style.visibility = value ? 'visible' : 'hidden';
    });
    if (key === 'station.title') {
      m.querySelectorAll('.lse-preview-title').forEach(el => { el.textContent = lmsPureStationName(previewNumber(), value); });
    }
    if (key === 'station.iconUrl' || key === 'station.gallery') updatePreviewImage();
  }

  function onFieldInput(e) {
    const el = e.target;
    if (!(el instanceof Element)) return;
    const f = el.getAttribute('data-f');
    if (f) {
      const parts = f.split('.');
      if (parts[0] === 'station') setField(parts[1], el.value);
      else if (parts[0] === 'newcat') { const c = ED.draft.cats[Number(parts[1])]; if (c) c[parts[2]] = el.value; }
      else setVal(f, el.value);
      mirror(f, el.value);
      if (parts[0] === 'clip' && (parts[2] === 'unlockDate' || parts[2] === 'unlockTime')) updateClipState(parts[1]);
      return;
    }
    const g = el.getAttribute('data-g');
    if (g) {
      const [i, prop] = g.split('.');
      const list = getGallery();
      if (!list[i]) return;
      list[i][prop] = el.value;
      setGallery(list);
      if (prop === 'url') {
        const img = modal().querySelector(`[data-gprev="${i}"]`);
        if (img) { img.src = el.value; img.style.visibility = el.value ? 'visible' : 'hidden'; }
        updatePreviewImage();
      }
    }
  }

  // ==================== OPEN / CLOSE ====================

  function show() {
    const m = modal();
    if (!m) return;
    m.style.display = 'flex';
    m.style.zIndex = 'var(--z-modal)';
    document.body.classList.add('lse-open'); // toasts move above the footer buttons (css/stations.css)
  }
  function hide() {
    const m = modal();
    if (m) m.style.display = 'none';
    document.body.classList.remove('lse-open');
    ED.mode = null;
    ED.edits = {};
    ED.draft = null;
    window.currentActiveContentStationId = null;
  }

  // opts: { tab: 'info' | 'gallery' | 'content', focus: 'sess:<id>' | 'cat:<id>' | 'cat:<index>' }
  window.lmsOpenStationEditor = async function(stationId, opts = {}) {
    const st = findStationFlexible(stationId);
    if (!st) { showToast('منزلگاه پیدا نشد.', 'error'); return; }
    const same = isOpen() && ED.mode === 'edit' && String(ED.stationId) === String(st.id);
    if (isOpen() && !same && isDirty()) {
      if (!(await NopaConfirm('تغییرات ذخیره‌نشده این پنجره از بین می‌رود. ادامه می‌دهید؟', { okText: 'ادامه بدون ذخیره', danger: true }))) return;
    }
    if (!same) {
      ED.mode = 'edit';
      ED.stationId = st.id;
      ED.edits = {};
      ED.sel = null;
    }
    if (!same) {
      const saved = NopaDrafts.load(`station:${st.id}`);
      if (saved && saved.data && saved.data.edits && Object.keys(saved.data.edits).length) {
        if ((await NopaDrafts.offerResume(`station:${st.id}`, 'پیش‌نویس تغییرات این منزلگاه')) === 'resume') ED.edits = saved.data.edits;
      }
    }
    ED.tab = opts.tab || (same ? ED.tab : 'info');
    if (opts.focus) ED.sel = resolveFocus(st, opts.focus);
    window.currentActiveContentStationId = st.id;
    show();
    render();
    focusBody();
  };

  // Focus starts in the content, not on the first tab (the modal manager would ring the first tab)
  function focusBody() {
    const body = document.getElementById('lse-body');
    if (body) body.focus({ preventScroll: true });
  }

  // "cat:<index>" (a position, from older callers) or "cat:<id>" / "sess:<id>"
  function resolveFocus(st, focus) {
    const m = String(focus).match(/^(cat|sess|clip):(.+)$/);
    if (!m) return null;
    if (m[1] === 'cat' && /^\d+$/.test(m[2])) {
      const cat = window.lmsOrderedCategories(st)[Number(m[2])];
      if (!cat) return null;
      const first = sessionsOf(cat)[0];
      return first ? `sess:${first.id}` : `cat:${cat.id}`;
    }
    return `${m[1]}:${m[2]}`;
  }

  window.editStationModal = (stationId, tab) => window.lmsOpenStationEditor(stationId, { tab: tab || 'info' });
  window.openStationContentManagerModal = (stationId, focus) => {
    const f = focus && focus !== 'all' ? focus : null;
    return window.lmsOpenStationEditor(stationId, { tab: 'content', focus: f });
  };

  window.openCreateStationModal = async function(resume) {
    if (isOpen() && isDirty()) {
      if (!(await NopaConfirm('تغییرات ذخیره‌نشده این پنجره از بین می‌رود. ادامه می‌دهید؟', { okText: 'ادامه بدون ذخیره', danger: true }))) return;
    }
    ED.mode = 'create';
    ED.stationId = null;
    ED.edits = {};
    ED.step = 0;
    ED.maxStep = 0;
    ED.draft = {
      title: '',
      releaseDate: localDate(new Date()),
      stayDuration: '۲ هفته',
      animationCount: '',
      description: '',
      iconUrl: '',
      gallery: '[]',
      cats: []
    };
    ED.draftStart = JSON.stringify(ED.draft);
    window.currentActiveContentStationId = null;
    const saved = NopaDrafts.load('station:new');
    if (saved && saved.data && saved.data.draft) {
      const ok = resume === true || (await NopaDrafts.offerResume('station:new', 'پیش‌نویس منزلگاه')) === 'resume';
      if (ok) {
        ED.draft = saved.data.draft;
        ED.step = Math.min(saved.data.step || 0, STEPS.length - 1);
        ED.maxStep = Math.max(saved.data.maxStep || 0, ED.step);
      }
    }
    show();
    render();
    document.getElementById('lse-st-title')?.focus();
  };
  window.openStationCreatorModal = window.openCreateStationModal;

  const draftKey = () => (ED.mode === 'create' ? 'station:new' : `station:${ED.stationId}`);
  const refreshDraftChip = () => {
    const show = NopaDrafts.has('station:new') ? '' : 'none';
    ['lms-draft-chip', 'lms-draft-del'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = show; });
  };
  window.lmsRefreshDraftChip = refreshDraftChip;
  document.addEventListener('nopa-drafts', refreshDraftChip);
  refreshDraftChip();

  window.lmsDeleteDraft = async function() {
    if (!(await NopaConfirm('پیش‌نویس منزلگاه حذف شود؟ این کار قابل بازگشت نیست.', { okText: 'حذف پیش‌نویس', danger: true }))) return;
    NopaDrafts.remove('station:new');
    showToast('پیش‌نویس حذف شد.', 'success');
  };

  window.lmsEditorClose = async function() {
    if (ED.saving) return;
    if (isDirty()) {
      const choice = await NopaDrafts.askOnClose({
        what: ED.mode === 'create' ? 'این منزلگاه' : `${lmsFaDigits(dirtyCount())} تغییر این منزلگاه`,
        isNew: ED.mode === 'create'
      });
      if (choice === 'stay') return;
      if (choice === 'save') {
        const payload = ED.mode === 'create' ? { draft: ED.draft, step: ED.step, maxStep: ED.maxStep } : { edits: ED.edits };
        if (NopaDrafts.save(draftKey(), payload)) showToast('پیش‌نویس ذخیره شد؛ بعداً می‌توانید ادامه دهید.', 'success');
        else showToast('ذخیره پیش‌نویس در این مرورگر ممکن نشد.', 'error');
      } else {
        NopaDrafts.remove(draftKey());
      }
    }
    hide();
    refreshDraftChip();
  };

  // "ادامه پیش‌نویس منزلگاه" on the stations page
  window.lmsResumeDraft = async function() {
    await window.openCreateStationModal(true);
  };

  // Redraw after the station list reloaded (structural actions, quizzes, drag and drop); the draft is kept
  window.lmsEditorRefresh = function(stationId, select) {
    if (!isOpen() || ED.mode !== 'edit') return;
    if (stationId && String(stationId) !== String(ED.stationId)) return;
    if (!station()) { hide(); return; }
    if (select) { ED.sel = select; ED.tab = 'content'; }
    pruneEdits();
    const m = modal();
    const keep = {};
    ['.lse-body', '.lse-tree', '.lse-detail'].forEach(sel => { const el = m.querySelector(sel); if (el) keep[sel] = el.scrollTop; });
    render();
    if (!select) Object.keys(keep).forEach(sel => { const el = m.querySelector(sel); if (el) el.scrollTop = keep[sel]; });
  };

  // Batch instructor: edits of that field in the category's sessions would hide the new value
  window.lmsEditorDropSessionEdits = function(categoryId, fieldName) {
    const cat = findEntity('cat', String(categoryId));
    if (!cat) return;
    (cat.sessions || []).forEach(s => { delete ED.edits[`sess.${s.id}.${fieldName}`]; });
  };

  // ==================== RENDER ====================

  function previewNumber() {
    if (ED.mode === 'create') {
      const nums = (window.lmsStationsMasterList || []).map(x => Number(x.orderIndex ?? x.index)).filter(Number.isFinite);
      return nums.length ? Math.max(...nums) + 1 : 1;
    }
    const st = station();
    if (!st) return 1;
    const typed = parseInt(val('station.orderIndex'), 10);
    return Number.isFinite(typed) && typed >= 0 ? typed : (st.orderIndex ?? 1);
  }

  function previewImage() {
    const icon = String(field('iconUrl') || '').trim();
    if (icon) return icon;
    const first = getGallery().find(it => it.url && !isVideo(it.url));
    return first ? first.url : (getGallery().find(it => it.coverImageUrl) || {}).coverImageUrl || '';
  }
  function updatePreviewImage() {
    const src = previewImage();
    modal().querySelectorAll('.lse-preview-img').forEach(img => {
      img.src = src || '/admin/icons/stations/imagenot01.svg';
      img.classList.toggle('app-station-noimg', !src);
    });
  }

  function render() {
    renderHead();
    renderBody();
    renderFoot();
    refreshDirty();
  }

  function renderHead() {
    const idEl = document.getElementById('lse-id');
    const tabsEl = document.getElementById('lse-tabs');
    if (!idEl || !tabsEl) return;
    const num = previewNumber();
    if (ED.mode === 'create') {
      idEl.innerHTML = `
        <span class="lse-id-icon"><i class="fa-solid fa-plus"></i></span>
        <div class="lse-id-text">
          <h3 id="lse-title">منزلگاه جدید <small data-live="station.title" data-live-empty="">${esc(field('title'))}</small></h3>
          <span>منزلگاه ${lmsFaDigits(num)} · قدم ${lmsFaDigits(ED.step + 1)} از ${lmsFaDigits(STEPS.length)}</span>
        </div>`;
      tabsEl.innerHTML = STEPS.map((s, i) => {
        const state = i === ED.step ? ' is-active' : (i < ED.step ? ' is-done' : '');
        const reachable = i <= ED.maxStep;
        return `<button type="button" class="lse-tab lse-step${state}" ${reachable ? `data-click="lmsEditorGoStep" data-click-args="${args(i)}"` : 'disabled'}${i === ED.step ? ' aria-current="step"' : ''}>
          <span class="lse-step-num">${i < ED.step ? '<i class="fa-solid fa-check"></i>' : lmsFaDigits(i + 1)}</span>${s.label}</button>`;
      }).join('');
      return;
    }
    const st = station();
    const sum = lmsStationSummary(st);
    const img = lmsStationImage(st);
    idEl.innerHTML = `
      <span class="lse-id-icon">${img ? `<img src="${esc(img)}" alt="" data-error="lmsImageFallback" data-error-args='["$this", "${num}"]'>` : `<span>${lmsFaDigits(num)}</span>`}</span>
      <div class="lse-id-text">
        <h3 id="lse-title" data-live="station.title">${esc(field('title') || `منزلگاه ${num}`)}</h3>
        <span>منزلگاه ${lmsFaDigits(num)} · ${sum.categories} دسته · ${sum.sessions} جلسه · ${sum.parts} پارت</span>
      </div>`;
    tabsEl.setAttribute('role', 'tablist');
    tabsEl.innerHTML = TABS.map(t => `
      <button type="button" class="lse-tab${t.id === ED.tab ? ' is-active' : ''}" role="tab" aria-selected="${t.id === ED.tab}" data-click="lmsEditorTab" data-click-args="${args(t.id)}">
        <i class="${t.icon}"></i>${t.label}<span class="lse-tab-dot" data-tab-dot="${t.id}"></span>
      </button>`).join('');
  }

  function renderFoot() {
    const foot = document.getElementById('lse-foot');
    if (!foot) return;
    if (ED.mode === 'create') {
      const last = ED.step === STEPS.length - 1;
      foot.innerHTML = `
        <span class="lse-foot-note"><i class="fa-solid fa-circle-info"></i> ${last ? 'با «ایجاد منزلگاه» همه اطلاعات یکجا ثبت می‌شود.' : 'تا قدم آخر چیزی ذخیره نمی‌شود.'}</span>
        <div class="lse-foot-actions">
          <button type="button" class="lse-btn" data-click="lmsEditorClose">انصراف</button>
          ${ED.step > 0 ? '<button type="button" class="lse-btn" data-click="lmsEditorPrev"><i class="fa-solid fa-arrow-right"></i> قبلی</button>' : ''}
          ${last
            ? '<button type="button" class="lsv-pill" id="lse-save" data-click="lmsEditorCreate"><i class="fa-solid fa-check"></i> ایجاد منزلگاه</button>'
            : '<button type="button" class="lsv-pill" data-click="lmsEditorNext">بعدی <i class="fa-solid fa-arrow-left"></i></button>'}
        </div>`;
      return;
    }
    foot.innerHTML = `
      <span class="lse-foot-note" id="lse-dirty" aria-live="polite"></span>
      <div class="lse-foot-actions">
        <button type="button" class="lse-btn" data-click="lmsEditorClose">بستن</button>
        <button type="button" class="lsv-pill" id="lse-save" data-click="lmsEditorSave"><i class="fa-solid fa-check"></i> ذخیره تغییرات</button>
      </div>`;
  }

  function renderBody() {
    const body = document.getElementById('lse-body');
    if (!body) return;
    const view = ED.mode === 'create' ? STEPS[ED.step].id : ED.tab;
    let html = '';
    if (view === 'info') html = infoView();
    else if (view === 'gallery') html = galleryView();
    else if (view === 'content') html = contentView();
    else if (view === 'cats') html = newCatsView();
    else if (view === 'review') html = reviewView();
    body.innerHTML = html;
    body.scrollTop = 0;
    body.classList.toggle('is-split', view === 'content');
    initPickers(body);
    if (view === 'content') {
      const active = body.querySelector('.lse-tree .is-active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }

  // Instructor pickers (instructors.js) draw their selected names once the block is in the page
  function initPickers(root) {
    root.querySelectorAll('[data-inst-picker]').forEach(block => {
      if (typeof window.renderSelectedInstructorBadges === 'function') window.renderSelectedInstructorBadges(block.id);
    });
  }

  function upload(targetId, label = 'آپلود', accept = 'image/*') {
    return `<label class="lse-btn lse-upload" title="آپلود فایل"><i class="fa-solid fa-cloud-arrow-up"></i> ${label}
      <input type="file" accept="${accept}" data-style="display:none;" data-change="handleDirectFileUpload" data-change-args="${args('$this', targetId)}"></label>`;
  }

  // The app's home-screen card, live
  function cardPreview() {
    const num = previewNumber();
    const src = previewImage();
    return `
      <span class="app-station-card lse-preview">
        <span class="app-station-inner">
          <span class="app-station-image">
            <img class="lse-preview-img${src ? '' : ' app-station-noimg'}" src="${esc(src || '/admin/icons/stations/imagenot01.svg')}" alt="" data-zoom data-zoom-title="تصویر منزلگاه" data-error="lmsStationImageFailed" data-error-args='["$this"]'>
          </span>
          <span class="app-station-divider"></span>
          <span class="app-station-bar">
            <span class="app-station-num">${lmsFaDigits(num)}</span>
            <span class="app-station-title lse-preview-title">${esc(lmsPureStationName(num, field('title')))}</span>
          </span>
        </span>
      </span>`;
  }

  function infoView() {
    const num = previewNumber();
    return `
      <div class="lse-info">
        <section class="lse-card lse-card-preview">
          <h4 class="lse-card-title"><i class="fa-solid fa-image"></i> تصویر منزلگاه</h4>
          ${cardPreview()}
          <label class="lse-field">
            <span>لینک تصویر <small>در صفحه اول، آموزگاه و منزلگاه نمایش داده می‌شود</small></span>
            <span class="lse-inline">
              <input type="text" id="lse-st-icon" class="input-ctrl" dir="ltr" data-f="station.iconUrl" value="${esc(field('iconUrl'))}" placeholder="https://... یا /uploads/...">
              ${upload('lse-st-icon')}
            </span>
          </label>
          <p class="lse-hint">بدون تصویر، اولین عکس نگارستان روی کارت نمایش داده می‌شود.</p>
        </section>
        <section class="lse-card">
          <h4 class="lse-card-title"><i class="fa-solid fa-circle-info"></i> مشخصات کلی <span class="lsv-col-count">منزلگاه ${lmsFaDigits(num)}</span></h4>
          <label class="lse-field">
            <span>عنوان منزلگاه <b class="lse-req">*</b></span>
            <input type="text" id="lse-st-title" class="input-ctrl" data-f="station.title" value="${esc(field('title'))}" placeholder="مثال: منزلگاه ۱ (آغاز راه)" required>
          </label>
          <div class="lse-grid lse-grid-2">
            <label class="lse-field">
              <span>تاریخ شروع / انتشار</span>
              <input type="date" class="input-ctrl" data-f="station.releaseDate" value="${esc(field('releaseDate'))}">
            </label>
            <label class="lse-field">
              <span>مدت اقامت</span>
              <input type="text" class="input-ctrl" data-f="station.stayDuration" value="${esc(field('stayDuration'))}" placeholder="مثال: ۲ هفته">
            </label>
            <label class="lse-field">
              <span>تعداد انیمیشن (قسمت)</span>
              <input type="number" min="0" class="input-ctrl" data-f="station.animationCount" value="${esc(field('animationCount'))}" placeholder="مثال: ۳">
            </label>
          </div>
          <label class="lse-field">
            <span>معرفی، داستان و سرفصل‌ها</span>
            <textarea class="input-ctrl" rows="6" data-f="station.description" placeholder="توضیحات، داستان و اهداف این منزلگاه...">${esc(field('description'))}</textarea>
          </label>
          ${ED.mode === 'edit' ? `
          <label class="lse-field">
            <span><i class="fa-solid fa-hashtag"></i> عدد نمایشی منزلگاه <small>در اپ و سایت نمایش داده می‌شود؛ منزلگاه‌های دیگر به‌ترتیب پشت سر آن شماره‌گذاری می‌شوند</small></span>
            <input type="number" class="input-ctrl" dir="ltr" min="0" step="1" data-f="station.orderIndex" value="${esc(field('orderIndex'))}" placeholder="مثال: 0">
          </label>` : ''}
          <p class="lse-hint"><i class="fa-solid fa-hashtag"></i> با کشیدن کارت‌ها در صفحه منزلگاه‌ها ترتیب عوض می‌شود و شماره‌ها خودکار مرتب می‌شوند (اولین منزلگاه شماره خودش را نگه می‌دارد).</p>
        </section>
      </div>`;
  }

  function galleryView() {
    const list = getGallery();
    const items = list.map((it, i) => {
      const video = isVideo(it.url);
      return `
        <article class="lse-gitem" data-gi="${i}">
          <div class="lse-gitem-media">
            ${video
              ? `${it.coverImageUrl ? `<img src="${esc(it.coverImageUrl)}" alt="" data-error="NopaActions.setVisibility" data-error-args='["$this","hidden"]'>` : '<span class="lse-gitem-video"><i class="fa-solid fa-film"></i></span>'}
                 <button type="button" class="lse-play" data-click="lmsEditorPreviewGallery" data-click-args="${args(i)}" title="پیش‌نمایش ویدیو" aria-label="پیش‌نمایش ویدیو"><i class="fa-solid fa-play"></i></button>`
              : `<img data-gprev="${i}" src="${esc(it.url)}" alt="" data-zoom data-zoom-group="lse-gallery" data-zoom-title="${esc(it.title)}" data-style="${it.url ? '' : 'visibility:hidden;'}" data-error="NopaActions.setVisibility" data-error-args='["$this","hidden"]' data-load="NopaActions.setVisibility" data-load-args='["$this","visible"]'>`}
            <span class="lse-gitem-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip"></i></span>
            <span class="lse-gitem-num">${lmsFaDigits(i + 1)}</span>
            <span class="lse-gitem-tools">
              <button type="button" class="lsv-round lsv-round-sm" data-click="lmsEditorGalleryMove" data-click-args="${args(i, -1)}" title="جابجایی به قبل" aria-label="جابجایی به قبل"${i === 0 ? ' disabled' : ''}><i class="fa-solid fa-arrow-right"></i></button>
              <button type="button" class="lsv-round lsv-round-sm" data-click="lmsEditorGalleryMove" data-click-args="${args(i, 1)}" title="جابجایی به بعد" aria-label="جابجایی به بعد"${i === list.length - 1 ? ' disabled' : ''}><i class="fa-solid fa-arrow-left"></i></button>
              <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="lmsEditorGalleryRemove" data-click-args="${args(i)}" title="حذف از نگارستان" aria-label="حذف از نگارستان"><i class="fa-solid fa-trash"></i></button>
            </span>
          </div>
          <input type="text" class="input-ctrl" data-g="${i}.title" value="${esc(it.title)}" placeholder="عنوان تصویر" aria-label="عنوان تصویر ${i + 1}">
          <span class="lse-inline">
            <input type="text" id="lse-g-url-${i}" class="input-ctrl" dir="ltr" data-g="${i}.url" value="${esc(it.url)}" placeholder="لینک تصویر" aria-label="لینک تصویر ${i + 1}">
            ${upload(`lse-g-url-${i}`, '')}
          </span>
          <details class="lse-more"${it.coverImageUrl || it.description ? ' open' : ''}>
            <summary>کاور و توضیح</summary>
            <span class="lse-inline">
              <input type="text" id="lse-g-cover-${i}" class="input-ctrl" dir="ltr" data-g="${i}.coverImageUrl" value="${esc(it.coverImageUrl)}" placeholder="کاور (فقط برای ویدیو)" aria-label="کاور ${i + 1}">
              ${upload(`lse-g-cover-${i}`, '')}
            </span>
            <textarea class="input-ctrl" rows="2" data-g="${i}.description" placeholder="توضیح (اختیاری)" aria-label="توضیح ${i + 1}">${esc(it.description)}</textarea>
          </details>
        </article>`;
    }).join('');
    return `
      <p class="lse-lead"><i class="fa-solid fa-images"></i> تصاویر نگارستان در اپلیکیشن به صورت اسلاید نمایش داده می‌شوند. برای جابجایی، تصویر را بکشید؛ برای بزرگنمایی روی آن بزنید. موردی که لینک ندارد ذخیره نمی‌شود.</p>
      <div class="lse-gallery">
        ${items}
        <button type="button" class="lse-gadd" data-click="lmsEditorGalleryAdd">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          افزودن تصویر
        </button>
      </div>`;
  }

  // ---- content tab: categories and sessions (right) | the selected session or category (left) ----

  function normalizeSel(st) {
    const cats = window.lmsOrderedCategories(st);
    const m = String(ED.sel || '').match(/^(cat|sess|clip):(.+)$/);
    if (m && findEntity(m[1], m[2])) return;
    for (const c of cats) {
      const first = sessionsOf(c)[0];
      if (first) { ED.sel = `sess:${first.id}`; return; }
    }
    ED.sel = cats[0] ? `cat:${cats[0].id}` : null;
  }

  function contentView() {
    const st = station();
    normalizeSel(st);
    const cats = window.lmsOrderedCategories(st);
    const selClip = /^clip:(.+)$/.exec(String(ED.sel || ''));
    const openSessionId = selClip ? String((sessionOfClip(selClip[1]) || {}).id || '') : '';
    const tree = cats.map((c, ci) => {
      const sessions = sessionsOf(c);
      const rows = sessions.map((s, si) => {
        const clips = s.videoClips || [];
        const active = ED.sel === `sess:${s.id}`;
        const open = active || openSessionId === String(s.id);
        const partRows = !open ? '' : `
          <div class="lse-tree-clips" data-session-id="${esc(s.id)}">
            ${clipsOf(s).map((clip, k) => `
            <button type="button" class="lse-tree-clip${ED.sel === `clip:${clip.id}` ? ' is-active' : ''}" data-clip-id="${esc(clip.id)}" data-click="lmsEditorSelect" data-click-args="${args('clip:' + clip.id)}"${ED.sel === `clip:${clip.id}` ? ' aria-current="true"' : ''}>
              <span class="lse-tree-clip-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
              <span class="lse-tree-num">${lmsFaDigits(k + 1)}</span>
              <span class="lse-tree-text"><strong data-live="clip.${esc(clip.id)}.title">${esc(val(`clip.${clip.id}.title`) || `پارت ${k + 1}`)}</strong></span>
              <span class="lse-dot" title="تغییر ذخیره‌نشده"></span>
            </button>`).join('')}
            <button type="button" class="lse-tree-clip lse-tree-clip-add" data-click="addNewClipToSession" data-click-args="${args(s.id)}">
              <span class="lse-tree-num"><i class="fa-solid fa-plus"></i></span>
              <span class="lse-tree-text"><strong>پارت جدید</strong></span>
            </button>
          </div>`;
        return `
          <button type="button" class="lse-tree-row${active ? ' is-active' : ''}" data-session-id="${esc(s.id)}" data-dirty-sess="${esc(s.id)}" data-click="lmsEditorSelect" data-click-args="${args('sess:' + s.id)}"${active ? ' aria-current="true"' : ''}>
            <span class="lse-tree-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
            <span class="lse-tree-num">${lmsFaDigits(si + 1)}</span>
            <span class="lse-tree-text"><strong data-live="sess.${esc(s.id)}.title">${esc(val(`sess.${s.id}.title`) || `جلسه ${si + 1}`)}</strong><small>${clips.length} پارت${clips.length ? '' : ' · ناقص'}</small></span>
            <span class="lse-dot" title="تغییر ذخیره‌نشده"></span>
          </button>${partRows}`;
      }).join('');
      const catActive = ED.sel === `cat:${c.id}`;
      return `
        <div class="lse-tree-group" data-cat-id="${esc(c.id)}">
          <button type="button" class="lse-tree-cat${catActive ? ' is-active' : ''}" data-dirty-cat="${esc(c.id)}" data-click="lmsEditorSelect" data-click-args="${args('cat:' + c.id)}" title="تنظیمات دسته (برای جابجایی بکشید)">
            <span class="lse-tree-cat-grip lse-grip" aria-hidden="true"><i class="fa-solid fa-grip-lines"></i></span>
            <span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor(ci)}"></span>
            <strong data-live="cat.${esc(c.id)}.title">${esc(val(`cat.${c.id}.title`) || `دسته ${ci + 1}`)}</strong>
            <span class="lsv-col-count">${sessions.length}</span>
            <span class="lse-dot" title="تغییر ذخیره‌نشده"></span>
            <i class="fa-solid fa-sliders"></i>
          </button>
          ${rows}
          <button type="button" class="lse-tree-row lse-tree-add" data-click="lmsEditorAddSession" data-click-args="${args(c.id)}">
            <span class="lse-tree-num"><i class="fa-solid fa-plus"></i></span>
            <span class="lse-tree-text"><strong>جلسه جدید</strong></span>
          </button>
        </div>`;
    }).join('');

    const m = String(ED.sel || '').match(/^(cat|sess|clip):(.+)$/);
    const detail = !m ? `
        <div class="lse-empty">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-layer-group"></i></span>
          <strong>این منزلگاه هنوز دسته کلاسی ندارد</strong>
          <span>از ستون کناری یک دسته بسازید؛ هر دسته یک تب در صفحه کلاس‌های اپلیکیشن است.</span>
        </div>`
      : (m[1] === 'cat' ? categoryDetail(st, m[2]) : (m[1] === 'clip' ? clipDetail(st, m[2]) : sessionDetail(st, m[2])));

    return `
      <aside class="lse-tree" aria-label="دسته‌ها و جلسات">
        ${cats.length ? '<p class="lse-hint lse-tree-hint"><i class="fa-solid fa-up-down-left-right"></i> دسته‌ها، جلسه‌ها و پارت‌ها را بکشید تا جابجا شوند؛ بلافاصله ثبت می‌شود.</p>' : ''}
        ${tree}
        <div class="lse-tree-new">
          <input type="text" id="new-cat-title-${esc(st.id)}" class="input-ctrl" placeholder="عنوان دسته جدید" aria-label="عنوان دسته کلاس جدید" data-keydown="lmsEditorNewCatKey" data-keydown-args='["$event"]'>
          <button type="button" class="lsv-round lsv-round-sm" data-click="lmsEditorAddCategory" title="افزودن دسته" aria-label="افزودن دسته"><i class="fa-solid fa-plus"></i></button>
        </div>
      </aside>
      <section class="lse-detail">${detail}</section>`;
  }

  function categoryDetail(st, catId) {
    const cats = window.lmsOrderedCategories(st);
    const ci = cats.findIndex(c => String(c.id) === catId);
    const cat = cats[ci];
    const sessions = sessionsOf(cat);
    let parts = 0;
    const quizMap = new Map(); // a part's quiz is also in its session's list: count each once
    sessions.forEach(s => {
      parts += (s.videoClips || []).length;
      (s.quizzes || []).forEach(q => quizMap.set(String(q.id), q));
      (s.videoClips || []).forEach(c => (c.quizzes || []).forEach(q => quizMap.set(String(q.id), q)));
    });
    const quizzes = quizMap.size;
    // The batch box starts at the category's current reward: the shared amount, else the most common one
    const tally = {};
    quizMap.forEach(q => { const z = q.rewardZarik ?? 10; tally[z] = (tally[z] || 0) + 1; });
    const zKeys = Object.keys(tally);
    const catZarik = zKeys.length ? zKeys.sort((a, b) => tally[b] - tally[a])[0] : 15;
    const zarikMixed = zKeys.length > 1;
    const bank = window.globalInstructorsList || [];
    return `
      <header class="lse-detail-head">
        <div>
          <span class="lse-crumb"><span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor(ci)}"></span> دسته ${lmsFaDigits(ci + 1)} · تب ${lmsFaDigits(ci + 1)} صفحه کلاس‌های اپلیکیشن</span>
          <h4 data-live="cat.${esc(cat.id)}.title">${esc(val(`cat.${cat.id}.title`) || `دسته ${ci + 1}`)}</h4>
        </div>
        <div class="lsv-round-group">
          <button type="button" class="lse-btn" data-click="lmsEditorAddSession" data-click-args="${args(cat.id)}"><i class="fa-solid fa-plus"></i> جلسه جدید</button>
          <button type="button" class="lsv-round lsv-round-danger" data-click="deleteCategoryRecord" data-click-args="${args(cat.id, st.id)}" title="حذف دسته" aria-label="حذف دسته"><i class="fa-solid fa-trash"></i></button>
        </div>
      </header>
      <section class="lse-card">
        <label class="lse-field">
          <span>عنوان دسته <small>نام همین تب در اپلیکیشن</small></span>
          <input type="text" class="input-ctrl" data-f="cat.${esc(cat.id)}.title" value="${esc(val(`cat.${cat.id}.title`))}">
        </label>
        <div class="lsv-facts">
          <span><i class="fa-solid fa-book-open"></i> ${sessions.length} جلسه</span>
          <span><i class="fa-solid fa-film"></i> ${parts} پارت</span>
          <span><i class="fa-solid fa-circle-question"></i> ${quizzes} آزمونک</span>
        </div>
      </section>
      <div class="lse-grid lse-grid-2">
        <section class="lse-card lse-tool">
          <h5><i class="fa-solid fa-chalkboard-user"></i> استاد همه جلسات</h5>
          <p>استاد همه جلسات این دسته یکجا عوض می‌شود. بلافاصله ثبت می‌شود.</p>
          <span class="lse-inline">
            <select id="batch-instructor-cat-${esc(cat.id)}" class="select-ctrl" aria-label="استاد">
              ${bank.length ? bank.map(i => `<option value="${esc(i.name)}">${esc(i.name)}${i.degree ? ` (${esc(i.degree)})` : ''}</option>`).join('') : '<option value="">ابتدا استادی در بانک اساتید ثبت کنید</option>'}
            </select>
            <button type="button" class="lsv-pill" data-click="applyBatchInstructorToCategory" data-click-args="${args(cat.id, st.id)}"${bank.length ? '' : ' disabled'}>اعمال</button>
          </span>
        </section>
        <section class="lse-card lse-tool">
          <h5><i class="fa-solid fa-coins"></i> پاداش زریک همه آزمونک‌ها</h5>
          <p>پاداش پاسخ درست به همه آزمونک‌های این دسته. بلافاصله ثبت می‌شود و روی هر آزمونک نشان داده می‌شود؛ بعدا می‌توانید پاداش یک آزمونک را جدا تغییر دهید.${zarikMixed ? ' <b>اکنون پاداش آزمونک‌ها یکسان نیست.</b>' : ''}</p>
          <span class="lse-inline">
            <input type="number" id="batch-zarik-cat-${esc(cat.id)}" class="input-ctrl" value="${esc(catZarik)}" min="0" max="1000" aria-label="مقدار زریک" data-batch-zarik="${esc(cat.id)}" data-batch-station="${esc(st.id)}"${quizzes ? '' : ' disabled'}>
            <button type="button" class="lsv-pill" data-click="applyBatchZarikToCategory" data-click-args="${args(cat.id, st.id)}"${quizzes ? '' : ' disabled title="این دسته هنوز آزمونکی ندارد"'}>اعمال</button>
          </span>
        </section>
      </div>`;
  }

  function clipStateChip(clipId) {
    const date = val(`clip.${clipId}.unlockDate`);
    const time = val(`clip.${clipId}.unlockTime`) || '00:00';
    if (!date) return '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-lock-open"></i> همیشه باز</span>';
    const target = new Date(`${date}T${time}`);
    if (isNaN(target.getTime())) return '<span class="lst-chip lst-chip-locked">تاریخ نامعتبر</span>';
    if (target > new Date()) return `<span class="lst-chip lst-chip-scheduled"><i class="fa-regular fa-clock"></i> قفل تا ${target.toLocaleDateString('fa-IR')} ${esc(time)}</span>`;
    return `<span class="lst-chip lst-chip-active"><i class="fa-solid fa-lock-open"></i> باز شده از ${target.toLocaleDateString('fa-IR')}</span>`;
  }
  function updateClipState(clipId) {
    const el = document.getElementById(`lse-clip-state-${clipId}`);
    if (el) el.innerHTML = clipStateChip(clipId);
  }

  // One part's boxes (video link, cover, unlock moment, quizzes); shown alone when the part is selected in the side list
  function clipCardHtml(sess, clip, k) {
    const cid = esc(clip.id);
    const quizzes = quizzesOfClip(sess, clip, k);
    const cover = val(`clip.${clip.id}.coverImageUrl`);
    return `
      <article class="lcm-clip lse-clip" data-clip-id="${cid}">
        <header class="lse-clip-head">
          <span class="lcm-clip-badge">پارت <span class="lcm-clip-num">${k + 1}</span></span>
          <input type="text" class="input-ctrl lse-clip-title" data-f="clip.${cid}.title" value="${esc(val(`clip.${clip.id}.title`))}" placeholder="عنوان پارت" aria-label="عنوان پارت ${k + 1}">
          <span id="lse-clip-state-${cid}" class="lse-clip-state">${clipStateChip(clip.id)}</span>
          <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="deleteClipRecord" data-click-args="${args(clip.id, sess.id)}" title="حذف پارت" aria-label="حذف پارت"><i class="fa-solid fa-trash"></i></button>
        </header>
        <div class="lse-grid lse-grid-2">
          <div class="lse-field">
            <label for="lse-clip-url-${cid}"><i class="fa-solid fa-video"></i> لینک ویدیو</label>
            <span class="lse-inline">
              <input type="text" id="lse-clip-url-${cid}" class="input-ctrl" dir="ltr" data-f="clip.${cid}.videoUrl" value="${esc(val(`clip.${clip.id}.videoUrl`))}" placeholder="https://www.aparat.com/v/...">
              <button type="button" class="lsv-round lse-play-btn" data-click="lmsEditorPreviewClip" data-click-args="${args(clip.id)}" title="پیش‌نمایش ویدیو" aria-label="پیش‌نمایش ویدیو"><i class="fa-solid fa-play"></i></button>
            </span>
          </div>
          <div class="lse-field">
            <label for="lse-clip-cover-${cid}"><i class="fa-solid fa-image"></i> کاور ویدیو</label>
            <span class="lse-inline">
              <img class="lse-thumb" data-live-src="clip.${cid}.coverImageUrl" src="${esc(cover)}" alt="" data-zoom data-zoom-title="کاور پارت ${k + 1}" data-style="${cover ? '' : 'visibility:hidden;'}" data-error="NopaActions.setVisibility" data-error-args='["$this","hidden"]'>
              <input type="text" id="lse-clip-cover-${cid}" class="input-ctrl" dir="ltr" data-f="clip.${cid}.coverImageUrl" value="${esc(cover)}" placeholder="اختیاری">
              ${upload(`lse-clip-cover-${clip.id}`, '')}
            </span>
          </div>
        </div>
        <div class="lse-unlock">
          <span class="lse-unlock-label"><i class="fa-solid fa-clock-rotate-left"></i> باز شدن پارت</span>
          <input type="date" class="input-ctrl" data-f="clip.${cid}.unlockDate" value="${esc(val(`clip.${clip.id}.unlockDate`))}" aria-label="تاریخ باز شدن">
          <input type="time" class="input-ctrl" data-f="clip.${cid}.unlockTime" value="${esc(val(`clip.${clip.id}.unlockTime`))}" aria-label="ساعت باز شدن">
          <button type="button" class="lse-btn" data-click="lmsEditorClipAlwaysOpen" data-click-args="${args(clip.id)}"><i class="fa-solid fa-unlock"></i> همیشه باز</button>
        </div>
        <div class="lse-quizzes">
          ${quizzes.map(q => `
            <div class="lse-quiz">
              <i class="fa-solid fa-circle-question"></i>
              <span class="lse-quiz-q" title="${esc(quizQuestion(q))}">${esc(quizQuestion(q))}</span>
              <span class="lse-zarik"><i class="fa-solid fa-coins"></i> ${q.rewardZarik ?? 10}</span>
              <button type="button" class="lsv-round lsv-round-sm" data-click="editQuizRecord" data-click-args="${args(q.id)}" title="ویرایش آزمونک" aria-label="ویرایش آزمونک"><i class="fa-solid fa-pen"></i></button>
              <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="deleteQuizRecord" data-click-args="${args(q.id)}" title="حذف آزمونک" aria-label="حذف آزمونک"><i class="fa-solid fa-trash"></i></button>
            </div>`).join('')}
          <button type="button" class="lse-btn lse-btn-dashed" data-click="openQuizModalForClip" data-click-args="${args(sess.id, clip.id)}"><i class="fa-solid fa-plus"></i> آزمونک${quizzes.length ? ' دیگر' : ' انتهای پارت'}</button>
        </div>
      </article>`;
  }

  function sessionDetail(st, sessId) {
    const cats = window.lmsOrderedCategories(st);
    const flat = [];
    cats.forEach((c, ci) => sessionsOf(c).forEach((s, si) => flat.push({ c, ci, s, si })));
    const pos = flat.findIndex(x => String(x.s.id) === sessId);
    const { c: cat, ci, s: sess, si } = flat[pos];
    const prev = flat[pos - 1];
    const next = flat[pos + 1];
    const id = esc(sess.id);
    const pickerId = `lse-pick-${sess.id}`;
    const clips = clipsOf(sess);


    return `
      <header class="lse-detail-head">
        <div>
          <span class="lse-crumb"><span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor(ci)}"></span> <span data-live="cat.${esc(cat.id)}.title">${esc(val(`cat.${cat.id}.title`))}</span> · جلسه ${lmsFaDigits(si + 1)}</span>
          <h4 data-live="sess.${id}.title">${esc(val(`sess.${sess.id}.title`) || `جلسه ${si + 1}`)}</h4>
        </div>
        <div class="lsv-round-group">
          <button type="button" class="lsv-round" ${prev ? `data-click="lmsEditorSelect" data-click-args="${args('sess:' + prev.s.id)}"` : 'disabled'} title="جلسه قبلی" aria-label="جلسه قبلی"><i class="fa-solid fa-arrow-right"></i></button>
          <button type="button" class="lsv-round" ${next ? `data-click="lmsEditorSelect" data-click-args="${args('sess:' + next.s.id)}"` : 'disabled'} title="جلسه بعدی" aria-label="جلسه بعدی"><i class="fa-solid fa-arrow-left"></i></button>
          <button type="button" class="lsv-round lsv-round-danger" data-click="deleteSessionRecord" data-click-args="${args(sess.id, st.id)}" title="حذف جلسه" aria-label="حذف جلسه"><i class="fa-solid fa-trash"></i></button>
        </div>
      </header>

      <section class="lse-card">
        <div class="lse-grid lse-grid-2">
          <label class="lse-field">
            <span>عنوان جلسه</span>
            <input type="text" class="input-ctrl" data-f="sess.${id}.title" value="${esc(val(`sess.${sess.id}.title`))}" placeholder="عنوان جلسه">
          </label>
          <div class="lse-field inst-picker-wrapper" id="${esc(pickerId)}" data-inst-picker>
            <span class="lse-field-label">استاد / اساتید <a href="#" data-click="openInstructorModalQuick" data-click-args="${args(pickerId)}"><i class="fa-solid fa-plus"></i> استاد جدید</a></span>
            <input type="hidden" class="modal-cat-instructor" data-f="sess.${id}.instructor" value="${esc(val(`sess.${sess.id}.instructor`))}">
            <div role="button" tabindex="0" id="inst-picker-box-${esc(pickerId)}" class="inst-picker-box lse-picker" data-click="toggleInstructorDropdown" data-click-args="${args(pickerId, '$event')}"></div>
            <div id="inst-dropdown-${esc(pickerId)}" class="inst-dropdown-menu lse-dropdown" data-style="display:none"></div>
          </div>
        </div>
        <div class="lse-grid lse-grid-2">
          <label class="lse-field">
            <span><i class="fa-solid fa-calendar-day"></i> تاریخ کلاس</span>
            <input type="text" class="input-ctrl" data-f="sess.${id}.sessionDate" value="${esc(val(`sess.${sess.id}.sessionDate`))}" placeholder="مثال: ۱۴۰۵/۰۷/۰۲">
          </label>
          <label class="lse-field">
            <span><i class="fa-regular fa-clock"></i> ساعت کلاس</span>
            <input type="text" class="input-ctrl" data-f="sess.${id}.sessionTime" value="${esc(val(`sess.${sess.id}.sessionTime`))}" placeholder="مثال: ۱۸:۰۰ الی ۱۹:۳۰">
          </label>
        </div>
        <label class="lse-field">
          <span>مشخصات جلسه <small>در تب «مشخصات جلسه» صفحه کلاس‌های اپلیکیشن</small></span>
          <textarea class="input-ctrl" rows="3" data-f="sess.${id}.description" placeholder="توضیحات، اهداف و سرفصل‌های این جلسه...">${esc(val(`sess.${sess.id}.description`))}</textarea>
        </label>
        <div class="lse-grid lse-grid-2">
          <label class="lse-field">
            <span><i class="fa-solid fa-file-pdf"></i> عنوان جزوه</span>
            <input type="text" class="input-ctrl" data-f="sess.${id}.handoutTitle" value="${esc(val(`sess.${sess.id}.handoutTitle`))}" placeholder="مثال: جزوه جلسه اول">
          </label>
          <label class="lse-field">
            <span>فایل جزوه <small>در تب «مشخصات جلسه» اپ قابل دانلود است</small></span>
            <span class="lse-inline">
              <input type="text" id="lse-handout-${id}" class="input-ctrl" dir="ltr" data-f="sess.${id}.handoutUrl" value="${esc(val(`sess.${sess.id}.handoutUrl`))}" placeholder="https://... یا /uploads/...">
              ${upload(`lse-handout-${id}`, 'آپلود', '.pdf,.doc,.docx,.ppt,.pptx,image/*')}
            </span>
          </label>
        </div>
      </section>

      <section class="lse-card lse-tool">
        <h5><i class="fa-solid fa-film"></i> پارت‌های ویدیو <span class="lsv-col-count">${clips.length}</span></h5>
        <p>${clips.length ? 'برای ویرایش هر پارت (لینک ویدیو، کاور، زمان باز شدن و آزمونک‌ها)، آن را از ستون کناری انتخاب کنید. ترتیب پارت‌ها را همان‌جا با کشیدن عوض کنید.' : 'این جلسه هنوز پارتی ندارد.'}</p>
        <button type="button" class="lse-add-row" data-click="addNewClipToSession" data-click-args="${args(sess.id)}"><i class="fa-solid fa-plus"></i> پارت جدید</button>
      </section>`;
  }

  function clipDetail(st, clipId) {
    const sess = sessionOfClip(clipId);
    const cats = window.lmsOrderedCategories(st);
    const ci = cats.findIndex(c => sessionsOf(c).some(x => sess && String(x.id) === String(sess.id)));
    const cat = cats[ci];
    const si = sessionsOf(cat).findIndex(x => String(x.id) === String(sess.id));
    const clips = clipsOf(sess);
    const k = clips.findIndex(x => String(x.id) === clipId);
    const clip = clips[k];
    const prev = clips[k - 1];
    const next = clips[k + 1];
    return `
      <header class="lse-detail-head">
        <div>
          <span class="lse-crumb"><span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor(ci)}"></span> <span data-live="cat.${esc(cat.id)}.title">${esc(val(`cat.${cat.id}.title`))}</span> · <a href="#" data-click="lmsEditorSelect" data-click-args="${args('sess:' + sess.id)}">جلسه ${lmsFaDigits(si + 1)}: <span data-live="sess.${esc(sess.id)}.title">${esc(val(`sess.${sess.id}.title`) || '')}</span></a></span>
          <h4 data-live="clip.${esc(clip.id)}.title">${esc(val(`clip.${clip.id}.title`) || `پارت ${k + 1}`)}</h4>
        </div>
        <div class="lsv-round-group">
          <button type="button" class="lsv-round" ${prev ? `data-click="lmsEditorSelect" data-click-args="${args('clip:' + prev.id)}"` : 'disabled'} title="پارت قبلی" aria-label="پارت قبلی"><i class="fa-solid fa-arrow-right"></i></button>
          <button type="button" class="lsv-round" ${next ? `data-click="lmsEditorSelect" data-click-args="${args('clip:' + next.id)}"` : 'disabled'} title="پارت بعدی" aria-label="پارت بعدی"><i class="fa-solid fa-arrow-left"></i></button>
        </div>
      </header>
      ${clipCardHtml(sess, clip, k)}`;
  }

  // ---- wizard steps 3 and 4 ----

  function newCatsView() {
    const cats = ED.draft.cats;
    const cards = cats.map((c, i) => {
      const blockId = `lse-newcat-${i}`;
      return `
        <article class="lse-card lse-newcat" id="${blockId}" data-ni="${i}" data-inst-picker>
          <header class="lse-newcat-head">
            <span class="lse-newcat-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip"></i></span>
            <span class="lse-crumb"><span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor(i)}"></span> دسته ${lmsFaDigits(i + 1)} · تب ${lmsFaDigits(i + 1)} اپلیکیشن</span>
            <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="lmsEditorRemoveNewCat" data-click-args="${args(i)}" title="حذف دسته" aria-label="حذف دسته"><i class="fa-solid fa-trash"></i></button>
          </header>
          <label class="lse-field">
            <span>عنوان دسته</span>
            <input type="text" class="input-ctrl" data-f="newcat.${i}.title" value="${esc(c.title)}" placeholder="مثال: کلاس‌های مهارتی">
          </label>
          <div class="lse-field inst-picker-wrapper">
            <span class="lse-field-label">استاد / اساتید <a href="#" data-click="openInstructorModalQuick" data-click-args="${args(blockId)}"><i class="fa-solid fa-plus"></i> استاد جدید</a></span>
            <input type="hidden" class="modal-cat-instructor" data-f="newcat.${i}.instructor" value="${esc(c.instructor)}">
            <div role="button" tabindex="0" id="inst-picker-box-${blockId}" class="inst-picker-box lse-picker" data-click="toggleInstructorDropdown" data-click-args="${args(blockId, '$event')}"></div>
            <div id="inst-dropdown-${blockId}" class="inst-dropdown-menu lse-dropdown" data-style="display:none"></div>
          </div>
          <div class="lse-grid lse-grid-2">
            <label class="lse-field">
              <span>تعداد جلسات</span>
              <input type="number" class="input-ctrl" data-f="newcat.${i}.sessionsCount" value="${esc(c.sessionsCount)}" min="1" max="50">
            </label>
            <label class="lse-field">
              <span>پارت هر جلسه</span>
              <input type="number" class="input-ctrl" data-f="newcat.${i}.partsPerSession" value="${esc(c.partsPerSession)}" min="1" max="20">
            </label>
          </div>
        </article>`;
    }).join('');
    return `
      <p class="lse-lead"><i class="fa-solid fa-layer-group"></i> هر دسته یک تب در صفحه کلاس‌های اپلیکیشن است. جلسات و پارت‌ها (با یک آزمونک نمونه برای هر پارت) بر اساس این تعدادها ساخته می‌شوند و بعداً در «بخش‌ها و محتوا» قابل ویرایش‌اند. این قدم اختیاری است.</p>
      <div class="lse-newcats">
        ${cards}
        <button type="button" class="lse-gadd" data-click="lmsEditorAddNewCat">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          افزودن دسته
        </button>
      </div>`;
  }

  function reviewView() {
    const d = ED.draft;
    const gallery = galleryForSave();
    const cats = d.cats.map((c, i) => {
      const sessions = parseInt(c.sessionsCount) || 2;
      const parts = parseInt(c.partsPerSession) || 2;
      return `
        <li class="lse-review-cat">
          <span class="lsv-col-dot" data-style="background:${window.lmsCategoryColor(i)}"></span>
          <strong>${esc(c.title.trim() || `دسته ${i + 1}`)}</strong>
          <span>${lmsFaDigits(sessions)} جلسه × ${lmsFaDigits(parts)} پارت</span>
          <small>${esc(c.instructor || 'بدون استاد')}</small>
        </li>`;
    }).join('');
    const edit = step => `<button type="button" class="lse-btn" data-click="lmsEditorGoStep" data-click-args="${args(step)}"><i class="fa-solid fa-pen"></i> ویرایش</button>`;
    return `
      <div class="lse-info">
        <section class="lse-card lse-card-preview">
          <h4 class="lse-card-title"><i class="fa-solid fa-mobile-screen"></i> در اپلیکیشن</h4>
          ${cardPreview()}
        </section>
        <div class="lse-review">
          <section class="lse-card">
            <header class="lse-card-row"><h4 class="lse-card-title"><i class="fa-solid fa-circle-info"></i> مشخصات</h4>${edit(0)}</header>
            <dl class="lse-dl">
              <dt>عنوان</dt><dd>${esc(d.title)}</dd>
              <dt>تاریخ انتشار</dt><dd>${d.releaseDate ? esc(lmsFaDate(d.releaseDate)) : '—'}</dd>
              <dt>مدت اقامت</dt><dd>${esc(d.stayDuration || '—')}</dd>
              <dt>تعداد انیمیشن</dt><dd>${esc(d.animationCount || '—')}</dd>
              <dt>معرفی</dt><dd>${esc(d.description || '—')}</dd>
            </dl>
          </section>
          <section class="lse-card">
            <header class="lse-card-row"><h4 class="lse-card-title"><i class="fa-solid fa-images"></i> نگارستان <span class="lsv-col-count">${gallery.length}</span></h4>${edit(1)}</header>
            ${gallery.length ? `<div class="lse-review-thumbs">${gallery.slice(0, 8).map(g => isVideo(g.url) ? '<span class="lse-gitem-video"><i class="fa-solid fa-film"></i></span>' : `<img src="${esc(g.url)}" alt="" data-zoom data-zoom-group="lse-review" data-zoom-title="${esc(g.title)}" data-error="NopaActions.setVisibility" data-error-args='["$this","hidden"]'>`).join('')}</div>` : '<p class="lse-hint">تصویری اضافه نشده است.</p>'}
          </section>
          <section class="lse-card">
            <header class="lse-card-row"><h4 class="lse-card-title"><i class="fa-solid fa-layer-group"></i> بخش‌ها <span class="lsv-col-count">${d.cats.length}</span></h4>${edit(2)}</header>
            ${cats ? `<ul class="lse-review-cats">${cats}</ul>` : '<p class="lse-hint">بدون دسته؛ بعداً از «بخش‌ها و محتوا» اضافه کنید.</p>'}
          </section>
        </div>
      </div>`;
  }

  // ==================== ACTIONS ====================

  window.lmsEditorTab = function(tab) {
    if (ED.mode !== 'edit' || !TABS.some(t => t.id === tab)) return;
    ED.tab = tab;
    renderHead();
    renderBody();
    refreshDirty();
  };

  window.lmsEditorSelect = function(sel) {
    ED.sel = sel;
    renderBody();
    refreshDirty();
    const detail = modal().querySelector('.lse-detail');
    if (detail) detail.scrollTop = 0;
  };

  window.lmsEditorAddSession = function(categoryId) {
    return window.addNewSessionToCategory(categoryId, ED.stationId);
  };
  window.lmsEditorAddCategory = function() {
    return window.addNewCategoryToStation(ED.stationId);
  };
  window.lmsEditorNewCatKey = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); window.lmsEditorAddCategory(); }
  };

  window.lmsEditorClipAlwaysOpen = function(clipId) {
    const m = modal();
    ['unlockDate', 'unlockTime'].forEach(f => {
      const key = `clip.${clipId}.${f}`;
      setVal(key, '');
      const input = m.querySelector(`[data-f="${key}"]`);
      if (input) input.value = '';
    });
    updateClipState(clipId);
  };

  // Gallery: the list lives in the draft until the station is saved
  window.lmsEditorGalleryAdd = function() {
    const list = getGallery();
    list.push({ id: `anim_${Date.now()}`, title: `تصویر ${list.length + 1}`, url: '', coverImageUrl: '', description: '' });
    setGallery(list);
    renderBody();
    refreshDirty();
    const input = document.getElementById(`lse-g-url-${list.length - 1}`);
    if (input) { input.scrollIntoView({ block: 'nearest' }); input.focus(); }
  };
  window.lmsEditorGalleryRemove = function(i) {
    const list = getGallery();
    list.splice(Number(i), 1);
    setGallery(list);
    renderBody();
    refreshDirty();
    updatePreviewImage();
  };
  window.lmsEditorGalleryMove = function(i, dir) {
    i = Number(i);
    const j = i + Number(dir);
    const list = getGallery();
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setGallery(list);
    renderBody();
    refreshDirty();
  };

  // ---- previews (js/ui/lightbox.js) ----
  window.lmsEditorPreviewClip = function(clipId) {
    const url = val(`clip.${clipId}.videoUrl`).trim();
    if (!url) { showToast('ابتدا لینک ویدیو این پارت را وارد کنید.', 'error'); return; }
    window.NopaLightbox.video(url, { title: val(`clip.${clipId}.title`), poster: val(`clip.${clipId}.coverImageUrl`) });
  };
  window.lmsEditorPreviewGallery = function(i) {
    const it = getGallery()[Number(i)];
    if (!it || !it.url) return;
    window.NopaLightbox.video(it.url, { title: it.title, poster: it.coverImageUrl });
  };

  // ---- drag and drop of draft lists (js/features/lms/station-dnd.js); order = the old indexes in their new order ----
  window.lmsEditorRedraw = function() {
    if (!isOpen()) return;
    renderBody();
    refreshDirty();
  };
  window.lmsEditorGalleryReorder = function(order) {
    const list = getGallery();
    const next = order.map(i => list[Number(i)]).filter(Boolean);
    if (next.length !== list.length || order.every((v, i) => Number(v) === i)) return false;
    setGallery(next);
    window.lmsEditorRedraw();
    updatePreviewImage();
    return true;
  };
  window.lmsEditorNewCatReorder = function(order) {
    if (ED.mode !== 'create') return false;
    const cats = ED.draft.cats;
    const next = order.map(i => cats[Number(i)]).filter(Boolean);
    if (next.length !== cats.length || order.every((v, i) => Number(v) === i)) return false;
    ED.draft.cats = next;
    window.lmsEditorRedraw();
    return true;
  };

  // ---- wizard ----
  function validateStep(step) {
    if (STEPS[step].id === 'info' && !String(ED.draft.title || '').trim()) {
      showToast('عنوان منزلگاه را وارد کنید.', 'error');
      document.getElementById('lse-st-title')?.focus();
      return false;
    }
    return true;
  }
  window.lmsEditorGoStep = function(step) {
    step = Number(step);
    if (ED.mode !== 'create' || step > ED.maxStep) return;
    if (step > ED.step && !validateStep(ED.step)) return;
    ED.step = step;
    render();
  };
  window.lmsEditorNext = function() {
    if (ED.mode !== 'create' || !validateStep(ED.step)) return;
    ED.step = Math.min(ED.step + 1, STEPS.length - 1);
    ED.maxStep = Math.max(ED.maxStep, ED.step);
    render();
  };
  window.lmsEditorPrev = function() {
    if (ED.mode !== 'create') return;
    ED.step = Math.max(0, ED.step - 1);
    render();
  };
  window.lmsEditorAddNewCat = function() {
    const n = ED.draft.cats.length;
    ED.draft.cats.push({ title: n === 0 ? 'کلاس‌های مهارتی' : (n === 1 ? 'کلاس‌های رسانه‌ای' : `دسته کلاس ${n + 1}`), instructor: '', sessionsCount: '2', partsPerSession: '2' });
    renderBody();
    const cards = modal().querySelectorAll('.lse-newcat');
    const last = cards[cards.length - 1];
    if (last) { last.scrollIntoView({ block: 'nearest' }); last.querySelector('input[type="text"]')?.select(); }
  };
  window.lmsEditorRemoveNewCat = function(i) {
    ED.draft.cats.splice(Number(i), 1);
    renderBody();
  };

  function setBusy(on, label) {
    ED.saving = on;
    const btn = document.getElementById('lse-save');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? `<i class="fa-solid fa-spinner fa-spin"></i> ${label}` : btn.getAttribute('data-label') || btn.innerHTML;
  }

  window.lmsEditorCreate = async function() {
    if (ED.mode !== 'create' || ED.saving) return;
    if (!validateStep(0)) { ED.step = 0; render(); return; }
    const d = ED.draft;
    const animations = galleryForSave();
    const payload = {
      orderIndex: previewNumber(),
      title: d.title.trim(),
      releaseDate: d.releaseDate || undefined,
      stayDuration: d.stayDuration,
      animationCount: d.animationCount === '' ? null : d.animationCount,
      description: d.description,
      iconUrl: String(d.iconUrl || '').trim(),
      animations,
      animationsJson: JSON.stringify(animations),
      animationTitle: animations[0] ? animations[0].title : '',
      animationUrl: animations[0] ? animations[0].url : '',
      categories: d.cats.map((c, i) => ({
        orderIndex: i + 1,
        title: c.title.trim() || `دسته ${i + 1}`,
        instructor: c.instructor || 'استاد نپا',
        sessionsCount: parseInt(c.sessionsCount) || 2,
        partsPerSession: parseInt(c.partsPerSession) || 2
      }))
    };
    const btn = document.getElementById('lse-save');
    if (btn) btn.setAttribute('data-label', btn.innerHTML);
    setBusy(true, 'در حال ایجاد...');
    try {
      const res = await request('/api/v1/admin/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('خطا در ایجاد منزلگاه: ' + (data.error || 'خطای سرور'), 'error');
        setBusy(false);
        return;
      }
      ED.saving = false;
      NopaDrafts.remove('station:new');
      hide();
      refreshDraftChip();
      showToast(`«${payload.title}» ایجاد شد.`, 'success');
      await window.fetchLiveLmsStations();
      const newId = data && data.data && data.data.id;
      if (newId && typeof window.openLmsStationView === 'function') window.openLmsStationView(newId);
    } catch (err) {
      console.error('Create station error:', err);
      showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
      setBusy(false);
    }
  };

  // ---- the one save of the edit mode ----
  window.lmsEditorSave = async function() {
    if (ED.mode !== 'edit' || ED.saving) return;
    const st = station();
    if (!st) return;
    pruneEdits();
    const keys = Object.keys(ED.edits);
    if (!keys.length) { refreshDirty(); return; }

    if (!val('station.title').trim()) {
      ED.tab = 'info';
      render();
      showToast('عنوان منزلگاه نمی‌تواند خالی باشد.', 'error');
      document.getElementById('lse-st-title')?.focus();
      return;
    }

    const jobs = [];
    const json = (method, url, body) => () => request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    // 1. Station details / picture / gallery. The endpoint rewrites every basic field, so all of them are sent
    //    (subtitle and release time as they are, so they are not cleared).
    if (keys.some(k => k.startsWith('station.'))) {
      const body = {
        id: st.id,
        orderIndex: Math.max(0, parseInt(val('station.orderIndex'), 10) || 0),
        title: val('station.title').trim(),
        description: val('station.description'),
        releaseDate: val('station.releaseDate'),
        stayDuration: val('station.stayDuration'),
        animationCount: val('station.animationCount'),
        subtitle: st.subtitle || undefined,
        releaseTime: st.releaseTime || undefined
      };
      if (has(ED.edits, 'station.iconUrl')) body.iconUrl = val('station.iconUrl').trim();
      if (has(ED.edits, 'station.gallery')) {
        const items = galleryForSave();
        body.animations = items;
        body.animationTitle = items[0] ? items[0].title : '';
        body.animationUrl = items[0] ? items[0].url : '';
      }
      jobs.push({ label: 'مشخصات منزلگاه', send: json('PUT', `/api/v1/admin/lms/stations/${st.id}`, body) });
    }

    // 2. Category titles and video parts: one transaction
    const catIds = new Set();
    const clipFields = {};
    const sessFields = {};
    keys.forEach(k => {
      const [kind, id, f] = k.split('.');
      if (kind === 'cat') catIds.add(id);
      else if (kind === 'clip') (clipFields[id] = clipFields[id] || new Set()).add(f);
      else if (kind === 'sess') (sessFields[id] = sessFields[id] || new Set()).add(f);
    });
    const categories = Array.from(catIds).map(id => ({ id, title: val(`cat.${id}.title`).trim() })).filter(c => c.title);
    const clips = Object.keys(clipFields).map(id => {
      const f = clipFields[id];
      if (f.has('unlockDate') || f.has('unlockTime')) { f.add('unlockDate'); f.add('unlockTime'); }
      const c = { id };
      f.forEach(name => { c[name] = val(`clip.${id}.${name}`); });
      return c;
    });
    if (categories.length || clips.length) {
      jobs.push({ label: 'دسته‌ها و پارت‌ها', send: json('POST', `/api/v1/admin/lms/stations/${st.id}/batch-content`, { categories, clips }) });
    }

    // 3. Sessions, one request each (only the changed fields; this also saves the description)
    Object.keys(sessFields).forEach(id => {
      const body = { id };
      sessFields[id].forEach(name => { body[name] = val(`sess.${id}.${name}`); });
      jobs.push({ label: `جلسه «${val(`sess.${id}.title`)}»`, send: json('PUT', `/api/v1/admin/lms/sessions/${id}`, body) });
    });

    const btn = document.getElementById('lse-save');
    if (btn) btn.setAttribute('data-label', btn.innerHTML);
    setBusy(true, 'در حال ذخیره...');
    const results = await Promise.all(jobs.map(j => j.send().then(r => !!(r && r.ok), () => false)));
    const failed = jobs.filter((_, i) => !results[i]).map(j => j.label);
    const saved = keys.length;
    await window.fetchLiveLmsStations();
    ED.saving = false;
    if (!failed.length) {
      ED.edits = {};
      NopaDrafts.remove(`station:${st.id}`);
      showToast(`${lmsFaDigits(saved)} تغییر ذخیره شد.`, 'success');
    } else {
      // what was saved now equals the fresh data and drops out of the draft; the rest stays for another try
      showToast('ذخیره این موارد انجام نشد: ' + failed.join('، ') + '. دوباره تلاش کنید.', 'error');
    }
    if (isOpen() && ED.mode === 'edit') window.lmsEditorRefresh(st.id);
  };

  // ==================== EVENTS ====================

  function bind() {
    const m = modal();
    if (!m || m.dataset.bound) return;
    m.dataset.bound = '1';
    m.addEventListener('input', onFieldInput);
    m.addEventListener('change', onFieldInput);
    // Enter in a category's batch zarik box applies it (instead of nothing / a form submit)
    m.addEventListener('keydown', e => {
      const box = e.target instanceof Element && e.target.closest('[data-batch-zarik]');
      if (!box || e.key !== 'Enter') return;
      e.preventDefault();
      window.applyBatchZarikToCategory(box.dataset.batchZarik, box.dataset.batchStation);
    });
    // a backdrop click closes the editor only when nothing is waiting to be saved (js/ui/modal.js)
    if (window.NopaModal && window.NopaModal.guard) window.NopaModal.guard(MODAL_ID, () => isOpen() && (isDirty() || ED.saving));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  // Escape asks before dropping unsaved work (the modal manager would close it straight away); Ctrl+S saves
  window.addEventListener('keydown', e => {
    if (!isOpen()) return;
    const top = window.NopaModal && window.NopaModal.top();
    if (top && top !== modal()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.lmsEditorClose();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
      e.preventDefault();
      if (ED.mode === 'edit') window.lmsEditorSave();
    }
  }, true);
})();

