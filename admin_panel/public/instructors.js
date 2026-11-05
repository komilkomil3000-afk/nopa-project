// ==================== INSTRUCTORS MANAGEMENT (بانک و مدیریت اساتید) ====================

window.globalInstructorsList = [];

// Fetch instructors list from backend
window.fetchInstructorsList = async function() {
  window.insSetLoading(true);
  try {
    const res = await request('/api/v1/instructors');

    if (res.ok) {
      const data = await res.json();
      window.globalInstructorsList = data.data || [];
      window.insSetLoading(false);
      if (window.insActiveId) insDetailCache.delete(String(window.insActiveId));
      window.renderInstructorsTable();
      if (typeof window.refreshAllInstructorPickers === 'function') {
        window.refreshAllInstructorPickers();
      }
    } else {
      insShowError('خطا در دریافت فهرست اساتید');
    }
  } catch (err) {
    console.error('Error fetching instructors:', err);
    insShowError('خطا در دریافت فهرست اساتید');
  }
};

// Like the stations / caravans tabs: a bento overview of the bank (#ins-overview-view) and one instructor's page
// (#instructor-detail-view): all instructors as circles in the notch, the instructor's card linked to the class
// sessions that name them and to the resume card. Styles: css/stations.css (.lst-*, .lsv-*, .crv-*, .mnt-*, .ins-*).
// Shared helpers (crvAvatar, crvFa, crvArgs, crvFadeOut) come from js/features/caravans.js, loaded before this file.
window.insActiveId = null;
window.insRenderedId = null;
const insDetailCache = new Map();

function insFind(id) { return (window.globalInstructorsList || []).find(i => String(i.id) === String(id)) || null; }
function insClasses(inst) { return String(inst?.classes || '').split(/[،,؛\n]/).map(s => s.trim()).filter(Boolean); }
function insStatusChip(inst) {
  return inst.isActive === false
    ? '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-pause"></i> غیرفعال</span>'
    : '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-circle-check"></i> فعال</span>';
}

function insShowError(text) {
  window.insSetLoading(false);
  const grid = document.getElementById('ins-bento-list');
  if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(text)}</div>`;
}

// Kept for the callers that re-render the bank after a change
window.renderInstructorsTable = function() {
  const overview = document.getElementById('ins-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, insDrawBento); else insDrawBento();
  // The open instructor page follows the new data; a deleted instructor sends it back to the overview
  if (window.insActiveId) {
    if (insFind(window.insActiveId)) window.loadInstructorPage();
    else window.closeInstructorView();
  }
};

window.filterInstructorsList = function() {
  const overview = document.getElementById('ins-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, insDrawBento); else insDrawBento();
};

function insCard(inst) {
  const classes = insClasses(inst);
  return `
    <button type="button" class="crv-card ins-card" data-anim-key="in:${esc(inst.id)}" data-click="openInstructorView" data-click-args="${crvArgs(inst.id)}" title="ورود به صفحه ${esc(inst.name)}">
      <span class="crv-card-top">
        ${crvAvatar(inst.avatarUrl, inst.name, 'crv-card-cover')}
        <span class="crv-card-name"><strong>${esc(inst.name)}</strong>${insStatusChip(inst)}</span>
      </span>
      <span class="crv-card-mentor">
        <i class="fa-solid fa-graduation-cap"></i>
        <span>${inst.degree ? esc(inst.degree) : '<em>مدرک ثبت نشده</em>'}</span>
      </span>
      <span class="ins-card-classes">${classes.length ? classes.slice(0, 3).map(c => `<span class="ins-chip">${esc(c)}</span>`).join('') + (classes.length > 3 ? `<span class="ins-chip">+${crvFa(classes.length - 3)}</span>` : '') : '<span class="u-c-text-faint">کلاسی ثبت نشده</span>'}</span>
      <span class="crv-card-foot">
        <span class="crv-card-nums">
          ${inst.phoneNumber ? `<span class="u-c-text-soft"><i class="fa-solid fa-phone"></i> <bdi dir="ltr">${esc(inst.phoneNumber)}</bdi></span>` : ''}
        </span>
        <span class="crv-card-nums">
          <span class="${inst.resume ? 'u-c-success-text' : 'u-c-text-faint'}" title="رزومه"><i class="fa-solid fa-file-lines"></i></span>
        </span>
      </span>
    </button>`;
}

function insDrawBento() {
  const all = window.globalInstructorsList || [];
  const query = (document.getElementById('instructor-search-input')?.value || '').trim().toLowerCase();
  const status = document.getElementById('instructor-status-filter')?.value || 'all';
  const list = all.filter(inst => {
    if (status === 'active' && inst.isActive === false) return false;
    if (status === 'inactive' && inst.isActive !== false) return false;
    if (!query) return true;
    return [inst.name, inst.phoneNumber, inst.nationalId, inst.degree, inst.classes, inst.resume, inst.description]
      .some(v => String(v || '').toLowerCase().includes(query));
  });
  const filtering = !!query || status !== 'all';

  const badge = document.getElementById('instructors-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)} استاد` : 'برای ورود به صفحه استاد بزنید';

  const grid = document.getElementById('ins-bento-list');
  if (grid) {
    const cards = list.map(insCard);
    if (!filtering) {
      cards.push(`
        <button type="button" class="crv-card crv-card-add" data-anim-key="in-add" data-click="openInstructorModal" title="ثبت استاد جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          <span>استاد جدید</span>
        </button>`);
    } else if (!list.length) {
      cards.push('<div class="lst-empty" data-anim-key="in-empty">استادی با این مشخصات یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('ins-stat-total', crvFa(all.length));
  setStat('ins-stat-active', crvFa(all.filter(i => i.isActive !== false).length));
  setStat('ins-stat-resume', crvFa(all.filter(i => i.resume).length));
  setStat('ins-stat-photo', crvFa(all.filter(i => i.avatarUrl).length));

  // ---- degrees ----
  const degEl = document.getElementById('ins-bento-degrees');
  if (degEl) {
    const byDegree = new Map();
    all.forEach(i => { const d = String(i.degree || '').trim() || 'ثبت نشده'; byDegree.set(d, (byDegree.get(d) || 0) + 1); });
    const rows = Array.from(byDegree.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    degEl.innerHTML = rows.length
      ? `<ul class="lst-list">${rows.map(([d, n]) => `
          <li class="lst-list-item"><i class="fa-solid fa-graduation-cap u-c-primary-text"></i><span class="lst-grow"><strong>${esc(d)}</strong></span><span>${crvFa(n)} استاد</span></li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز استادی ثبت نشده است.</div>';
  }

  // ---- incomplete profiles ----
  const healthEl = document.getElementById('ins-bento-health');
  if (healthEl) {
    const issues = [];
    all.forEach(i => {
      const p = [];
      if (!i.avatarUrl) p.push('بدون تصویر');
      if (!i.degree) p.push('بدون مدرک');
      if (!i.resume) p.push('بدون رزومه');
      if (!i.phoneNumber) p.push('بدون شماره تماس');
      if (p.length) issues.push({ i, p });
    });
    healthEl.innerHTML = issues.length
      ? `<ul class="lst-list">${issues.slice(0, 6).map(({ i, p }) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openInstructorView" data-click-args="${crvArgs(i.id)}">
            <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
            <span class="lst-grow"><strong>${esc(i.name)}</strong>: ${esc(p.join('، '))}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> مشخصات همه اساتید کامل است.</div>';
  }
}

window.insSetLoading = function(on) {
  const overview = document.getElementById('ins-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('ins-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.globalInstructorsList || []).length) return;
  if (grid) {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="crv-card lst-skel" aria-hidden="true">
        <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
        <span class="lst-skel-line lst-skel-short"></span>
        <span class="lst-skel-line"></span>
      </div>`).join('');
  }
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['ins-bento-degrees', 'ins-bento-health'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = lines; });
};

// ==================== INSTRUCTOR PAGE ====================

window.openInstructorView = function(id) {
  const overview = document.getElementById('ins-overview-view');
  window.insActiveId = String(id);
  crvFadeOut(overview, () => {
    window.loadInstructorPage();
    document.getElementById('instructors-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeInstructorView = function() {
  const view = document.getElementById('instructor-detail-view');
  const overview = document.getElementById('ins-overview-view');
  window.insActiveId = null;
  window.insRenderedId = null;
  crvFadeOut(view, () => {
    if (window.insActiveId) return;
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectInstructorCircle = function(id) {
  window.insActiveId = String(id);
  window.loadInstructorPage();
};
window.editActiveInstructor = function() { if (window.insActiveId) window.openInstructorModal(window.insActiveId); };
window.deleteActiveInstructor = function() { if (window.insActiveId) window.deleteInstructorRecord(window.insActiveId); };

window.toggleActiveInstructor = async function() {
  const inst = insFind(window.insActiveId);
  if (!inst) return;
  const next = inst.isActive === false;
  try {
    const res = await request(`/api/v1/admin/instructors/${encodeURIComponent(inst.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inst, sessions: undefined, isActive: next })
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return showToast(d.error || 'خطا در تغییر وضعیت استاد', 'error');
    }
    // «لغو» within 10s sends the instructor back as it was (the server resets what is not sent)
    NopaUndo.afterEdit({
      message: next ? 'استاد فعال شد.' : 'استاد غیرفعال شد.',
      url: `/api/v1/admin/instructors/${encodeURIComponent(inst.id)}`,
      revert: { ...inst, sessions: undefined },
      done: () => window.fetchInstructorsList(),
    });
    await window.fetchInstructorsList();
  } catch (e) {
    showToast('ارتباط با سرور برقرار نشد: ' + e.message, 'error');
  }
};

function insCircles(activeId) {
  return (window.globalInstructorsList || []).map(i => {
    const active = String(i.id) === String(activeId);
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="ic:${esc(i.id)}" data-click="selectInstructorCircle" data-click-args="${crvArgs(i.id)}" title="${esc(i.name)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${i.avatarUrl ? `<img src="${esc(i.avatarUrl)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(i.name)}"]'>` : `<span>${crvInitial(i.name)}</span>`}</span>
          <span class="lsv-circle-badge ${i.isActive === false ? 'lsv-state-locked' : 'lsv-state-active'}"><i class="fa-solid ${i.isActive === false ? 'fa-pause' : 'fa-check'}"></i></span>
        </span>
        <span class="lsv-circle-name"><span>${esc(i.name)}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="ic-add" data-click="openInstructorModal" title="ثبت استاد جدید" aria-label="ثبت استاد جدید">
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span>
          <span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span>
        </span>
        <span class="lsv-circle-name"><span>استاد جدید</span></span>
      </button>`;
}

function insInfoCard(inst, detail) {
  const sessions = detail ? (detail.sessions || []) : null;
  const stations = sessions ? new Set(sessions.map(s => s.category?.station?.id).filter(Boolean)).size : null;
  const facts = [
    inst.degree ? `<span><i class="fa-solid fa-graduation-cap"></i> ${esc(inst.degree)}</span>` : '',
    inst.nationalId ? `<span><i class="fa-solid fa-id-card"></i> ${esc(inst.nationalId)}</span>` : '',
    inst.createdAt ? `<span><i class="fa-solid fa-calendar-plus"></i> ${esc(new Date(inst.createdAt).toLocaleDateString('fa-IR'))}</span>` : '',
  ].filter(Boolean).join('');
  return `
    ${crvAvatar(inst.avatarUrl, inst.name, 'crv-mentor-photo')}
    <strong class="crv-mentor-name">${esc(inst.name)}</strong>
    ${inst.phoneNumber ? `<span class="crv-mentor-phone" dir="ltr">${esc(inst.phoneNumber)}</span>` : ''}
    <div class="mnt-mini">
      <span><strong>${sessions === null ? '…' : crvFa(sessions.length)}</strong><small>جلسه</small></span>
      <span><strong>${stations === null ? '…' : crvFa(stations)}</strong><small>منزلگاه</small></span>
      <span><strong>${crvFa(insClasses(inst).length)}</strong><small>کلاس</small></span>
    </div>
    ${facts ? `<div class="lsv-facts crv-mentor-facts">${facts}</div>` : ''}
    <div class="mnt-info-actions">
      <button type="button" class="lsv-pill" data-click="openInstructorModal" data-click-args="${crvArgs(inst.id)}"><i class="fa-solid fa-pen"></i> ویرایش</button>
      <button type="button" class="lse-btn" data-click="toggleActiveInstructor"><i class="fa-solid fa-power-off"></i> ${inst.isActive === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'}</button>
    </div>`;
}

function insSessionRow(s) {
  const where = [s.category?.station?.title, s.category?.title].filter(Boolean).join(' · ');
  const when = [s.sessionDate, s.sessionTime].filter(Boolean).join(' · ');
  return `
    <div class="lsv-row crv-member" data-anim-key="is:${esc(s.id)}">
      <span class="lsv-row-avatar lsv-row-num"><i class="fa-solid ${s.videoUrl ? 'fa-circle-play' : 'fa-chalkboard'}"></i></span>
      <span class="lsv-row-text">
        <strong>${esc(s.title || 'جلسه')}</strong>
        <span>${esc(where || 'منزلگاه نامشخص')}${when ? ` · ${esc(when)}` : ''}</span>
      </span>
    </div>`;
}

function insPaint(inst, detail) {
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('ins-title', el => { el.textContent = inst.name || 'استاد'; });
  set('ins-state', el => { el.innerHTML = insStatusChip(inst); });
  set('ins-sub', el => { el.textContent = inst.degree || 'مدرک ثبت نشده'; });
  set('ins-circles', el => { el.innerHTML = insCircles(inst.id); });
  set('ins-info-card', el => { el.innerHTML = insInfoCard(inst, detail); });
  set('ins-toggle-active', el => { el.title = inst.isActive === false ? 'فعال‌سازی استاد' : 'غیرفعال‌سازی استاد'; });

  const sessions = detail ? (detail.sessions || []) : null;
  set('ins-sessions-count', el => { el.textContent = sessions === null ? '…' : crvFa(sessions.length); });
  set('ins-sessions-card', el => { el.classList.toggle('is-loading', !detail); });
  set('ins-sessions-list', el => {
    if (!detail) {
      el.innerHTML = Array.from({ length: 4 }, () => `
        <div class="lsv-row crv-member" aria-hidden="true"><span class="lsv-row-avatar lst-skel-avatar"></span>
          <span class="lsv-row-text"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></span></div>`).join('');
      return;
    }
    el.innerHTML = sessions.length
      ? sessions.map(insSessionRow).join('')
      : '<div class="lsv-col-empty">هنوز جلسه‌ای در منزلگاه‌ها به نام این استاد ثبت نشده است.</div>';
  });

  const classes = insClasses(inst);
  set('ins-resume-card', el => {
    el.innerHTML = `
      <div class="ins-block">
        <h5><i class="fa-solid fa-book-open-reader"></i> کلاس‌ها و سرفصل‌ها</h5>
        ${classes.length ? `<div class="ins-chips">${classes.map(c => `<span class="ins-chip">${esc(c)}</span>`).join('')}</div>` : '<p class="ins-empty">ثبت نشده</p>'}
      </div>
      <div class="ins-block">
        <h5><i class="fa-solid fa-file-lines"></i> سوابق علمی و رزومه</h5>
        ${inst.resume ? `<p>${esc(inst.resume)}</p>` : '<p class="ins-empty">ثبت نشده</p>'}
      </div>
      <div class="ins-block">
        <h5><i class="fa-solid fa-align-right"></i> معرفی و بیوگرافی</h5>
        ${inst.description ? `<p>${esc(inst.description)}</p>` : '<p class="ins-empty">ثبت نشده</p>'}
      </div>`;
  });
}

window.loadInstructorPage = async function() {
  const view = document.getElementById('instructor-detail-view');
  const overview = document.getElementById('ins-overview-view');
  const id = window.insActiveId;
  const inst = id && insFind(id);
  if (!view || !inst) return;

  const cached = insDetailCache.get(id) || null;
  const wasOpen = view.style.display !== 'none';
  const same = wasOpen && window.insRenderedId === id;
  window.insRenderedId = id;
  if (overview) overview.style.display = 'none';
  view.style.display = 'block';
  if (same && window.NopaFlip) window.NopaFlip.render(view, () => insPaint(inst, cached));
  else {
    insPaint(inst, cached);
    if (window.NopaFlip) {
      // switching instructors keeps the header and the circles still; opening animates everything in
      window.NopaFlip.enter(view.querySelectorAll(wasOpen ? '.ins-flow > .lsv-col, .ins-flow > .lsv-link' : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .ins-flow > .lsv-col'));
      const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
      if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }
  mntFitNotch(view);

  // The sessions that name this instructor: always refreshed, drawn when this instructor is still open
  let detail = null;
  try {
    const res = await request(`/api/v1/admin/instructors/${encodeURIComponent(id)}`);
    if (res.ok) detail = (await res.json()).data || null;
  } catch (_) {}
  if (window.insActiveId !== id) return;
  if (!detail) {
    if (!cached) insPaint(inst, { sessions: [] });
    return;
  }
  insDetailCache.set(id, detail);
  const fresh = insFind(id) || inst;
  if (window.NopaFlip) window.NopaFlip.render(view, () => insPaint(fresh, detail)); else insPaint(fresh, detail);
};

window.previewInstructorAvatar = function() {
  const url = (document.getElementById('inst-avatar')?.value || '').trim();
  const img = document.getElementById('inst-avatar-preview');
  const box = document.getElementById('inst-avatar-preview-container');
  if (!img || !box) return;
  img.hidden = !url;
  if (url) img.src = url; else img.removeAttribute('src');
  const icon = box.querySelector('i');
  if (icon) icon.hidden = !!url;
};

// Open Instructor Create / Edit Modal
window.openInstructorModal = function(instructorId = null) {
  const modal = document.getElementById('instructor-form-modal');
  if (!modal) return;

  const form = document.getElementById('instructor-creator-form');
  if (form) form.reset();
  document.getElementById('inst-id').value = '';

  const inst = instructorId ? insFind(instructorId) : null;
  if (inst) {
    document.getElementById('instructor-modal-title').textContent = `ویرایش استاد: ${inst.name}`;
    document.getElementById('inst-id').value = inst.id;
    document.getElementById('inst-name').value = inst.name || '';
    document.getElementById('inst-phone').value = inst.phoneNumber || '';
    document.getElementById('inst-national-id').value = inst.nationalId || '';
    document.getElementById('inst-degree').value = inst.degree || '';
    document.getElementById('inst-classes').value = inst.classes || '';
    document.getElementById('inst-avatar').value = inst.avatarUrl || '';
    document.getElementById('inst-resume').value = inst.resume || '';
    document.getElementById('inst-desc').value = inst.description || '';
  } else {
    document.getElementById('instructor-modal-title').textContent = 'ثبت استاد جدید';
  }
  window.previewInstructorAvatar();

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

if (!(window.globalInstructorsList || []).length) window.insSetLoading(true);

// Target block tracking for quick instructor addition from station category card
window.lastTargetCategoryBlockId = null;

window.openInstructorModalQuick = function(blockId = null) {
  window.lastTargetCategoryBlockId = blockId;
  window.openInstructorModal();
};

// Save Instructor Form
window.saveInstructorForm = async function(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('inst-id')?.value;
  const name = document.getElementById('inst-name')?.value?.trim();
  const phoneNumber = document.getElementById('inst-phone')?.value?.trim();
  const nationalId = document.getElementById('inst-national-id')?.value?.trim();
  const degree = document.getElementById('inst-degree')?.value?.trim();
  const classes = document.getElementById('inst-classes')?.value?.trim();
  const avatarUrl = document.getElementById('inst-avatar')?.value?.trim();
  const resume = document.getElementById('inst-resume')?.value?.trim();
  const description = document.getElementById('inst-desc')?.value?.trim();

  if (!name) {
    showToast('نام استاد الزامی است.', 'error');
    return;
  }

  const payload = {
    id: id || undefined,
    name,
    phoneNumber,
    nationalId,
    degree,
    classes,
    avatarUrl,
    resume,
    description,
    // the server resets what is not sent: keep the instructor's status and order on edit
    isActive: id ? insFind(id)?.isActive !== false : true,
    orderIndex: id ? (insFind(id)?.orderIndex || 0) : 0
  };


  try {
    const url = id ? `/api/v1/admin/instructors/${id}` : '/api/v1/admin/instructors';
    const method = id ? 'PUT' : 'POST';

    const res = await request(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const old = id ? insFind(id) : null;
      if (old) {
        // an edit: «لغو» within 10s sends the instructor back as it was (the server resets what is not sent)
        NopaUndo.afterEdit({
          message: 'اطلاعات استاد ذخیره شد.',
          url,
          body: payload,
          before: old,
          revert: Object.keys(payload).some(k => k !== 'id' && JSON.stringify(old[k] ?? '') !== JSON.stringify(payload[k] ?? '')) ? { ...old, sessions: undefined } : {},
          done: () => window.fetchInstructorsList(),
        });
      } else {
        showToast('اطلاعات استاد با موفقیت در بانک اساتید ذخیره شد.', 'success');
      }
      document.getElementById('instructor-form-modal').style.display = 'none';
      await window.fetchInstructorsList();

      // If opened from a specific category block in LMS modal, auto-select this new instructor
      if (window.lastTargetCategoryBlockId) {
        window.selectInstructorForBlock(window.lastTargetCategoryBlockId, name, true);
        window.lastTargetCategoryBlockId = null;
      }
    } else {
      const errData = await res.json();
      showToast('خطا در ذخیره استاد: ' + (errData.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save instructor error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

// Delete Instructor
window.deleteInstructorRecord = async function(id) {
  const inst = window.globalInstructorsList.find(i => i.id === id);
  const instName = inst ? inst.name : 'این استاد';

  if (!(await NopaConfirm(`آیا از حذف «${instName}» از بانک اساتید اطمینان دارید؟`))) return;


  // Gone from the table at once; deleted on the server only if not undone within 10s
  NopaUndo.later({
    message: `«${instName}» از بانک اساتید حذف شد.`,
    hide: () => {
      const list = window.globalInstructorsList;
      const at = list.findIndex(i => i.id === id);
      if (at < 0) return null;
      const [removed] = list.splice(at, 1);
      window.renderInstructorsTable();
      return () => {
        if (window.globalInstructorsList.some(i => i.id === id)) return;
        window.globalInstructorsList.splice(Math.min(at, window.globalInstructorsList.length), 0, removed);
        window.renderInstructorsTable();
      };
    },
    commit: () => request(`/api/v1/admin/instructors/${id}`, { method: 'DELETE' }),
    done: () => window.fetchInstructorsList(),
  });
};

// ==================== MULTI-INSTRUCTOR SELECTOR FOR CATEGORY CARDS ====================

// Toggle dropdown visibility
window.toggleInstructorDropdown = function(blockId, event) {
  if (event) {
    // If clicked on remove tag button, don't toggle dropdown
    if (event.target.closest('.inst-tag-remove-btn')) return;
  }

  const dropdown = document.getElementById(`inst-dropdown-${blockId}`);
  if (!dropdown) return;

  const isVisible = dropdown.style.display === 'block';

  // Close all other open instructor dropdowns
  document.querySelectorAll('.inst-dropdown-menu').forEach(d => d.style.display = 'none');

  if (!isVisible) {
    window.populateInstructorDropdownOptions(blockId);
    dropdown.style.display = 'block';
  } else {
    dropdown.style.display = 'none';
  }
};

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.inst-picker-wrapper')) {
    document.querySelectorAll('.inst-dropdown-menu').forEach(d => d.style.display = 'none');
  }
});

// Render the selected instructor tags and hidden input
window.renderSelectedInstructorBadges = function(blockId) {
  const block = document.getElementById(blockId);
  if (!block) return;

  const hiddenInput = block.querySelector('.modal-cat-instructor');
  const box = document.getElementById(`inst-picker-box-${blockId}`);
  if (!hiddenInput || !box) return;

  const rawVal = hiddenInput.value || '';
  const selectedNames = rawVal
    .split(/[،,]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (selectedNames.length === 0) {
    box.innerHTML = `<span class="u-c-text-faint u-fs-xs u-select-none">یک یا چند استاد را از بانک اساتید انتخاب کنید...</span>`;
    return;
  }

  let html = '';
  selectedNames.forEach(name => {
    html += `
      <span class="inst-selected-tag u-bg-primary-20 u-bd-primary-45 u-c-primary-text u-fs-xs u-bold u-p-2-8 u-r-6 u-inline-flex u-items-center u-gap-6">
        <i class="fa-solid fa-user-check u-fs-2xs"></i>
        <span>${esc(name)}</span>
        <span role="button" tabindex="0" aria-label="حذف استاد" class="inst-tag-remove-btn u-pointer u-c-danger-text u-fs-sm u-lh-1 u-p-0-2" data-click="removeInstructorFromBlock" data-click-args="${esc(JSON.stringify([String(blockId), String(name), "$event"]))}" title="حذف">&times;</span>
      </span>
    `;
  });

  box.innerHTML = html;
};

// Populate dropdown options with checkboxes from globalInstructorsList
window.populateInstructorDropdownOptions = function(blockId) {
  const block = document.getElementById(blockId);
  if (!block) return;

  const hiddenInput = block.querySelector('.modal-cat-instructor');
  const dropdown = document.getElementById(`inst-dropdown-${blockId}`);
  if (!hiddenInput || !dropdown) return;

  const rawVal = hiddenInput.value || '';
  const selectedNames = new Set(
    rawVal
      .split(/[،,]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
  );

  const instructors = window.globalInstructorsList || [];

  if (instructors.length === 0) {
    dropdown.innerHTML = `
      <div class="u-p-10 u-text-center u-c-text-muted u-fs-xs">
        <div>هیچ استادی در بانک اساتید ثبت نشده است.</div>
        <button type="button" data-click="openInstructorModalQuick" data-click-args="${esc(JSON.stringify([String(blockId)]))}" class="u-mt-6 u-bg-primary u-c-white u-bd-none u-p-4-10 u-r-6 u-fs-2xs u-pointer">
          <i class="fa-solid fa-plus"></i> ثبت اولین استاد
        </button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="u-p-4-6 u-bb-fg-8 u-mb-6 u-flex u-justify-between u-items-center">
      <span class="u-fs-2xs u-c-text-muted"><i class="fa-solid fa-database u-c-primary-text"></i> اساتید ثبت‌شده در بانک:</span>
      <button type="button" data-click="openInstructorModalQuick" data-click-args="${esc(JSON.stringify([String(blockId)]))}" class="u-bg-none u-bd-none u-c-primary-text u-fs-2xs u-pointer u-flex u-items-center u-gap-4">
        <i class="fa-solid fa-plus"></i> افزودن جدید
      </button>
    </div>
    <div class="u-flex u-col u-gap-4">
  `;

  instructors.forEach(inst => {
    const isChecked = selectedNames.has(inst.name);
    html += `
      <label class="u-flex u-items-center u-justify-between u-p-6-8 u-r-6 u-pointer u-tr-background-0_15s" data-style="background: ${isChecked ? 'rgb(var(--primary-rgb) / 0.15)' : 'transparent'}" data-hover="primary-soft">
        <div class="u-flex u-items-center u-gap-8">
          <input type="checkbox" ${isChecked ? 'checked' : ''} data-change="selectInstructorForBlock" data-change-args="${esc(JSON.stringify([String(blockId), String(inst.name), "$checked"]))}" class="u-pointer u-w-15 u-h-15 u-accent-primary">
          <div>
            <div class="u-fs-sm u-bold u-c-text">${esc(inst.name)}</div>
            <div class="u-fs-2xs u-c-text-muted">${esc(inst.degree || inst.classes || 'مدرس دوره')}</div>
          </div>
        </div>
        ${inst.avatarUrl ? `<img src="${esc(inst.avatarUrl)}" class="u-w-24 u-h-24 u-r-50p u-fit-cover">` : ''}
      </label>
    `;
  });

  html += `</div>`;
  dropdown.innerHTML = html;
};

// Check or uncheck instructor for a category block
window.selectInstructorForBlock = function(blockId, instName, isChecked) {
  const block = document.getElementById(blockId);
  if (!block) return;

  const hiddenInput = block.querySelector('.modal-cat-instructor');
  if (!hiddenInput) return;

  const rawVal = hiddenInput.value || '';
  let selectedNames = rawVal
    .split(/[،,]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (isChecked) {
    if (!selectedNames.includes(instName)) {
      selectedNames.push(instName);
    }
  } else {
    selectedNames = selectedNames.filter(n => n !== instName);
  }

  hiddenInput.value = selectedNames.join('، ');
  // lets the station editor's draft see the change (js/features/lms/station-editor.js)
  hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
  window.renderSelectedInstructorBadges(blockId);
  window.populateInstructorDropdownOptions(blockId);
};

// Remove instructor from selected badges
window.removeInstructorFromBlock = function(blockId, instName, event) {
  if (event) event.stopPropagation();
  window.selectInstructorForBlock(blockId, instName, false);
};

// Re-render all instructor pickers currently on screen
window.refreshAllInstructorPickers = function() {
  document.querySelectorAll('.modal-category-card, [data-inst-picker]').forEach(card => {
    window.renderSelectedInstructorBadges(card.id);
  });
};

// Initial load happens in showDashboard() (js/app/bootstrap.js), i.e. only once the user is signed in
