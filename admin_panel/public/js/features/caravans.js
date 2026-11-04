// Caravans: list, wizard, drawer + roster, members, bulk transfer, mentor change, asset conversions.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// 4. CARAVANS & MENTORS
// Like the stations tab: a bento overview of all caravans (#crv-overview-view) and one caravan's page
// (#caravan-detail-view, see "CARAVAN PAGE" below). Styles: css/stations.css (.lst-*, .lsv-*, .crv-*).
window.caravansData = [];
window.crvActiveCaravanId = null;

async function loadCaravansTab() {
  window.crvSetLoading(true);
  try {
    const res = await request('/api/v1/admin/caravans');
    if (!res.ok) {
      console.warn('Failed to load /api/v1/admin/caravans');
      crvShowError('خطا در دریافت کاروان‌ها');
      return;
    }
    const data = await res.json();
    window.caravansData = Array.isArray(data) ? data : (data.caravans || data.data || []);

    // Populate Mentor Filter
    const mentorSelect = document.getElementById('caravan-mentor-filter');
    if (mentorSelect) {
      const current = mentorSelect.value;
      const mentors = new Set(window.caravansData.map(c => c.mentor?.name || c.mentorName || '-').filter(n => n !== '-'));
      mentorSelect.innerHTML = '<option value="all">همه راهبران</option>' +
        Array.from(mentors).map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
      if (current && Array.from(mentorSelect.options).some(o => o.value === current)) mentorSelect.value = current;
    }

    // Populate Caravan Picker (the chosen caravan, read by the member / mentor modals)
    const caravanPicker = document.getElementById('target-caravan-picker');
    if (caravanPicker) {
      const currentVal = caravanPicker.value;
      caravanPicker.innerHTML = '<option value="">-- لطفاً یک کاروان انتخاب کنید --</option>' +
        window.caravansData.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      if (currentVal && window.caravansData.some(c => c.id === currentVal)) caravanPicker.value = currentVal;
    }

    window.crvSetLoading(false);
    renderCaravansTable();

    // The open caravan page follows the new data; a deleted caravan sends it back to the overview
    if (window.crvActiveCaravanId) {
      if (window.caravansData.some(c => String(c.id) === String(window.crvActiveCaravanId))) {
        if (caravanPicker) caravanPicker.value = window.crvActiveCaravanId;
        window.loadSelectedCaravanDetails();
      } else {
        window.closeCaravanView();
      }
    }
  } catch (err) {
    console.error('loadCaravansTab error:', err);
    crvShowError('خطا در دریافت کاروان‌ها');
  }
}
window.loadCaravansTab = loadCaravansTab;

function crvShowError(text) {
  window.crvSetLoading(false);
  const grid = document.getElementById('crv-bento-caravans');
  if (grid) grid.innerHTML = `<div class="lst-empty"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> ${esc(text)}</div>`;
}

// ---- numbers of one caravan (list rows carry their students; details carry wealth) ----
function crvMembersOf(c) {
  return c.membersList || c.members || [];
}
function crvMemberCount(c) {
  return c._count?.members ?? (crvMembersOf(c).length || c.memberCount || 0);
}
function crvCapacity(c) {
  return Number(c.capacityLimit ?? c.capacity ?? 25) || 25;
}
function crvZarikOf(c) {
  const members = crvMembersOf(c);
  if (members.length) return members.reduce((n, m) => n + Number(m.zarikBalance ?? m.zarik ?? 0), 0);
  return Number(c.assets?.zarik ?? c.totalWealth ?? c.wealth?.zarik ?? 0);
}
function crvProgressOf(c) {
  return Math.round(Number(c.overallProgress ?? c.progress ?? 0)) || 0;
}
function crvMentorName(c) {
  return c.mentor?.name || (c.mentorName && c.mentorName !== 'فاقد راهبر' ? c.mentorName : '');
}
function crvArgs(...a) {
  return esc(JSON.stringify(a.map(String)));
}
function crvFa(n) {
  return Number(n || 0).toLocaleString('fa-IR');
}
function crvInitial(name) {
  return esc(String(name || '؟').trim().charAt(0) || '؟');
}
// A round picture (avatar / cover); without one, or when it fails to load, the name's first letter
function crvAvatar(url, name, cls) {
  const src = String(url || '').trim();
  return src
    ? `<span class="${cls}"><img src="${esc(src)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(name)}"]'></span>`
    : `<span class="${cls}">${crvInitial(name)}</span>`;
}
function crvStatusChip(c) {
  return c.status === 'suspended'
    ? '<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-pause"></i> تعلیق‌شده</span>'
    : '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-circle-check"></i> فعال</span>';
}

// ==================== OVERVIEW (BENTO) ====================

window.renderCaravansTable = function() {
  const draw = () => crvDrawBento();
  const overview = document.getElementById('crv-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, draw); else draw();
};

function crvDrawBento() {
  const all = window.caravansData || [];
  const searchQuery = (document.getElementById('caravan-search-input')?.value || '').toLowerCase().trim();
  const sortBy = document.getElementById('caravan-sort-select')?.value || 'newest';
  const mentorFilter = document.getElementById('caravan-mentor-filter')?.value || 'all';

  const filtered = all.filter(c => {
    const mName = crvMentorName(c);
    const cName = c.name || c.title || '';
    const matchesSearch = !searchQuery ||
                          cName.toLowerCase().includes(searchQuery) ||
                          mName.toLowerCase().includes(searchQuery) ||
                          (c.id && c.id.toLowerCase().includes(searchQuery));
    const matchesMentor = mentorFilter === 'all' || mName === mentorFilter;
    return matchesSearch && matchesMentor;
  });
  if (sortBy === 'most_members') filtered.sort((a, b) => crvMemberCount(b) - crvMemberCount(a));
  else if (sortBy === 'highest_zarik') filtered.sort((a, b) => crvZarikOf(b) - crvZarikOf(a));
  else if (sortBy === 'highest_progress') filtered.sort((a, b) => crvProgressOf(b) - crvProgressOf(a));

  // ---- all caravans: one card each, then a "new caravan" card ----
  const grid = document.getElementById('crv-bento-caravans');
  if (grid) {
    const cards = filtered.map(c => {
      const count = crvMemberCount(c);
      const cap = crvCapacity(c);
      const fill = Math.min(100, Math.round(count / cap * 100));
      const mentor = crvMentorName(c);
      const faces = crvMembersOf(c).slice(0, 4).map(m => crvAvatar(m.avatarUrl, m.name, 'crv-face')).join('');
      const more = count > 4 ? `<span class="crv-face crv-face-more">+${crvFa(count - 4)}</span>` : '';
      return `
        <button type="button" class="crv-card" data-anim-key="cv:${esc(c.id)}" data-click="openCaravanView" data-click-args="${crvArgs(c.id)}" title="ورود به ${esc(c.name || '')}">
          <span class="crv-card-top">
            ${crvAvatar(c.coverImageUrl, c.name, 'crv-card-cover')}
            <span class="crv-card-name"><strong>${esc(c.name || c.title || '')}</strong>${crvStatusChip(c)}</span>
          </span>
          <span class="crv-card-mentor">
            ${crvAvatar(c.mentor?.avatarUrl, mentor || '؟', 'crv-face')}
            <span>${mentor ? esc(mentor) : '<em>بدون راهبر</em>'}</span>
          </span>
          <span class="crv-card-cap">
            <span>ظرفیت</span><strong>${crvFa(count)} / ${crvFa(cap)}</strong>
          </span>
          <span class="lst-bar"><span class="${fill >= 100 ? 'lst-bar-locked' : fill >= 80 ? 'lst-bar-scheduled' : 'lst-bar-active'}" data-style="width:${fill}%"></span></span>
          <span class="crv-card-foot">
            <span class="crv-faces">${faces}${more}</span>
            <span class="crv-card-nums">
              <span class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ${crvFa(crvZarikOf(c))}</span>
              <span class="u-c-success-text"><i class="fa-solid fa-route"></i> ${crvFa(crvProgressOf(c))}٪</span>
            </span>
          </span>
        </button>`;
    });
    if (!searchQuery && mentorFilter === 'all') {
      cards.push(`
        <button type="button" class="crv-card crv-card-add" data-anim-key="cv-add" data-click="openCaravanWizard" title="ساخت کاروان جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          <span>کاروان جدید</span>
        </button>`);
    } else if (!filtered.length) {
      cards.push('<div class="lst-empty" data-anim-key="cv-empty">کاروانی با این مشخصات یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  // ---- stats ----
  const totalMembers = all.reduce((n, c) => n + crvMemberCount(c), 0);
  const totalZarik = all.reduce((n, c) => n + crvZarikOf(c), 0);
  const avgProgress = all.length ? Math.round(all.reduce((n, c) => n + crvProgressOf(c), 0) / all.length) : 0;
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('crv-stat-caravans', crvFa(all.length));
  setStat('crv-stat-members', crvFa(totalMembers));
  setStat('crv-stat-zarik', crvFa(totalZarik));
  setStat('crv-stat-progress', `${crvFa(avgProgress)}٪`);

  // ---- capacity ----
  const capEl = document.getElementById('crv-bento-capacity');
  if (capEl) {
    const counts = { open: 0, near: 0, full: 0 };
    all.forEach(c => {
      const r = crvMemberCount(c) / crvCapacity(c);
      counts[r >= 1 ? 'full' : r >= 0.8 ? 'near' : 'open']++;
    });
    const total = all.length || 1;
    const pct = k => (counts[k] / total * 100).toFixed(1);
    capEl.innerHTML = `
      <div class="lst-bar">
        <span class="lst-bar-active" data-style="width:${pct('open')}%"></span>
        <span class="lst-bar-scheduled" data-style="width:${pct('near')}%"></span>
        <span class="lst-bar-locked" data-style="width:${pct('full')}%"></span>
      </div>
      <div class="lst-legend">
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-active"></span>جای خالی دارد</span><strong>${crvFa(counts.open)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-scheduled"></span>نزدیک به تکمیل</span><strong>${crvFa(counts.near)}</strong></div>
        <div class="lst-legend-row"><span><span class="lst-dot lst-dot-locked"></span>تکمیل ظرفیت</span><strong>${crvFa(counts.full)}</strong></div>
      </div>`;
  }

  // ---- richest caravans ----
  const topEl = document.getElementById('crv-bento-top');
  if (topEl) {
    const top = all.slice().sort((a, b) => crvZarikOf(b) - crvZarikOf(a)).slice(0, 4);
    topEl.innerHTML = top.length
      ? `<ul class="lst-list">${top.map((c, i) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openCaravanView" data-click-args="${crvArgs(c.id)}">
            <span class="crv-rank">${crvFa(i + 1)}</span>
            <span class="lst-grow"><strong>${esc(c.name || '')}</strong></span>
            <span class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ${crvFa(crvZarikOf(c))}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز کاروانی ساخته نشده است.</div>';
  }

  // ---- mentors ----
  const mentorsEl = document.getElementById('crv-bento-mentors');
  if (mentorsEl) {
    const byMentor = new Map();
    all.forEach(c => {
      const name = crvMentorName(c);
      if (!name) return;
      const rec = byMentor.get(name) || { caravans: 0, members: 0, avatarUrl: c.mentor?.avatarUrl };
      rec.caravans++;
      rec.members += crvMemberCount(c);
      byMentor.set(name, rec);
    });
    const rows = Array.from(byMentor.entries()).sort((a, b) => b[1].members - a[1].members).slice(0, 4);
    mentorsEl.innerHTML = rows.length
      ? `<ul class="lst-list">${rows.map(([name, r]) => `
          <li class="lst-list-item">
            ${crvAvatar(r.avatarUrl, name, 'lst-avatar')}
            <span class="lst-grow"><strong>${esc(name)}</strong></span>
            <span>${crvFa(r.caravans)} کاروان · ${crvFa(r.members)} عضو</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز راهبری به کاروان‌ها تخصیص داده نشده است.</div>';
  }

  // ---- what needs attention ----
  const healthEl = document.getElementById('crv-bento-health');
  if (healthEl) {
    const issues = [];
    all.forEach(c => {
      const problems = [];
      if (!crvMentorName(c)) problems.push('بدون راهبر');
      if (!crvMemberCount(c)) problems.push('بدون عضو');
      else if (crvMemberCount(c) >= crvCapacity(c)) problems.push('ظرفیت تکمیل');
      if (c.status === 'suspended') problems.push('تعلیق‌شده');
      if (problems.length) issues.push({ c, problems });
    });
    healthEl.innerHTML = issues.length
      ? `<ul class="lst-list">${issues.slice(0, 5).map(({ c, problems }) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="openCaravanView" data-click-args="${crvArgs(c.id)}">
            <i class="fa-solid fa-triangle-exclamation lst-warn"></i>
            <span class="lst-grow"><strong>${esc(c.name || '')}</strong>: ${esc(problems.join('، '))}</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> همه کاروان‌ها راهبر و عضو دارند.</div>';
  }
}

// ==================== LOADING SHIMMER ====================
// Like the stations tab: a light band sweeps over each bento tile until the caravans arrive. On the first load
// the tiles hold skeletons; a refresh keeps the current content under the shimmer.
window.crvSetLoading = function(on) {
  const overview = document.getElementById('crv-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('crv-bento-caravans');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || (window.caravansData || []).length) return;

  if (grid) {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="crv-card lst-skel" aria-hidden="true">
        <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
        <span class="lst-skel-line lst-skel-short"></span>
        <span class="lst-skel-line"></span>
        <span class="lst-skel-line lst-skel-short"></span>
      </div>`).join('');
  }
  const lines = n => `<div class="lst-skel-lines" aria-hidden="true">${'<span class="lst-skel-row"></span>'.repeat(n)}</div>`;
  const fill = { 'crv-bento-capacity': lines(3), 'crv-bento-top': lines(3), 'crv-bento-mentors': lines(3), 'crv-bento-health': lines(3) };
  Object.keys(fill).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = fill[id];
  });
};

window.openRenameCaravanModal = function(id, currentName) {
  const modal = document.getElementById('rename-caravan-modal');
  const idInput = document.getElementById('rename-caravan-id');
  const nameInput = document.getElementById('rename-caravan-name-input');
  
  const caravan = window.caravansData?.find(c => c.id === id);
  const nameToUse = currentName || caravan?.name || caravan?.title || '';

  if (idInput) idInput.value = id;
  if (nameInput) {
    nameInput.value = nameToUse;
    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 100);
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-mobile-nav)';
  } else {
    const promptName = prompt('لطفاً نام جدید کاروان را وارد کنید:', nameToUse);
    if (promptName && promptName.trim() && promptName.trim() !== nameToUse) {
      window.executeRenameCaravan(id, promptName.trim());
    }
  }
};

window.closeRenameCaravanModal = function() {
  const modal = document.getElementById('rename-caravan-modal');
  if (modal) modal.style.display = 'none';
};

window.saveNewCaravanName = async function() {
  const id = document.getElementById('rename-caravan-id')?.value;
  const nameInput = document.getElementById('rename-caravan-name-input');
  const saveBtn = document.getElementById('btn-save-caravan-name');
  if (!id || !nameInput) return;

  const newName = nameInput.value.trim();
  if (!newName) {
    showToast('نام کاروان نمی‌تواند خالی باشد.', 'info');
    nameInput.focus();
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> در حال ذخیره...';
  }

  await window.executeRenameCaravan(id, newName);

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> ذخیره نام جدید';
  }
};

window.executeRenameCaravan = async function(id, newName) {
  try {
    const res = await request(`/api/v1/admin/caravans/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ name: newName })
    });

    const result = await res.json();
    if (res.ok) {
      window.closeRenameCaravanModal();
      
      // Update in local memory
      if (window.caravansData) {
        const c = window.caravansData.find(item => item.id === id);
        if (c) {
          c.name = newName;
          c.title = newName;
        }
      }

      // Re-render table
      if (typeof window.renderCaravansTable === 'function') {
        window.renderCaravansTable();
      }
      if (window.crvActiveCaravanId) window.loadSelectedCaravanDetails();

      // Update picker dropdown if present
      const picker = document.getElementById('target-caravan-picker');
      if (picker) {
        const opt = picker.querySelector(`option[value="${id}"]`);
        if (opt) opt.textContent = newName;
      }

      showToast('نام کاروان با موفقیت به «' + newName + '» تغییر یافت.', 'success');
    } else {
      showToast('خطا در تغییر نام کاروان: ' + (result.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('executeRenameCaravan error:', err);
    showToast('خطا در برقراری ارتباط با سرور: ' + err.message, 'error');
  }
};

window.openChangeCaravanMentorModalForCaravan = function(id) {
  // the mentor modal reads the chosen caravan from the picker
  const picker = document.getElementById('target-caravan-picker');
  if (picker) picker.value = String(id);
  if (window.openChangeCaravanMentorModal) {
    window.openChangeCaravanMentorModal();
  }
};

window.deleteCaravanRecord = async function(caravanId, caravanName) {
  if (!(await NopaConfirm(`آیا از حذف کاروان "${caravanName || ''}" اطمینان دارید؟ اعضای این کاروان آزاد خواهند شد.`))) {
    return;
  }
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('کاروان با موفقیت حذف گردید.', 'success');
      if (typeof window.loadCaravansTab === 'function') {
        await window.loadCaravansTab();
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'خطا در حذف کاروان', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};

window.removeMemberFromCaravan = async function(caravanId, studentId, memberName) {
  const nameText = memberName ? `«${memberName}»` : 'این فرد';
  if (!(await NopaConfirm(`آیا می‌خواهید ${nameText} را از این کاروان حذف کنید؟`))) {
    return;
  }
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}/members/${studentId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`فرد با موفقیت از این کاروان حذف گردید.`, 'success');
      if (typeof window.loadCaravansTab === 'function') {
        await window.loadCaravansTab();
      }
      const picker = document.getElementById('target-caravan-picker');
      if (picker) {
        picker.value = caravanId;
      }
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'خطا در حذف فرد از کاروان', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};

window.viewStudentDetails = async function(studentId) {
  const modal = document.getElementById('caravan-student-detail-modal');
  if (!modal) return;

  const identityEl = document.getElementById('csd-identity');
  const assetsEl = document.getElementById('csd-assets');
  const progressEl = document.getElementById('csd-progress');
  const ticketsEl = document.getElementById('csd-tickets');

  if (identityEl) identityEl.innerHTML = '<p class="u-c-text-muted u-fs-sm">در حال بارگذاری...</p>';
  if (assetsEl) assetsEl.innerHTML = '<p class="u-c-text-muted u-fs-sm">در حال بارگذاری...</p>';
  if (progressEl) progressEl.innerHTML = '<p class="u-c-text-muted u-fs-sm">در حال بارگذاری...</p>';
  if (ticketsEl) ticketsEl.innerHTML = '<p class="u-c-text-muted u-fs-sm">در حال بارگذاری...</p>';

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';

  try {
    let data = {};
    let u = null;
    let balances = {};
    let watchRecords = [];
    let quizzes = [];
    let tickets = [];
    let metrics = {};

    const res = await request(`/api/v1/admin/users/${studentId}/analytics`);

    if (res.ok) {
      data = await res.json();
      u = data.user || {};
      balances = data.balances || {};
      watchRecords = data.watchRecords || [];
      quizzes = data.quizzes || [];
      tickets = data.tickets || [];
      metrics = data.metrics || {};
    } else {
      const basicRes = await request(`/api/v1/admin/users/${studentId}`);
      if (basicRes.ok) {
        u = await basicRes.json();
        balances = {
          zarik: u.zarikBalance || 0,
          nakh: u.nakh || 0,
          beyragh: u.beyragh || 0,
          farsh: u.farsh || 0
        };
      }
    }

    if (!u) {
      if (identityEl) identityEl.innerHTML = '<p class="u-c-danger-text">کاربر یافت نشد.</p>';
      return;
    }

    // Determine Caravan Name
    let caravanDisplay = u.caravanName || 'فاقد کاروان';
    if (!u.caravanName && u.caravanId) {
      const c = window.caravansData?.find(item => item.id === u.caravanId);
      if (c) caravanDisplay = c.name || c.title || u.caravanId;
    }

    if (identityEl) {
      identityEl.innerHTML = `
        <div class="u-flex u-col u-gap-8">
          <div><strong class="u-c-primary-text">نام و نام‌خانوادگی:</strong> ${esc(u.name || 'بدون نام')}</div>
          <div><strong class="u-c-text-muted">شماره همراه:</strong> <span dir="ltr">${esc(u.phoneNumber || '-')}</span></div>
          <div><strong class="u-c-text-muted">کد کاربری:</strong> <span class="u-mono u-c-primary-text">${u.userCode ? 'NP-' + u.userCode : (u.id ? u.id.slice(0, 8) : '-')}</span></div>
          <div><strong class="u-c-text-muted">کاروان عضو:</strong> <span class="u-bg-primary-15 u-c-primary-text u-p-4-10 u-r-6 u-bold">${caravanDisplay}</span></div>
          <div><strong class="u-c-text-muted">نقش سیستمی:</strong> ${roleLabel(u.role)}</div>
          <div><strong class="u-c-text-muted">کد ملی:</strong> ${esc(u.nationalId || 'ثبت نشده')}</div>
          <div><strong class="u-c-text-muted">تاریخ تولد:</strong> ${esc(u.dateOfBirth || '-')}</div>
          <div><strong class="u-c-text-muted">سطح فریم:</strong> سطح ${u.levelFrame || 1}</div>
        </div>
      `;
    }

    if (assetsEl) {
      assetsEl.innerHTML = `
        <div class="u-flex u-col u-gap-8">
          <div><strong class="u-c-accent-text"><i class="fa-solid fa-coins"></i> موجودی زریک:</strong> <span class="u-fs-md u-bold u-c-accent-text">${(balances.zarik || u.zarikBalance || 0).toLocaleString()}</span> زریک</div>
          <div><strong class="u-c-primary-text"><i class="fa-solid fa-layer-group"></i> کلاف:</strong> ${(balances.nakh || 0).toLocaleString()}</div>
          <div><strong class="u-c-primary-text"><i class="fa-solid fa-flag"></i> درفش:</strong> ${(balances.beyragh || 0).toLocaleString()}</div>
          <div><strong class="u-c-success-text"><i class="fa-solid fa-rug"></i> قالیچه:</strong> ${(balances.farsh || 0).toLocaleString()}</div>
          <div><strong class="u-c-text-muted">مدت فعالیت تقریبی:</strong> ${metrics.approximateActiveMinutes || 0} دقیقه</div>
        </div>
      `;
    }

    if (progressEl) {
      const sp = data.stationsProgress || {};
      const summary = sp.summary || {
        passedStations: 0,
        totalStations: 5,
        totalCategories: 10,
        passedClasses: 0,
        totalClasses: 50,
        passedParts: 0,
        totalParts: 201,
        passedQuizzes: 0,
        totalQuizzes: 331
      };

      const stations = sp.stations || [
        { stationNumber: 1, title: 'منزلگاه ۱: مبانی شناخت و رسانه (شوک و اینشات)', order: 1, isUnlocked: true, isCompleted: false, categoriesCount: 2, totalClasses: 4, completedClasses: 0, partsPerSession: '4', totalParts: 16, completedParts: 0, totalQuizzes: 32, completedQuizzes: 0 },
        { stationNumber: 2, title: 'منزلگاه ۲: خودشناسی جامع و پادکست', order: 2, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 16, completedClasses: 0, partsPerSession: '4', totalParts: 64, completedParts: 0, totalQuizzes: 126, completedQuizzes: 0 },
        { stationNumber: 3, title: 'منزلگاه ۳: شناخت همراهان و دشمنان (کنوا)', order: 3, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 12, completedClasses: 0, partsPerSession: '4.1', totalParts: 49, completedParts: 0, totalQuizzes: 85, completedQuizzes: 0 },
        { stationNumber: 4, title: 'منزلگاه ۴: شناخت هستی (کنوا پیشرفته)', order: 4, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 8, completedClasses: 0, partsPerSession: '4', totalParts: 32, completedParts: 0, totalQuizzes: 46, completedQuizzes: 0 },
        { stationNumber: 5, title: 'منزلگاه ۵: هدف‌گذاری (فتوشاپ)', order: 5, isUnlocked: false, isCompleted: false, categoriesCount: 2, totalClasses: 10, completedClasses: 0, partsPerSession: '4', totalParts: 40, completedParts: 0, totalQuizzes: 42, completedQuizzes: 0 }
      ];

      let stationsHtml = `
        <!-- Summary Stats Counter -->
        <div class="u-grid u-cols-4 u-gap-6 u-mb-12 u-bg-shade-40 u-p-10 u-r-10 u-bd-fg-6 u-text-center">
          <div class="u-p-2">
            <div class="u-c-text-muted u-fs-2xs u-mb-2">منزلگاه‌ها</div>
            <div class="u-bold u-c-success-text u-fs-sm">${summary.passedStations || 0} / ${summary.totalStations || 5}</div>
          </div>
          <div class="u-p-2 u-br-fg-10">
            <div class="u-c-text-muted u-fs-2xs u-mb-2">دسته‌ها / کلاس‌ها</div>
            <div class="u-bold u-c-primary-text u-fs-sm">${summary.passedClasses || 0} / ${summary.totalClasses || 50}</div>
          </div>
          <div class="u-p-2 u-br-fg-10">
            <div class="u-c-text-muted u-fs-2xs u-mb-2">کل پارت‌ها</div>
            <div class="u-bold u-c-primary-text u-fs-sm">${summary.passedParts || 0} / ${summary.totalParts || 201}</div>
          </div>
          <div class="u-p-2 u-br-fg-10">
            <div class="u-c-text-muted u-fs-2xs u-mb-2">آزمونک‌ها</div>
            <div class="u-bold u-c-accent-text u-fs-sm">${summary.passedQuizzes || 0} / ${summary.totalQuizzes || 331}</div>
          </div>
        </div>

        <!-- 5 Stations Progression List -->
        <div class="u-flex u-col u-gap-8 u-maxh-260 u-scroll-y u-pl-4">
      `;

      stations.forEach((st, idx) => {
        const isUnlocked = st.isUnlocked;
        const isCompleted = st.isCompleted || (st.completedClasses > 0 && st.completedClasses >= st.totalClasses);
        const stNum = st.stationNumber || (idx + 1);

        let statusBadge = '';
        let cardBorder = 'rgb(var(--fg-rgb) / 0.06)';
        let cardBg = 'rgb(var(--surface-rgb) / 0.6)';
        let titleColor = 'var(--text-soft)';

        if (isCompleted) {
          statusBadge = '<span class="u-bg-success-20 u-c-success-text u-fs-2xs u-p-2-8 u-r-12 u-bold"><i class="fa-solid fa-circle-check"></i> گذرانده شده</span>';
          cardBorder = 'rgb(var(--success-rgb) / 0.3)';
          cardBg = 'rgb(var(--success-rgb) / 0.05)';
          titleColor = 'var(--success-text)';
        } else if (isUnlocked) {
          statusBadge = '<span class="u-bg-primary-20 u-c-primary-text u-fs-2xs u-p-2-8 u-r-12 u-bold"><i class="fa-solid fa-play"></i> در حال آموزش</span>';
          cardBorder = 'rgb(var(--primary-rgb) / 0.3)';
          cardBg = 'rgb(var(--primary-rgb) / 0.05)';
          titleColor = 'var(--primary-text)';
        } else {
          statusBadge = '<span class="u-bg-danger-15 u-c-danger-text u-fs-2xs u-p-2-8 u-r-12 u-bold"><i class="fa-solid fa-lock"></i> قفل (مسیر آتی)</span>';
          cardBorder = 'rgb(var(--fg-rgb) / 0.04)';
          cardBg = 'rgb(var(--shade-rgb) / 0.25)';
          titleColor = 'var(--text-faint)';
        }

        const pct = st.totalClasses > 0 ? Math.min(100, Math.round(((st.completedClasses || 0) / st.totalClasses) * 100)) : 0;

        stationsHtml += `
          <div class="u-r-10 u-p-10-12 u-fs-xs" data-style="background:${cardBg}; border:1px solid ${cardBorder}">
            <div class="u-flex u-justify-between u-items-center u-mb-8 u-bb-fg-5 u-pb-6">
              <div>
                <span class="u-bg-primary-20 u-c-primary-text u-fs-2xs u-bold u-p-2-8 u-r-6 u-ml-6">منزلگاه ${stNum}</span>
                <strong class="u-fs-sm" data-style="color:${titleColor}">${esc(st.title)}</strong>
              </div>
              ${statusBadge}
            </div>

            <!-- Categorized Metrics Grid -->
            <div class="u-grid u-cols-2 u-gap-6-12 u-fs-xs">
              <div class="u-c-text-muted">
                <i class="fa-solid fa-layer-group u-c-primary-text u-w-16"></i> 
                <strong>دسته‌های کلاس:</strong> <span class="u-c-text u-bold">${st.categoriesCount ?? 0} دسته</span>${Array.isArray(st.categoryTitles) && st.categoryTitles.length ? ` <span class="u-fs-2xs u-c-text-faint">(${esc(st.categoryTitles.join("، "))})</span>` : ""}
              </div>

              <div class="u-c-text-muted">
                <i class="fa-solid fa-chalkboard-user u-c-success-text u-w-16"></i> 
                <strong>تعداد کلاس‌ها:</strong> <span class="u-c-text u-bold">${st.completedClasses || 0}</span> از ${st.totalClasses || 0} جلسه <span class="u-c-success-text u-fs-2xs">(${pct}%)</span>
              </div>

              <div class="u-c-text-muted">
                <i class="fa-solid fa-film u-c-primary-text u-w-16"></i> 
                <strong>پارت‌های هر جلسه:</strong> <span class="u-c-text u-bold">${st.partsPerSession || 4} پارت</span> <span class="u-fs-2xs u-c-primary-text">(مجموعاً ${st.totalParts || 0} پارت)</span>
              </div>

              <div class="u-c-text-muted">
                <i class="fa-solid fa-list-check u-c-accent-text u-w-16"></i> 
                <strong>تعداد آزمون‌ها:</strong> <span class="u-c-accent-text u-bold">${st.completedQuizzes || 0}</span> از ${st.totalQuizzes || 0} آزمونک
              </div>
            </div>
          </div>
        `;
      });

      stationsHtml += `</div>`;
      progressEl.innerHTML = stationsHtml;
    }

    if (ticketsEl) {
      if (tickets.length === 0) {
        ticketsEl.innerHTML = '<p class="u-c-text-muted u-fs-xs">تیکت یا درخواستی ثبت نشده است.</p>';
      } else {
        ticketsEl.innerHTML = tickets.slice(0, 4).map(t => `
          <div class="u-bb-fg-5 u-p-4-0">
            <strong class="u-c-text">${esc(t.subject || 'تیکت پشتیبانی')}</strong>
            <span class="u-c-text-muted u-fs-2xs u-mr-6">[${t.status === 'RESOLVED' ? 'حل شده' : 'در حال بررسی'}]</span>
          </div>
        `).join('');
      }
    }
  } catch(e) {
    console.error('Error fetching student details:', e);
    if (identityEl) identityEl.innerHTML = '<p class="u-c-danger-text u-fs-sm">خطا در دریافت اطلاعات دانش‌آموز</p>';
  }
};

window.setAccountStatus = async function(userId, status) {
  if (!(await NopaConfirm(`آیا از تغییر وضعیت حساب این کاربر اطمینان دارید؟`))) return;
  try {
    // The server route is PATCH /admin/users/:id/status (a PUT here used to 404)
    const res = await request(`/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast('وضعیت حساب کاربر با موفقیت تغییر کرد', 'success');
      if (activeTab === 'users-tab' && typeof loadUsers === 'function') loadUsers();
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'خطا در تغییر وضعیت کاربر', 'error');
    }
  } catch(e) {
    console.error(e);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};

// ==================== CARAVAN PAGE ====================
// Like a station page: the caravans as circles in the board's notch, the leader's card linked to the members'
// card (a "+" row adds members), then the caravan's totals. Switching caravans draws at once from the list
// data; the leader's card and the totals shimmer until the caravan's details arrive (kept for next time).
const crvDetailCache = new Map();
window.crvRenderedCaravanId = null;

// The station page's fade-out; if the animation never finishes (a paused background tab) it still moves on
function crvFadeOut(el, next) {
  let done = false;
  const once = () => { if (!done) { done = true; next(); } };
  if (typeof lmsFadeOut === 'function') lmsFadeOut(el, once); else once();
  setTimeout(once, 400);
}

window.openCaravanView = function(caravanId) {
  const overview = document.getElementById('crv-overview-view');
  const picker = document.getElementById('target-caravan-picker');
  window.crvActiveCaravanId = String(caravanId);
  if (picker) picker.value = String(caravanId);
  crvFadeOut(overview, () => {
    window.loadSelectedCaravanDetails();
    document.getElementById('caravans-tab')?.scrollIntoView({ block: 'start', behavior: NopaMotion.scrollBehavior() });
  });
};

window.closeCaravanView = function() {
  const view = document.getElementById('caravan-detail-view');
  const overview = document.getElementById('crv-overview-view');
  window.crvActiveCaravanId = null;
  window.crvRenderedCaravanId = null;
  crvFadeOut(view, () => {
    if (window.crvActiveCaravanId) return; // another caravan was opened meanwhile
    if (view) view.style.display = 'none';
    if (overview) {
      overview.style.display = '';
      if (window.NopaFlip) window.NopaFlip.enter(overview.querySelectorAll(':scope > div:first-child, .lst-bento > .lst-tile'));
    }
  });
};

window.selectCaravanCircle = function(caravanId) {
  const picker = document.getElementById('target-caravan-picker');
  if (picker) picker.value = String(caravanId);
  window.crvActiveCaravanId = String(caravanId);
  window.loadSelectedCaravanDetails();
};

// Old callers (the caravan drawer, other tabs) open a caravan's page through this
window.selectCaravanForManagement = function(id) {
  window.openCaravanView(id);
};

window.openRenameActiveCaravan = function() {
  const c = (window.caravansData || []).find(x => String(x.id) === String(window.crvActiveCaravanId));
  if (c) window.openRenameCaravanModal(String(c.id), String(c.name || ''));
};

window.deleteActiveCaravan = function() {
  const c = (window.caravansData || []).find(x => String(x.id) === String(window.crvActiveCaravanId));
  if (c) window.deleteCaravanRecord(String(c.id), String(c.name || ''));
};

function crvCaravanCircles(selectedId) {
  return (window.caravansData || []).map(c => {
    const active = String(c.id) === String(selectedId);
    return `
      <button type="button" class="lsv-circle${active ? ' is-active' : ''}" data-anim-key="c:${esc(c.id)}" data-click="selectCaravanCircle" data-click-args="${crvArgs(c.id)}" title="${esc(c.name)}"${active ? ' aria-current="true"' : ''}>
        <span class="lsv-circle-main">
          <span class="lsv-circle-img">${c.coverImageUrl ? `<img src="${esc(c.coverImageUrl)}" alt="" loading="lazy" data-error="lmsImageFallback" data-error-args='["$this", "${crvInitial(c.name)}"]'>` : `<span>${crvInitial(c.name)}</span>`}</span>
          <span class="lsv-circle-badge ${c.status === 'suspended' ? 'lsv-state-locked' : 'lsv-state-active'}">${crvFa(crvMemberCount(c))}</span>
        </span>
        <span class="lsv-circle-name"><span>${esc(c.name)}</span></span>
      </button>`;
  }).join('') + `
      <button type="button" class="lsv-circle lsv-circle-add" data-anim-key="c-add" data-click="openCaravanWizard" title="ساخت کاروان جدید" aria-label="ساخت کاروان جدید">
        <span class="lsv-circle-main">
          <span class="lsv-circle-img"><i class="fa-solid fa-plus"></i></span>
          <span class="lsv-circle-badge lsv-state-add"><i class="fa-solid fa-plus"></i></span>
        </span>
        <span class="lsv-circle-name"><span>ساخت کاروان جدید</span></span>
      </button>`;
}

// The leader's card; until the details arrive only the name is known and the rest shimmers
function crvMentorCard(mentor, loading) {
  if (!mentor || !mentor.name) {
    return loading
      ? '<span class="crv-mentor-photo lst-skel-avatar"></span><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>'
      : `<span class="crv-mentor-photo crv-mentor-none"><i class="fa-solid fa-user-slash"></i></span>
         <strong class="crv-mentor-name">این کاروان راهبر ندارد</strong>
         <button type="button" class="lsv-pill" data-click="openChangeCaravanMentorModal"><i class="fa-solid fa-user-plus"></i> تعیین راهبر</button>`;
  }
  const facts = [
    mentor.userCode ? `<span><i class="fa-solid fa-hashtag"></i> NP-${esc(mentor.userCode)}</span>` : '',
    mentor.mentorLevel ? `<span><i class="fa-solid fa-medal"></i> ${esc(mentor.mentorLevel)}</span>` : '',
    mentor.city ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(mentor.city)}</span>` : '',
    mentor.academicDegree ? `<span><i class="fa-solid fa-graduation-cap"></i> ${esc(mentor.academicDegree)}</span>` : ''
  ].filter(Boolean).join('');
  return `
    ${crvAvatar(mentor.avatarUrl, mentor.name, 'crv-mentor-photo')}
    <strong id="cw-mentor-name" class="crv-mentor-name">${esc(mentor.name)}</strong>
    ${mentor.phoneNumber ? `<span class="crv-mentor-phone" dir="ltr">${esc(mentor.phoneNumber)}</span>` : ''}
    ${loading
      ? '<span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span>'
      : `${facts ? `<div class="lsv-facts crv-mentor-facts">${facts}</div>` : ''}
         ${mentor.bio ? `<p class="crv-mentor-bio">${esc(mentor.bio)}</p>` : ''}`}`;
}

function crvMemberRow(m, caravanId) {
  const name = m.name || m.user?.name || '-';
  const phone = m.phoneNumber || m.user?.phoneNumber || '';
  const code = m.userCode || m.user?.userCode;
  const btn = (icon, title, click, a, extra = '') =>
    `<button type="button" class="lsv-round lsv-round-sm${extra ? ' ' + extra : ''}" data-click="${click}" data-click-args="${a}" title="${title}" aria-label="${title}"><i class="${icon}"></i></button>`;
  return `
    <div class="lsv-row crv-member" data-anim-key="m:${esc(m.id)}">
      ${crvAvatar(m.avatarUrl || m.user?.avatarUrl, name, 'lsv-row-avatar lsv-row-num')}
      <span class="lsv-row-text">
        <strong>${esc(name)}</strong>
        <span>${code ? `NP-${esc(code)}` : ''}${code && phone ? ' · ' : ''}${phone ? `<bdi dir="ltr">${esc(phone)}</bdi>` : ''}</span>
      </span>
      <span class="crv-assets">
        <span class="u-c-accent-text" title="زریک"><i class="fa-solid fa-coins"></i> ${crvFa(m.zarikBalance ?? m.zarik ?? m.assets?.zarik)}</span>
        <span class="u-c-primary-text" title="درفش"><i class="fa-solid fa-flag"></i> ${crvFa(m.beyragh ?? m.derafsh ?? m.assets?.beyragh)}</span>
        <span class="u-c-success-text" title="کلاف"><i class="fa-solid fa-layer-group"></i> ${crvFa(m.nakh ?? m.nokh ?? m.assets?.nakh)}</span>
        <span class="u-c-primary-text" title="قالیچه"><i class="fa-solid fa-rug"></i> ${crvFa(m.farsh ?? m.assets?.farsh)}</span>
      </span>
      <span class="lsv-round-group crv-member-tools">
        ${btn('fa-solid fa-id-card', 'جزئیات', 'viewStudentDetails', crvArgs(m.id))}
        ${btn('fa-solid fa-pen', 'ویرایش', 'openUserModal', crvArgs(m.id, name, m.role || 'student', caravanId))}
        ${btn('fa-solid fa-user-lock', 'تعلیق', 'setAccountStatus', crvArgs(m.id, 'SUSPENDED'))}
        ${btn('fa-solid fa-user-minus', 'حذف از کاروان', 'removeMemberFromCaravan', crvArgs(caravanId, m.id, name), 'lsv-round-danger')}
      </span>
    </div>`;
}

// Draws the caravan page; detail = the caravan's details (leader, wealth, progress) or null while they load
function crvPaint(caravan, detail) {
  const cId = String(caravan.id);
  const loading = !detail;
  const members = crvMembersOf(caravan).length ? crvMembersOf(caravan) : (detail?.membersList || []);
  const mentor = detail?.mentor || caravan.mentor || null;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };

  set('crv-title', el => { el.textContent = caravan.name || 'کاروان'; });
  set('crv-state', el => { el.innerHTML = crvStatusChip(caravan); });
  set('crv-sub', el => { el.textContent = `${crvFa(members.length)} / ${crvFa(crvCapacity(caravan))} عضو · راهبر: ${crvMentorName(caravan) || 'ندارد'}`; });
  set('crv-circles', el => { el.innerHTML = crvCaravanCircles(cId); });
  set('crv-mentor-card', el => {
    el.innerHTML = crvMentorCard(mentor, loading);
    el.classList.toggle('is-loading', loading);
  });
  set('crv-members-count', el => { el.textContent = crvFa(members.length); });
  set('caravan-roster-body', el => {
    const addRow = `
      <button type="button" class="lsv-row lsv-row-add crv-member" data-anim-key="m-add" data-click="openAddMemberToCaravanModal" data-click-args="${crvArgs(cId)}">
        <span class="lsv-row-avatar lsv-row-plus"><i class="fa-solid fa-plus"></i></span>
        <span class="lsv-row-text"><strong>عضو جدید</strong><span>افزودن دانش‌آموز به «${esc(caravan.name || '')}»</span></span>
      </button>`;
    el.innerHTML = (members.length ? members.map(m => crvMemberRow(m, cId)).join('') : '<div class="lsv-col-empty">این کاروان هنوز عضوی ندارد.</div>') + addRow;
  });

  // The assets column: students' totals; progress comes with the details
  let sumZarik = 0, sumBeyragh = 0, sumNokh = 0, sumFarsh = 0;
  if (members.length) {
    members.forEach(m => {
      sumZarik += Number(m.zarikBalance ?? m.zarik ?? m.assets?.zarik ?? 0);
      sumBeyragh += Number(m.beyragh ?? m.derafsh ?? m.assets?.beyragh ?? 0);
      sumNokh += Number(m.nakh ?? m.nokh ?? m.assets?.nakh ?? 0);
      sumFarsh += Number(m.farsh ?? m.assets?.farsh ?? 0);
    });
  } else {
    const w = detail?.wealth || caravan.wealth || caravan.assets || {};
    sumZarik = Number(w.zarik ?? caravan.totalWealth ?? 0);
    sumBeyragh = Number(w.beyragh ?? 0);
    sumNokh = Number(w.nakh ?? w.nokh ?? 0);
    sumFarsh = Number(w.farsh ?? 0);
  }
  set('caravan-detail-zarik', el => { el.textContent = crvFa(sumZarik); });
  set('caravan-detail-derafsh', el => { el.textContent = crvFa(sumBeyragh); });
  set('caravan-detail-nokh', el => { el.textContent = crvFa(sumNokh); });
  set('caravan-detail-farsh', el => { el.textContent = crvFa(sumFarsh); });
  set('caravan-detail-milestones', el => { el.textContent = `${crvFa(Math.round(detail?.overallProgress ?? caravan.overallProgress ?? 0))}٪`; });
  set('crv-totals', el => { el.classList.toggle('is-loading', loading); });
}

window.loadSelectedCaravanDetails = async function() {
  const picker = document.getElementById('target-caravan-picker');
  const view = document.getElementById('caravan-detail-view');
  const overview = document.getElementById('crv-overview-view');
  if (!picker || !view) return;
  // Only the open caravan page is drawn; elsewhere the picker just remembers the chosen caravan
  if (!window.crvActiveCaravanId) return;
  if (picker.value) window.crvActiveCaravanId = picker.value;
  const cId = window.crvActiveCaravanId;

  let caravan = (window.caravansData || []).find(c => String(c.id) === String(cId));
  const cached = crvDetailCache.get(cId) || null;
  if (!caravan) caravan = cached;

  const wasOpen = view.style.display !== 'none';
  const sameCaravan = wasOpen && window.crvRenderedCaravanId === cId;
  if (caravan) {
    window.crvRenderedCaravanId = cId;
    if (overview) overview.style.display = 'none';
    view.style.display = 'block';
    if (sameCaravan && window.NopaFlip) {
      window.NopaFlip.render(view, () => crvPaint(caravan, cached));
    } else {
      crvPaint(caravan, cached);
      if (window.NopaFlip) {
        // switching caravans keeps the header and the circles still; opening animates everything in
        window.NopaFlip.enter(view.querySelectorAll(wasOpen
          ? '.crv-flow > .lsv-col, .crv-flow > .lsv-link'
          : '.lsv-head, .lsv-board, .lsv-notch .lsv-circle, .crv-flow > .lsv-col'));
        const picked = wasOpen && view.querySelector('.lsv-circle.is-active .lsv-circle-img');
        if (picked && typeof picked.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          picked.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        }
      }
    }
    crvFitNotch(view);
  }

  // The caravan's details (leader's full card, progress): always refreshed, drawn when this caravan is still open
  let detail = null;
  try {
    const res = await request(`/api/v1/admin/caravans/${cId}`);
    if (res.ok) detail = await res.json();
  } catch (_) {}
  if (window.crvActiveCaravanId !== cId) return;
  if (!detail) {
    if (!caravan) window.closeCaravanView();
    else document.querySelectorAll('#crv-mentor-card, #crv-totals').forEach(el => el.classList.remove('is-loading'));
    return;
  }
  crvDetailCache.set(cId, detail);
  if (!caravan) { window.loadSelectedCaravanDetails(); return; }
  if (window.NopaFlip) window.NopaFlip.render(view, () => crvPaint(caravan, detail)); else crvPaint(caravan, detail);
  crvFitNotch(view);
};

function crvFitNotch(view) {
  if (typeof lmsFitBoardNotch === 'function') lmsFitBoardNotch(view);
  // Centre the active circle inside the notch only
  const notch = view.querySelector('.lsv-notch');
  const activeEl = notch && notch.querySelector('.lsv-circle.is-active');
  if (activeEl && notch.scrollWidth > notch.clientWidth) {
    const nr = notch.getBoundingClientRect();
    const ar = activeEl.getBoundingClientRect();
    notch.scrollLeft += (ar.left + ar.width / 2) - (nr.left + nr.width / 2);
  }
}

// The tab starts in its loading state until the first fetch finishes
if (!(window.caravansData || []).length) window.crvSetLoading(true);

// ===============================
// MODULE C: CARAVANS LOGIC
// ===============================

// 2. Asset Conversions Queue (Tab C3)
window.loadAssetConversions = async function() {
  try {
    const res = await request('/api/v1/admin/asset-conversions');
    const requests = await res.json();
    const tbody = document.querySelector('#asset-conversions-table tbody');
    if (!tbody) return;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      NopaTable.empty(tbody, 'هیچ درخواست تبدیل دارایی در سیستم ثبت نشده است.');
      return;
    }

    tbody.innerHTML = requests.map(r => `
      <tr>
        <td>
          <div class="u-bold u-c-text">${esc(r.user?.name || '-')}</div>
          ${r.user?.phoneNumber ? `<div class="u-fs-2xs u-c-text-muted u-direction-ltr u-text-right">${esc(r.user.phoneNumber)}</div>` : ''}
        </td>
        <td>${esc(r.caravan?.name || 'عمومی')}</td>
        <td>
          <span class="u-c-accent-text u-bold">${esc(r.note || 'تبدیل ۵ کلاف به ۱ قالیچه')}</span>
        </td>
        <td>
          ${r.status === 'completed' ? '<span class="badge u-bg-success-20 u-c-success-text u-bd-success-40">انجام شده</span>' :
            r.status === 'cancelled' ? `<span class="badge u-bg-danger-20 u-c-danger-text u-bd-danger-40">لغو شده</span>${r.rejectionReason ? `<div class="u-fs-2xs u-c-danger-text u-mt-4">علت: ${esc(r.rejectionReason)}</div>` : ''}` :
            '<span class="badge u-bg-muted-20 u-c-text-muted u-bd-muted-40">قدیمی (بدون اثر)</span>'}
        </td>
        <td class="u-fs-xs u-c-text-soft">${new Date(r.createdAt).toLocaleDateString('fa-IR')}</td>
        <td class="u-text-center">
          ${r.status === 'completed' ? `
            <button type="button" class="btn-icon u-c-danger-text u-bg-danger-15 u-bd-danger-30 u-p-4-8 u-r-6 u-pointer" data-click="cancelAssetConversion" data-click-args="${esc(JSON.stringify([String(r.id)]))}" title="لغو مبادله"><i class="fa-solid fa-rotate-left"></i> لغو مبادله</button>
          ` : '<span class="u-c-text-faint u-fs-2xs">-</span>'}
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error('loadAssetConversions error:', e);
  }
};

window.cancelAssetConversion = async function(id) {
  const reason = prompt('علت لغو مبادله را وارد کنید (اختیاری):', 'مبادله به اشتباه انجام شده است.');
  if (reason === null) return;

  try {
    const res = await request(`/api/v1/admin/asset-conversions/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const d = await res.json();
    if(res.ok) {
      showToast('مبادله لغو و سرمایه‌ها بازگردانده شد', 'info');
      window.loadAssetConversions();
    } else {
      showToast(d.error || 'خطا در عملیات', 'error');
    }
  } catch(e) {
    console.error('cancelAssetConversion error:', e);
  }
};

// Removed loadCaravanPerformance logic to loadCaravansTab

// ---- New caravan: steps like the station editor's create mode (info → leader → members → review) ----
window.pendingCaravanMembers = [];
const CRV_STEPS = ['info', 'mentor', 'members', 'review'];
let crvWizardCurrent = 'info';
let crvWizardMentor = null; // { id, name, code, avatarUrl }
let crvMentorsCache = null;

function crvWizardValid(step) {
  if (step === 'info') return Boolean(document.getElementById('cw-name')?.value.trim());
  if (step === 'mentor') return Boolean(document.getElementById('cw-mentor-id')?.value);
  return true;
}

function crvWizardPaint() {
  const modal = document.getElementById('caravan-wizard-modal');
  if (!modal) return;
  const idx = CRV_STEPS.indexOf(crvWizardCurrent);
  // a step opens once every step before it is complete
  let reachable = 0;
  while (reachable < CRV_STEPS.length - 1 && crvWizardValid(CRV_STEPS[reachable])) reachable++;
  modal.querySelectorAll('[data-crv-step]').forEach(tab => {
    const i = CRV_STEPS.indexOf(tab.dataset.crvStep);
    tab.classList.toggle('is-active', i === idx);
    tab.classList.toggle('is-done', i < idx && crvWizardValid(tab.dataset.crvStep));
    tab.disabled = i > reachable;
  });
  modal.querySelectorAll('[data-crv-pane]').forEach(p => p.classList.toggle('is-active', p.dataset.crvPane === crvWizardCurrent));
  const back = document.getElementById('cw-btn-back');
  const next = document.getElementById('cw-btn-next');
  const submit = document.getElementById('cw-btn-submit');
  if (back) back.hidden = idx === 0;
  if (next) next.hidden = idx === CRV_STEPS.length - 1;
  if (submit) submit.hidden = idx !== CRV_STEPS.length - 1;
  const note = document.getElementById('cw-foot-note');
  if (note) note.innerHTML = `<i class="fa-solid fa-circle-info"></i> گام ${crvFa(idx + 1)} از ${crvFa(CRV_STEPS.length)}`;
  if (crvWizardCurrent === 'review') crvWizardReview();
}

window.crvWizardGo = function(step) {
  const target = CRV_STEPS.indexOf(step);
  if (target < 0) return;
  for (let i = 0; i < target; i++) {
    if (!crvWizardValid(CRV_STEPS[i])) {
      showToast(i === 0 ? 'لطفاً نام کاروان را وارد کنید.' : 'لطفاً یک راهبر انتخاب کنید.', 'error');
      crvWizardCurrent = CRV_STEPS[i];
      crvWizardPaint();
      return;
    }
  }
  crvWizardCurrent = step;
  crvWizardPaint();
  const focus = { info: 'cw-name', mentor: 'cw-mentor-search', members: 'cw-student-search' }[step];
  if (focus) setTimeout(() => document.getElementById(focus)?.focus(), 50);
};

window.crvWizardStep = function(delta) {
  const idx = CRV_STEPS.indexOf(crvWizardCurrent) + Number(delta);
  if (idx >= 0 && idx < CRV_STEPS.length) window.crvWizardGo(CRV_STEPS[idx]);
};

function crvWizardReview() {
  const dl = document.getElementById('cw-review');
  if (!dl) return;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const members = window.pendingCaravanMembers;
  const rows = [
    ['نام کاروان', esc(val('cw-name'))],
    ['ظرفیت', val('cw-capacity') ? `${crvFa(val('cw-capacity'))} نفر` : 'پیش‌فرض'],
    ['راهبر', crvWizardMentor ? esc(crvWizardMentor.name) : '-'],
    ['اعضا', members.length ? `${crvFa(members.length)} نفر: ${members.map(p => esc(p.name)).join('، ')}` : 'بعداً اضافه می‌شوند'],
    ['توضیحات', esc(val('cw-description')) || '-'],
    ['لینک گروه', val('cw-social-link') ? `<bdi dir="ltr">${esc(val('cw-social-link'))}</bdi>` : '-']
  ];
  dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function crvResultRow(item, kind, picked) {
  return `
    <button type="button" class="lse-tree-row crv-result${picked ? ' is-active' : ''}" data-kind="${kind}" data-id="${esc(item.id)}" data-name="${esc(item.name || '')}" data-code="${esc(item.userCode || item.phoneNumber || '')}" data-avatar="${esc(item.avatarUrl || '')}">
      ${crvAvatar(item.avatarUrl, item.name, 'lse-tree-num crv-result-avatar')}
      <span class="lse-tree-text"><strong>${esc(item.name || 'بدون نام')}</strong><small>NP-${esc(item.userCode || item.phoneNumber || '-')}</small></span>
      <i class="fa-solid ${kind === 'mentor' ? 'fa-check' : 'fa-plus'}"></i>
    </button>`;
}

function crvPaintPickedMentor() {
  const box = document.getElementById('cw-mentor-picked');
  if (!box) return;
  box.innerHTML = crvWizardMentor ? `
    <div class="crv-picked-card">
      ${crvAvatar(crvWizardMentor.avatarUrl, crvWizardMentor.name, 'lst-avatar')}
      <span class="lse-tree-text"><strong>${esc(crvWizardMentor.name)}</strong><small>NP-${esc(crvWizardMentor.code || '-')}</small></span>
      <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="crvWizardClearMentor" title="برداشتن راهبر" aria-label="برداشتن راهبر"><i class="fa-solid fa-xmark"></i></button>
    </div>` : '';
}

window.crvWizardClearMentor = function() {
  crvWizardMentor = null;
  document.getElementById('cw-mentor-id').value = '';
  crvPaintPickedMentor();
  crvWizardPaint();
};

async function openCaravanWizard() {
  document.getElementById('caravan-wizard-modal').style.display = 'flex';
  ['cw-name', 'cw-capacity', 'cw-description', 'cw-social-link', 'cw-mentor-search', 'cw-mentor-id', 'cw-student-search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('cw-mentor-results').innerHTML = '';
  document.getElementById('cw-student-results').innerHTML = '';
  crvWizardMentor = null;
  crvMentorsCache = null;
  crvPaintPickedMentor();

  window.pendingCaravanMembers = [];
  renderPendingMembers();
  crvWizardCurrent = 'info';
  crvWizardPaint();
  setTimeout(() => document.getElementById('cw-name')?.focus(), 50);

  document.getElementById('cw-name').oninput = () => crvWizardPaint();

  // Mentor search logic
  document.getElementById('cw-mentor-search').oninput = async (e) => {
    const q = e.target.value.trim();
    const box = document.getElementById('cw-mentor-results');
    if (q.length < 2) { box.innerHTML = ''; return; }
    if (!crvMentorsCache) {
      const res = await request(`/api/v1/admin/mentors`);
      const data = await res.json();
      crvMentorsCache = Array.isArray(data) ? data : (data.users || data.mentors || []);
    }
    const filtered = crvMentorsCache.filter(m => (m.name || '').includes(q) || (m.phoneNumber && m.phoneNumber.includes(q)) || (m.userCode && m.userCode.toString() === q));
    box.innerHTML = filtered.length
      ? filtered.slice(0, 20).map(m => crvResultRow(m, 'mentor', crvWizardMentor && crvWizardMentor.id === m.id)).join('')
      : '<div class="lse-empty lse-empty-sm">راهبری با این مشخصات یافت نشد</div>';
  };

  document.getElementById('cw-mentor-results').onclick = (e) => {
    const item = e.target.closest('.crv-result');
    if (!item) return;
    crvWizardMentor = { id: item.dataset.id, name: item.dataset.name, code: item.dataset.code, avatarUrl: item.dataset.avatar };
    document.getElementById('cw-mentor-id').value = item.dataset.id;
    document.getElementById('cw-mentor-search').value = '';
    document.getElementById('cw-mentor-results').innerHTML = '';
    crvPaintPickedMentor();
    crvWizardPaint();
  };

  // Member search logic
  document.getElementById('cw-student-search').oninput = async (e) => {
    const q = e.target.value.trim();
    const box = document.getElementById('cw-student-results');
    if (q.length < 2) { box.innerHTML = ''; return; }
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const data = await res.json();
    const students = (Array.isArray(data) ? data : data.users || []).filter(s => !window.pendingCaravanMembers.some(p => p.id === s.id));
    box.innerHTML = students.length
      ? students.slice(0, 20).map(s => crvResultRow(s, 'student', false)).join('')
      : '<div class="lse-empty lse-empty-sm">دانش‌آموزی با این مشخصات یافت نشد</div>';
  };

  document.getElementById('cw-student-results').onclick = (e) => {
    const item = e.target.closest('.crv-result');
    if (!item) return;
    window.pendingCaravanMembers.push({ id: item.dataset.id, name: item.dataset.name, code: item.dataset.code });
    document.getElementById('cw-student-search').value = '';
    document.getElementById('cw-student-results').innerHTML = '';
    renderPendingMembers();
  };
}

window.removePendingMember = function(id) {
  window.pendingCaravanMembers = window.pendingCaravanMembers.filter(p => p.id !== id);
  renderPendingMembers();
};

function renderPendingMembers() {
  document.getElementById('cw-pending-count').innerText = crvFa(window.pendingCaravanMembers.length);
  document.getElementById('cw-pending-members').innerHTML = window.pendingCaravanMembers.map(p => `
    <li class="crv-chip">
      <span>${esc(p.name)} <small>NP-${esc(p.code)}</small></span>
      <button type="button" class="crv-chip-del" aria-label="حذف از فهرست" title="حذف از فهرست" data-click="removePendingMember" data-click-args="${esc(JSON.stringify([String(p.id)]))}"><i class="fa-solid fa-xmark"></i></button>
    </li>
  `).join('');
}

function closeCaravanWizard() { document.getElementById('caravan-wizard-modal').style.display = 'none'; }

async function submitCaravan(e) {
  e.preventDefault();
  // Enter in a field moves to the next step; only the review step creates the caravan
  if (crvWizardCurrent !== 'review') { window.crvWizardStep(1); return; }
  const name = document.getElementById('cw-name').value.trim();
  const capacityLimit = document.getElementById('cw-capacity').value;
  const mentorId = document.getElementById('cw-mentor-id').value;
  const description = document.getElementById('cw-description').value;
  const socialGroupLink = document.getElementById('cw-social-link').value;
  const studentIds = window.pendingCaravanMembers.map(s => s.id);

  if (!name) return window.crvWizardGo('info');
  if (!mentorId) return window.crvWizardGo('mentor');

  const submit = document.getElementById('cw-btn-submit');
  if (submit) submit.disabled = true;
  try {
    const res = await request('/api/v1/admin/caravans', {
      method: 'POST',
      body: JSON.stringify({ name, capacityLimit, mentorId, description, socialGroupLink, studentIds })
    });
    if (res.ok) {
      showToast('کاروان با موفقیت ایجاد شد', 'success');
      closeCaravanWizard();
      loadCaravansTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'خطا در ایجاد کاروان', 'error');
    }
  } catch(err) {
    console.error(err);
    showToast('خطا در ارتباط با سرور', 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
}

let currentDrawerCaravanId = null;
let currentCaravanDrawerData = null;

window.renderCaravanDrawerData = function(data) {
  if (!data) return;
  currentCaravanDrawerData = data;
  
  // Header Info
  const titleEl = document.getElementById('cd-title');
  if (titleEl) titleEl.textContent = `داشبورد کاروان: ${data.name || ''}`;
  
  const mentorEl = document.getElementById('cd-mentor-name');
  if (mentorEl) mentorEl.innerHTML = `<i class="fa-solid fa-user-tie"></i> مربی: ${esc(data.mentor?.name || data.mentorName || 'بدون راهبر')}`;
  
  const capText = document.getElementById('cd-capacity-text');
  if (capText) capText.innerHTML = `<i class="fa-solid fa-users"></i> ظرفیت: ${data.membersList?.length || data.memberCount || 0} / ${data.capacityLimit || 50} نفر`;
  
  const statusText = document.getElementById('cd-status-text');
  if (statusText) statusText.innerHTML = `<i class="fa-solid fa-circle-info"></i> وضعیت: ${data.status === 'active' ? 'فعال' : 'غیرفعال'}`;

  // Tab 2: Wealth & Progress
  const wealth = data.wealth || {};
  const totalZarik = wealth.zarik ?? data.totalWealth ?? data.assets?.zarik ?? 0;
  const totalNakh = wealth.nakh ?? data.assets?.nakh ?? 0;
  const totalFarsh = wealth.farsh ?? data.assets?.farsh ?? 0;
  const totalBeyragh = wealth.beyragh ?? data.assets?.beyragh ?? 0;
  const progress = data.overallProgress || 0;

  const zEl = document.getElementById('cd-wealth-zarik');
  if (zEl) zEl.textContent = Number(totalZarik).toLocaleString('fa-IR');
  
  const nEl = document.getElementById('cd-wealth-nakh');
  if (nEl) nEl.textContent = Number(totalNakh).toLocaleString('fa-IR');
  
  const fEl = document.getElementById('cd-wealth-farsh');
  if (fEl) fEl.textContent = Number(totalFarsh).toLocaleString('fa-IR');
  
  const bEl = document.getElementById('cd-wealth-beyragh');
  if (bEl) bEl.textContent = Number(totalBeyragh).toLocaleString('fa-IR');

  const progBar = document.getElementById('cd-progress-bar');
  if (progBar) progBar.style.width = `${progress}%`;

  const progText = document.getElementById('cd-progress-text');
  if (progText) progText.textContent = `${progress}%`;

  // Tab 1: Roster Table
  window.renderCaravanRosterTable(data.membersList || data.members || []);
};

window.renderCaravanRosterTable = function(membersList, searchQuery = '') {
  const tbody = document.querySelector('#cd-roster-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const q = (searchQuery || '').toLowerCase().trim();
  const filtered = (membersList || []).filter(u => {
    if (!q) return true;
    const name = (u.name || '').toLowerCase();
    const phone = (u.phoneNumber || '').toLowerCase();
    const code = (u.userCode ? String(u.userCode) : '').toLowerCase();
    return name.includes(q) || phone.includes(q) || code.includes(q);
  });

  if (filtered.length === 0) {
    NopaTable.empty(tbody, q ? 'کاربری با این مشخصات در کاروان یافت نشد.' : 'عضوی در این کاروان یافت نشد.');
    return;
  }

  filtered.forEach(u => {
    const tr = document.createElement('tr');
    const roleLabel = (u.role === 'mentor' || u.role === 'superMentor') ? 'راهبر' : (u.role === 'admin' ? 'سوپر ادمین' : u.role === 'sub_admin' ? 'ادمین' : 'دانش‌آموز');
    const displayCode = u.userCode ? `NP-${u.userCode}` : (u.phoneNumber || '-');
    const zarik = (u.zarikBalance ?? u.zarik ?? 0).toLocaleString('fa-IR');
    
    tr.innerHTML = `
      <td><strong>${esc(u.name || 'بدون نام')}</strong></td>
      <td class="u-mono u-c-text-secondary">${displayCode}</td>
      <td class="u-mono" dir="ltr">${esc(u.phoneNumber || '-')}</td>
      <td><span class="badge u-bg-fg-10">${roleLabel}</span></td>
      <td>سطح ${u.levelFrame || 1}</td>
      <td class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ${zarik}</td>
      <td>
        <div class="u-flex u-gap-6">
          <button class="page-btn u-c-color-neon-blue u-bg-primary-20 u-p-4-8 u-r-6 u-bd-none u-pointer" data-click="openCaravanStudentDetails" data-click-args="${esc(JSON.stringify([String(u.id)]))}" title="نمایش جزئیات">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="page-btn u-c-color-danger u-bg-danger-20 u-p-4-8 u-r-6 u-bd-none u-pointer" data-click="removeFromCaravan" data-click-args="${esc(JSON.stringify([String(currentDrawerCaravanId), String(u.id)]))}" title="حذف از کاروان">
            <i class="fa-solid fa-user-minus"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

window.switchCaravanDrawerTab = function(tabId) {
  const modal = document.getElementById('caravan-drawer-modal');
  if (!modal) return;
  
  modal.querySelectorAll('.cd-tab-content').forEach(el => el.style.display = 'none');
  modal.querySelectorAll('.tabs-header .btn-action').forEach(el => el.classList.remove('active'));
  
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
  
  const btn = document.getElementById('btn-' + tabId);
  if (btn) btn.classList.add('active');

  // Update data display for the selected tab
  if (currentCaravanDrawerData) {
    if (tabId === 'cd-roster') {
      const currentSearch = document.getElementById('cw-add-student-input')?.value || '';
      window.renderCaravanRosterTable(currentCaravanDrawerData.membersList || currentCaravanDrawerData.members || [], currentSearch);
    } else if (tabId === 'cd-wealth') {
      const wealth = currentCaravanDrawerData.wealth || {};
      const zEl = document.getElementById('cd-wealth-zarik');
      if (zEl) zEl.textContent = Number(wealth.zarik ?? 0).toLocaleString('fa-IR');
      const nEl = document.getElementById('cd-wealth-nakh');
      if (nEl) nEl.textContent = Number(wealth.nakh ?? 0).toLocaleString('fa-IR');
      const fEl = document.getElementById('cd-wealth-farsh');
      if (fEl) fEl.textContent = Number(wealth.farsh ?? 0).toLocaleString('fa-IR');
      const bEl = document.getElementById('cd-wealth-beyragh');
      if (bEl) bEl.textContent = Number(wealth.beyragh ?? 0).toLocaleString('fa-IR');

      const prog = currentCaravanDrawerData.overallProgress || 0;
      const progBar = document.getElementById('cd-progress-bar');
      if (progBar) progBar.style.width = `${prog}%`;
      const progText = document.getElementById('cd-progress-text');
      if (progText) progText.textContent = `${prog}%`;
    }
  }
};

window.viewCaravanDetails = async function(caravanId) {
  currentDrawerCaravanId = caravanId;
  const modal = document.getElementById('caravan-drawer-modal');
  if (modal) modal.style.display = 'flex';
  
  window.switchCaravanDrawerTab('cd-roster'); // Default tab

  // Setup search input filter on typing in the drawer roster
  const searchInput = document.getElementById('cw-add-student-input');
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = function() {
      if (currentCaravanDrawerData) {
        window.renderCaravanRosterTable(currentCaravanDrawerData.membersList || [], this.value);
      }
    };
  }

  const tbody = document.querySelector('#cd-roster-table tbody');
  NopaTable.loading(tbody, 'در حال بارگذاری اطلاعات کاروان...');

  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`);
    if (!res.ok) throw new Error('خطا در دریافت اطلاعات کاروان');
    const data = await res.json();
    window.renderCaravanDrawerData(data);
  } catch (err) {
    console.error('viewCaravanDetails error:', err);
    NopaTable.error(tbody, 'خطا در دریافت اطلاعات از سرور');
  }
};

window.closeCaravanDrawer = function() {
  const modal = document.getElementById('caravan-drawer-modal');
  if (modal) modal.style.display = 'none';
};

window.editCaravanCapacity = async function(caravanId) {
  const cId = caravanId || currentDrawerCaravanId;
  if (!cId) return showToast('شناسه کاروان نامعتبر است', 'error');
  const initialVal = currentCaravanDrawerData?.capacityLimit || 50;
  const val = prompt('ظرفیت جدید کاروان را وارد نمایید:', initialVal);
  if (!val || isNaN(val) || parseInt(val) <= 0) return;
  try {
    const res = await request(`/api/v1/admin/caravans/${cId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacityLimit: parseInt(val) })
    });
    if (res.ok) {
      showToast('ظرفیت کاروان با موفقیت به‌روزرسانی شد', 'success');
      if (currentDrawerCaravanId && typeof window.viewCaravanDetails === 'function') {
        window.viewCaravanDetails(currentDrawerCaravanId);
      }
      if (typeof window.renderCaravansTable === 'function') window.renderCaravansTable();
    } else {
      const d = await res.json();
      showToast(d.error || 'خطا در ویرایش ظرفیت', 'error');
    }
  } catch(e) { console.error(e); showToast('خطا در ارتباط با سرور', 'error'); }
};

async function sendCaravanBroadcast() {
  const title = document.getElementById('cd-broadcast-title').value;
  const message = document.getElementById('cd-broadcast-msg').value;
  if(!message) return showToast('متن پیام الزامی است', 'error');
  try {
    const res = await request(`/api/v1/admin/caravans/${currentDrawerCaravanId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ title, message })
    });
    if (res.ok) {
      showToast('پیام گروهی با موفقیت ارسال شد', 'success');
      document.getElementById('cd-broadcast-title').value = '';
      document.getElementById('cd-broadcast-msg').value = '';
    }
  } catch(e) { console.error(e); }
}

async function loadCaravanMembersRoster() {
  try {
    const q = document.getElementById('search-caravan-members')?.value || '';
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const users = await res.json();
    const tbody = document.querySelector('#caravan-roster-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(u.name)}</td>
        <td>${esc(u.phoneNumber)}</td>
        <td>${u.caravanId || 'بدون کاروان'}</td>
        <td>-</td>
        <td>
           <button class="page-btn" data-click="removeFromCaravan" data-click-args="${esc(JSON.stringify([String(u.caravanId), String(u.id)]))}" ${!u.caravanId ? 'disabled' : ''}><i class="fa-solid fa-unlink"></i> حذف از کاروان</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Load default capacity if available
    try {
      const setRes = await request('/api/v1/admin/settings/DEFAULT_CARAVAN_CAPACITY');
      if (setRes.ok) {
        const setJson = await setRes.json();
        if (setJson.value) document.getElementById('global-capacity-input').value = setJson.value;
      }
    } catch(e) {}
  } catch(e) { console.error(e); }
}

window.removeFromCaravan = async function(caravanId, studentId) {
  if(!caravanId) return;
  if((await NopaConfirm('آیا از حذف این دانش‌آموز از کاروان مطمئن هستید؟'))) {
     try {
       const res = await request(`/api/v1/admin/caravans/${caravanId}/members/${studentId}`, { method: 'DELETE' });
       if(res.ok) { 
         showToast('با موفقیت حذف شد', 'success'); 
         if (typeof window.loadCaravanDetails === 'function') {
           window.loadCaravanDetails(caravanId);
         } else {
           loadCaravanMembersRoster();
         }
       }
     } catch(e) { console.error(e); }
  }
}

window.loadCaravanDetails = async function(caravanId) {
  if (!caravanId) return;
  try {
    const res = await request(`/api/v1/admin/caravans/${caravanId}`);
    if (!res.ok) return;
    const caravan = await res.json();
    
    // Update header fields
    const mentorEl = document.getElementById('cw-mentor-name');
    const zarikEl = document.getElementById('caravan-detail-zarik');
    const derafshEl = document.getElementById('caravan-detail-derafsh');
    const nokhEl = document.getElementById('caravan-detail-nokh');
    const farshEl = document.getElementById('caravan-detail-farsh');
    const milestonesEl = document.getElementById('caravan-detail-milestones');
    
    const members = caravan.membersList || caravan.members || [];
    let sumZarik = 0, sumBeyragh = 0, sumNokh = 0, sumFarsh = 0;
    if (members.length > 0) {
      members.forEach(m => {
        sumZarik += Number(m.zarikBalance ?? m.zarik ?? m.assets?.zarik ?? 0);
        sumBeyragh += Number(m.beyragh ?? m.derafsh ?? m.assets?.beyragh ?? 0);
        sumNokh += Number(m.nakh ?? m.nokh ?? m.assets?.nakh ?? 0);
        sumFarsh += Number(m.farsh ?? m.assets?.farsh ?? 0);
      });
    } else if (caravan.wealth || caravan.assets) {
      const w = caravan.wealth || caravan.assets || {};
      sumZarik = Number(w.zarik ?? caravan.totalWealth ?? 0);
      sumBeyragh = Number(w.beyragh ?? 0);
      sumNokh = Number(w.nakh ?? w.nokh ?? 0);
      sumFarsh = Number(w.farsh ?? 0);
    }

    if (mentorEl) mentorEl.innerText = caravan.mentor?.name || caravan.mentorName || 'فاقد راهبر';
    if (zarikEl) zarikEl.innerHTML = `${sumZarik.toLocaleString()} <i class="fa-solid fa-coins"></i>`;
    if (derafshEl) derafshEl.innerHTML = `${sumBeyragh.toLocaleString()} <i class="fa-solid fa-flag"></i>`;
    if (nokhEl) nokhEl.innerHTML = `${sumNokh.toLocaleString()} <i class="fa-solid fa-layer-group"></i>`;
    if (farshEl) farshEl.innerHTML = `${sumFarsh.toLocaleString()} <i class="fa-solid fa-rug"></i>`;
    if (milestonesEl) milestonesEl.innerText = `${caravan.overallProgress || caravan.completedStations || 0}%`;

    // Populate roster
    const tbody = document.querySelector('#cd-roster-table tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const members = caravan.membersList || caravan.members || [];
      if (members.length === 0) {
        NopaTable.empty(tbody, 'هیچ عضوی در این کاروان یافت نشد');
      } else {
        members.forEach(m => {
          const name = m.name || m.user?.name || '-';
          const phone = m.phoneNumber || m.user?.phoneNumber || '-';
          const zarik = m.zarik || m.assets?.zarik || m.zarikBalance || 0;
          const userId = m.userId || m.user?.id || m.id;
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <input type="text" id="edit-name-${userId}" value="${esc(name)}" class="input-ctrl u-w-120 u-p-4 u-fs-xs u-bd-fg-20 u-bg-transparent u-c-text u-r-4">
            </td>
            <td class="u-mono">${esc(phone)}</td>
            <td>${zarik}</td>
            <td>-</td>
            <td class="u-nowrap u-flex u-gap-6">
              <button class="btn-action u-bg-primary u-c-white u-p-4-8 u-fs-2xs u-r-6" data-click="editMember" data-click-args="${esc(JSON.stringify([String(userId)]))}">ذخیره</button>
              <button class="btn-action u-bg-danger u-c-white u-p-4-8 u-fs-2xs u-r-6" data-click="removeFromCaravan" data-click-args="${esc(JSON.stringify([String(caravanId), String(userId)]))}">حذف</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};

window.lmsStations = [];

// ===============================
// BULK TRANSFER MODAL LOGIC
// ===============================

window.bulkTransferSelectedMembers = [];

window.closeBulkTransferModal = function() {
  document.getElementById('bulk-transfer-modal').style.display = 'none';
};

window.renderBulkSelectedMembers = function() {
  const container = document.getElementById('bt-selected-members');
  const count = document.getElementById('bt-selected-count');
  
  count.innerText = window.bulkTransferSelectedMembers.length;
  
  if (window.bulkTransferSelectedMembers.length === 0) {
    container.innerHTML = '<li class="u-c-text-secondary u-fs-sm">هیچ عضوی انتخاب نشده است.</li>';
    return;
  }
  
  container.innerHTML = window.bulkTransferSelectedMembers.map(m => `
    <li class="u-bg-primary-20 u-bd-primary u-p-6-12 u-r-20 u-fs-sm u-flex u-items-center u-gap-8">
      ${esc(m.name)} (NP-${m.code})
      <i role="button" tabindex="0" aria-label="حذف از فهرست" class="fa-solid fa-times u-pointer u-c-danger-text" data-click="removeBulkSelectedMember" data-click-args="${esc(JSON.stringify([String(m.id)]))}"></i>
    </li>
  `).join('');
};

window.removeBulkSelectedMember = function(id) {
  window.bulkTransferSelectedMembers = window.bulkTransferSelectedMembers.filter(m => m.id !== id);
  renderBulkSelectedMembers();
};

document.getElementById('bt-student-search')?.addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  const resultsDiv = document.getElementById('bt-student-results');
  if (q.length < 2) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  try {
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const data = await res.json();
    const students = Array.isArray(data) ? data : data.users;
    
    const html = students.filter(s => !window.bulkTransferSelectedMembers.some(sel => sel.id === s.id)).map(s => `
      <div class="bt-student-item u-p-10 u-pointer u-bb-fg-5 u-flex u-justify-between" data-id="${s.id}" data-name="${esc(s.name)}" data-code="${esc(s.userCode || s.phoneNumber)}">
        <span><strong>${esc(s.name)}</strong> - NP-${esc(s.userCode || s.phoneNumber)} <span class="u-fs-2xs u-c-text-muted">(${esc(s.caravan?.name || 'بدون کاروان')})</span></span>
        <i class="fa-solid fa-plus u-c-primary-text"></i>
      </div>
    `).join('');
    
    resultsDiv.innerHTML = html;
  } catch (error) {
    console.error('Search failed', error);
  }
});

document.getElementById('bt-student-results')?.addEventListener('click', (e) => {
  const item = e.target.closest('.bt-student-item');
  if (item) {
    window.bulkTransferSelectedMembers.push({ 
      id: item.dataset.id, 
      name: item.dataset.name, 
      code: item.dataset.code 
    });
    document.getElementById('bt-student-search').value = '';
    document.getElementById('bt-student-results').innerHTML = '';
    renderBulkSelectedMembers();
  }
});

window.submitBulkTransfer = async function() {
  const targetCaravanId = document.getElementById('bt-target-caravan').value;
  const userIds = window.bulkTransferSelectedMembers.map(m => m.id);
  
  if (userIds.length === 0) {
    return showToast('لطفاً حداقل یک عضو را برای انتقال انتخاب کنید.', 'error');
  }
  if (!targetCaravanId) {
    return showToast('لطفاً کاروان مقصد را انتخاب کنید.', 'error');
  }
  
  try {
    const payloadTarget = targetCaravanId === 'unassign' ? null : targetCaravanId;
    
    const res = await request('/api/v1/admin/caravans/bulk-transfer', {
      method: 'POST',
      body: JSON.stringify({ userIds, targetCaravanId: payloadTarget })
    });
    
    if (res.ok) {
      showToast('اعضا با موفقیت منتقل شدند', 'success');
      closeBulkTransferModal();
      if (typeof loadCaravansTab === 'function') loadCaravansTab();
      if (typeof loadCaravanMembersRoster === 'function') loadCaravanMembersRoster();
    } else {
      const data = await res.json();
      showToast('خطا در انتقال: ' + (data.error || 'ناشناخته'), 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};

window.addStudentToCaravan = function() {
  const initialSearch = document.getElementById('cw-add-student-input')?.value?.trim() || '';
  window.openAddMemberToCaravanModal(currentDrawerCaravanId, initialSearch);
};

window.openCaravanStudentDetails = async function(userId) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}/analytics`);
    if(!res.ok) throw new Error('Failed to fetch user analytics');
    const data = await res.json();
    
    document.getElementById('csd-identity').innerHTML = `
      <strong>نام:</strong> ${esc(data.name || 'نامشخص')}<br>
      <strong>کد ملی:</strong> ${esc(data.nationalId || '-')}<br>
      <strong>شماره تماس:</strong> ${esc(data.phoneNumber || '-')}<br>
      <strong>شهر:</strong> ${esc(data.city || '-')}<br>
      <strong>تاریخ ثبت‌نام:</strong> ${data.createdAt ? new Date(data.createdAt).toLocaleDateString('fa-IR') : '-'}<br>
      <strong>پروفایل فریم:</strong> ${data.levelFrame || 1}
    `;

    document.getElementById('csd-assets').innerHTML = `
      <strong>موجودی زریک:</strong> ${data.zarikBalance || 0}<br>
      <strong>موجودی کلاف:</strong> ${data.nakhBalance || 0}<br>
      <strong>موجودی درفش:</strong> ${data.beyraghBalance || 0}<br>
      <strong>موجودی قالیچه:</strong> ${data.farshBalance || 0}
    `;

    let progHtml = '';
    if(data.classProgress && data.classProgress.length > 0) {
       progHtml = data.classProgress.map(p => `<div>- ${esc(p.sessionName)}: ${p.watchPercentage}% | کوییز: ${p.quizScore}</div>`).join('');
    } else {
       progHtml = 'داده‌ای موجود نیست';
    }
    document.getElementById('csd-progress').innerHTML = progHtml;

    let ticketsHtml = '';
    if(data.recentTickets && data.recentTickets.length > 0) {
       ticketsHtml = data.recentTickets.map(t => `<div>- ${esc(t.subject)} (${t.status})</div>`).join('');
    } else {
       ticketsHtml = 'تیکتی یافت نشد';
    }
    document.getElementById('csd-tickets').innerHTML = ticketsHtml;

    document.getElementById('caravan-student-detail-modal').style.display = 'flex';
  } catch(e) {
    console.error(e);
    showToast('خطا در دریافت جزئیات دانش‌آموز', 'error');
  }
};

window.selectedCandidateMembers = new Set();

window.openAddMemberToCaravanModal = async function(preSelectedCaravanId, initialSearch = '') {
  window.selectedCandidateMembers.clear();
  const countEl = document.getElementById('add-member-selected-count');
  if (countEl) countEl.innerText = '0';

  const modal = document.getElementById('add-member-to-caravan-modal');
  if (!modal) return;

  const targetCaravanId = preSelectedCaravanId || currentDrawerCaravanId || (document.getElementById('target-caravan-picker') || document.getElementById('main-caravan-selector'))?.value || '';

  // Populate modal caravan picker options
  const modalPicker = document.getElementById('modal-add-member-caravan-picker');
  if (modalPicker) {
    let optionsHtml = '<option value="">-- انتخاب کاروان --</option>';
    let caravans = window.caravansData || window.caravansMasterList || window.caravansList || [];
    
    if (!caravans || caravans.length === 0) {
      try {
        const res = await request('/api/v1/admin/caravans');
        caravans = await res.json();
        window.caravansData = caravans;
      } catch (err) {
        console.error('Failed to load caravans', err);
      }
    }

    if (Array.isArray(caravans) && caravans.length > 0) {
      optionsHtml += caravans.map(c => `<option value="${c.id}" ${String(c.id) === String(targetCaravanId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    } else {
      const pagePicker = document.getElementById('target-caravan-picker') || document.getElementById('main-caravan-selector');
      if (pagePicker && pagePicker.options) {
        Array.from(pagePicker.options).forEach(opt => {
          if (opt.value) {
            optionsHtml += `<option value="${opt.value}" ${String(opt.value) === String(targetCaravanId) ? 'selected' : ''}>${esc(opt.text)}</option>`;
          }
        });
      }
    }
    modalPicker.innerHTML = optionsHtml;
    if (targetCaravanId) {
      modalPicker.value = targetCaravanId;
    }
  }

  const searchInput = document.getElementById('input-search-candidate-member');
  if (searchInput) {
    searchInput.value = initialSearch;
  }

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-mobile-nav)';

  // Load candidates with initialSearch
  window.searchCandidateMembers(initialSearch);
};

window.closeAddMemberToCaravanModal = function() {
  const modal = document.getElementById('add-member-to-caravan-modal');
  if (modal) modal.style.display = 'none';
};

window.toggleCandidateSelection = function(checkbox, userId) {
  if (checkbox.checked) {
    window.selectedCandidateMembers.add(userId);
  } else {
    window.selectedCandidateMembers.delete(userId);
  }
  const countEl = document.getElementById('add-member-selected-count');
  if (countEl) countEl.innerText = window.selectedCandidateMembers.size;
};

window.searchCandidateMembers = async function(query) {
  const container = document.getElementById('candidate-members-list');
  if (!container) return;

  container.innerHTML = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(4) + '</div>';

  try {
    const qStr = query ? query.trim() : '';
    // Request specifically students
    const res = await request(`/api/v1/admin/users?role=student&limit=100&search=${encodeURIComponent(qStr)}`);
    const data = await res.json();
    const rawUsers = data.users || (Array.isArray(data) ? data : []);

    // Strict filter: ONLY students are allowed
    let students = rawUsers.filter(u => u.role === 'student');

    const unassignedOnly = document.getElementById('chk-candidate-unassigned-only')?.checked ?? false;
    if (unassignedOnly) {
      students = students.filter(u => !u.caravanId && (!u.caravanName || u.caravanName === 'فاقد کاروان' || u.caravanName === '-'));
    }

    if (students.length === 0) {
      container.innerHTML = '<div class="lse-empty lse-empty-sm">دانش‌آموزی با این مشخصات یافت نشد</div>';
      return;
    }

    container.innerHTML = students.map(u => {
      const hasCaravan = Boolean(u.caravanId || (u.caravanName && u.caravanName !== 'فاقد کاروان' && u.caravanName !== '-'));
      const isChecked = window.selectedCandidateMembers.has(u.id) && !hasCaravan ? 'checked' : '';

      const caravanBadge = hasCaravan
        ? `<span class="lst-chip lst-chip-locked"><i class="fa-solid fa-lock"></i> عضو «${esc(u.caravanName)}»</span>`
        : '<span class="lst-chip lst-chip-active"><i class="fa-solid fa-check"></i> آماده عضویت</span>';

      return `
        <label class="lse-tree-row crv-cand${hasCaravan ? ' is-disabled' : ''}">
          <input type="checkbox"
                 ${hasCaravan ? 'disabled' : `data-change="toggleCandidateSelection" data-change-args="${esc(JSON.stringify(["$this", String(u.id)]))}"`}
                 ${isChecked}>
          ${crvAvatar(u.avatarUrl, u.name, 'lse-tree-num crv-result-avatar')}
          <span class="lse-tree-text">
            <strong>${esc(u.name || 'بدون نام')}</strong>
            <small dir="ltr">${esc(u.phoneNumber || '-')}</small>
          </span>
          ${caravanBadge}
        </label>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div class="lse-empty lse-empty-sm"><i class="fa-solid fa-triangle-exclamation lst-warn"></i> خطا در دریافت فهرست دانش‌آموزان</div>';
  }
};

window.confirmBulkAddUsersToCaravan = async function() {
  const modalPicker = document.getElementById('modal-add-member-caravan-picker');
  const pagePicker = document.getElementById('target-caravan-picker') || document.getElementById('main-caravan-selector');
  const targetCaravanId = modalPicker?.value || pagePicker?.value || currentDrawerCaravanId;

  if (!targetCaravanId) {
    return showToast('لطفاً کاروان مقصد را از کشوی بالای فرم انتخاب کنید', 'error');
  }

  const userIds = Array.from(window.selectedCandidateMembers);
  if (userIds.length === 0) {
    return showToast('لطفاً حداقل یک دانش‌آموز را انتخاب کنید', 'error');
  }

  try {
    const res = await request(`/api/v1/admin/caravans/${targetCaravanId}/members/bulk-add`, {
      method: 'POST',
      body: JSON.stringify({ userIds })
    });

    if (res.ok) {
      window.closeAddMemberToCaravanModal();
      const resData = await res.json().catch(() => ({}));
      showToast(resData.message || 'دانش‌آموزان با موفقیت به کاروان اضافه شدند', 'success');
      
      // Update page caravan picker & refresh details
      if (pagePicker) {
        pagePicker.value = targetCaravanId;
      }
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
      if (typeof window.renderCaravansTable === 'function') {
        window.renderCaravansTable();
      }
      if (typeof window.loadCaravansTab === 'function') {
        window.loadCaravansTab();
      }
      if (currentDrawerCaravanId && typeof window.viewCaravanDetails === 'function') {
        window.viewCaravanDetails(currentDrawerCaravanId);
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'خطا در افزودن دانش‌آموزان به کاروان', 'error');
    }
  } catch(e) {
    console.error(e);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
};

window.openChangeCaravanMentorModal = async function() {
  const currentCaravanId = document.getElementById('target-caravan-picker')?.value || document.getElementById('main-caravan-selector')?.value;
  if (!currentCaravanId) {
    return showToast('لطفاً ابتدا یک کاروان را انتخاب کنید', 'error');
  }

  const modal = document.getElementById('change-caravan-mentor-modal');
  if (!modal) return;

  const mentorSelect = document.getElementById('cw-mentor-select');
  if (mentorSelect) {
    mentorSelect.innerHTML = '<option value="">در حال بارگذاری راهبران...</option>';
  }

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';

  const caravan = window.caravansData?.find(c => c.id === currentCaravanId);
  const currentMentorId = caravan?.mentorId || caravan?.mentor?.id || '';

  try {
    let mentors = [];
    
    // Fetch mentors
    const res = await request('/api/v1/admin/mentors');
    if (res.ok) {
      const data = await res.json();
      mentors = Array.isArray(data) ? data : (data.users || data.mentors || []);
    }

    if (mentorSelect) {
      let options = '<option value="">-- بدون راهبر --</option>';
      if (mentors.length === 0) {
        options += '<option value="" disabled>هیچ راهبری یافت نشد</option>';
      } else {
        options += mentors.map(m => `
          <option value="${m.id}" ${m.id === currentMentorId ? 'selected' : ''}>
            ${esc(m.name || 'بدون نام')} (${esc(m.phoneNumber || '-')})
          </option>
        `).join('');
      }
      mentorSelect.innerHTML = options;
    }
  } catch(e) {
    console.error('Error loading mentors:', e);
    if (mentorSelect) mentorSelect.innerHTML = '<option value="">خطا در بارگذاری لیست راهبران</option>';
  }
};

window.closeChangeCaravanMentorModal = function() {
  const modal = document.getElementById('change-caravan-mentor-modal');
  if (modal) modal.style.display = 'none';
};

window.updateCaravanMentor = async function() {
  const currentCaravanId = document.getElementById('target-caravan-picker')?.value || document.getElementById('main-caravan-selector')?.value;
  if (!currentCaravanId) {
    return showToast('لطفاً ابتدا یک کاروان را انتخاب کنید', 'error');
  }

  const mentorId = document.getElementById('cw-mentor-select')?.value || null;
  
  try {
    const res = await request(`/api/v1/admin/caravans/${currentCaravanId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ mentorId })
    });

    if (res.ok) {
      window.closeChangeCaravanMentorModal();
      showToast('راهبر کاروان با موفقیت تغییر یافت', 'success');
      
      if (typeof window.loadCaravansTab === 'function') {
        await window.loadCaravansTab();
      }

      const picker = document.getElementById('target-caravan-picker');
      if (picker) {
        picker.value = currentCaravanId;
      }
      if (typeof window.loadSelectedCaravanDetails === 'function') {
        window.loadSelectedCaravanDetails();
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'خطا در تغییر راهبر', 'error');
    }
  } catch(e) {
    console.error(e);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};

// --- CARAVAN MANAGEMENT MODAL LOGIC ---
window.activeCaravanId = null;
window.allCaravansDataCache = []; // To hold all caravans for the transfer dropdown

window.editMember = async function(userId) {
  try {
    const res = await request(`/api/v1/admin/users/${userId}`);
    const user = await res.json();
    const newName = prompt('نام جدید کاربر را وارد کنید:', user.name);
    if (newName && newName.trim() !== '' && newName !== user.name) {
      await request(`/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...user, name: newName.trim() })
      });
      showToast('اطلاعات کاربر به‌روزرسانی شد', 'success');
      if (currentDrawerCaravanId) window.viewCaravanDetails(currentDrawerCaravanId);
    }
  } catch (err) {
    console.error(err);
    showToast('خطا در به‌روزرسانی کاربر', 'error');
  }
};

// window.loadUsersData is set by js/features/audience.js (loads after this file)

// --- CARAVAN EDIT MODAL LOGIC ---
// --- STATUS / DELETE MODAL LOGIC ---

// 4. Caravans Table Loader (#caravans-tbody)
window.loadCaravansData = async function() {
  if (typeof loadCaravansTab === 'function') {
    await loadCaravansTab();
  }
};

// Caravan drawer buttons (formerly inline handlers reading the global currentDrawerCaravanId)
window.openChangeMentorForDrawerCaravan = function() {
  return window.openChangeCaravanMentorModalForCaravan(currentDrawerCaravanId);
};
window.editDrawerCaravanCapacity = function() {
  return window.editCaravanCapacity(currentDrawerCaravanId);
};
window.searchCandidateMembersFromInput = function() {
  return window.searchCandidateMembers(document.getElementById('input-search-candidate-member')?.value);
};
