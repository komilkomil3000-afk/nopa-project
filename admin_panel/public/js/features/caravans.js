// Caravans: list, wizard, drawer + roster, members, bulk transfer, mentor change, asset conversions.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// 4. CARAVANS & MENTORS
// 4. CARAVANS & MENTORS
window.caravansData = [];

async function loadCaravansTab() {
  try {
    const res = await request('/api/v1/admin/caravans');
    if (!res.ok) {
      console.warn('Failed to load /api/v1/admin/caravans');
      return NopaTable.error(document.querySelector('#caravan-performance-table tbody'), 'خطا در دریافت کاروان‌ها');
    }
    const data = await res.json();
    window.caravansData = Array.isArray(data) ? data : (data.caravans || data.data || []);
    
    // Populate Mentor Filter
    const mentorSelect = document.getElementById('caravan-mentor-filter');
    if (mentorSelect) {
      const mentors = new Set(window.caravansData.map(c => c.mentor?.name || c.mentorName || '-').filter(n => n !== '-'));
      mentorSelect.innerHTML = '<option value="all">همه مربیان</option>';
      mentors.forEach(m => {
        mentorSelect.innerHTML += `<option value="${esc(m)}">${esc(m)}</option>`;
      });
    }

    // Populate Caravan Picker
    const caravanPicker = document.getElementById('target-caravan-picker');
    if (caravanPicker) {
      const currentVal = caravanPicker.value;
      caravanPicker.innerHTML = '<option value="">-- لطفاً یک کاروان انتخاب کنید --</option>';
      window.caravansData.forEach(c => {
        caravanPicker.innerHTML += `<option value="${c.id}">${esc(c.name)}</option>`;
      });
      caravanPicker.onchange = window.loadSelectedCaravanDetails;
      
      if (currentVal && window.caravansData.some(c => c.id === currentVal)) {
        caravanPicker.value = currentVal;
      } else if (!caravanPicker.value && window.caravansData.length > 0) {
        caravanPicker.value = window.caravansData[0].id;
      }
      window.loadSelectedCaravanDetails();
    }

    renderCaravansTable();
  } catch (err) {
    console.error('loadCaravansTab error:', err);
    NopaTable.error(document.querySelector('#caravan-performance-table tbody'), 'خطا در دریافت کاروان‌ها');
  }
}

window.renderCaravansTable = function() {
  const tbody = document.querySelector('#caravan-performance-table tbody') || document.getElementById('caravans-tbody');
  if (!tbody) return;

  if (!window.caravansData || window.caravansData.length === 0) {
    NopaTable.empty(tbody, 'هیچ کاروانی یافت نشد.');
    return;
  }

  const searchQuery = (document.getElementById('caravan-search-input')?.value || '').toLowerCase().trim();
  const sortBy = document.getElementById('caravan-sort-select')?.value || 'newest';
  const mentorFilter = document.getElementById('caravan-mentor-filter')?.value || 'all';

  let filtered = window.caravansData.filter(c => {
    const mName = c.mentor?.name || c.mentorName || '-';
    const cName = c.name || c.title || '';
    const matchesSearch = !searchQuery || 
                          cName.toLowerCase().includes(searchQuery) || 
                          mName.toLowerCase().includes(searchQuery) ||
                          (c.id && c.id.toLowerCase().includes(searchQuery));
    const matchesMentor = mentorFilter === 'all' || mName === mentorFilter;
    return matchesSearch && matchesMentor;
  });

  if (sortBy === 'most_members') {
    filtered.sort((a, b) => (b._count?.members || b.membersList?.length || b.memberCount || 0) - (a._count?.members || a.membersList?.length || a.memberCount || 0));
  } else if (sortBy === 'highest_zarik') {
    filtered.sort((a, b) => (b.assets?.zarik || b.totalWealth || b.wealth?.zarik || 0) - (a.assets?.zarik || a.totalWealth || a.wealth?.zarik || 0));
  } else if (sortBy === 'highest_progress') {
    filtered.sort((a, b) => (b.overallProgress || b.progress || 0) - (a.overallProgress || a.progress || 0));
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    NopaTable.empty(tbody, 'کاروانی با این مشخصات یافت نشد.');
    return;
  }

  filtered.forEach(c => {
    const memberCount = c._count?.members ?? c.membersList?.length ?? c.memberCount ?? 0;
    const capacity = c.capacityLimit ?? c.capacity ?? 50;
    const totalZarik = (c.assets?.zarik ?? c.totalWealth ?? c.wealth?.zarik ?? 0).toLocaleString();
    const progress = c.overallProgress ?? c.progress ?? 0;
    const mentorDisplay = c.mentor?.name || c.mentorName || 'بدون راهبر';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(c.name || c.title)}</strong></td>
      <td><span class="badge badge-student">${esc(mentorDisplay)}</span></td>
      <td>${memberCount} / ${capacity}</td>
      <td>
        <span class="u-c-accent-text"><i class="fa-solid fa-coins"></i> ${totalZarik}</span>
      </td>
      <td>
        <div class="u-flex u-justify-between u-fs-xs u-mb-6">
          <span>${progress}%</span>
        </div>
        <div class="progress-bar-container u-m-0 u-h-6">
          <div class="progress-bar-fill" data-style="width: ${progress}%"></div>
        </div>
      </td>
      <td>
        <div class="u-flex u-gap-6 u-wrap">
          <button class="page-btn btn-view u-p-4-8 u-fs-2xs u-bg-primary u-c-white u-r-6 u-bd-none u-pointer" data-click="selectCaravanForManagement" data-click-args="${esc(JSON.stringify([String(c.id)]))}" title="مشاهده کاروان">
            <i class="fa-solid fa-eye"></i> مشاهده
          </button>
          <button class="page-btn u-p-4-8 u-fs-2xs u-bg-success u-c-white u-r-6 u-bd-none u-pointer" data-click="openRenameCaravanModal" data-click-args="${esc(JSON.stringify([String(c.id), String(c.name || '')]))}" title="تغییر نام کاروان">
            <i class="fa-solid fa-pen-to-square"></i> تغییر نام
          </button>
          <button class="page-btn u-p-4-8 u-fs-2xs u-bg-info u-c-white u-r-6 u-bd-none u-pointer" data-click="openChangeCaravanMentorModalForCaravan" data-click-args="${esc(JSON.stringify([String(c.id)]))}" title="تغییر راهبر">
            <i class="fa-solid fa-user-gear"></i> تغییر راهبر
          </button>
          <button class="page-btn u-p-4-8 u-fs-2xs u-bg-danger u-c-white u-r-6 u-bd-none u-pointer" data-click="deleteCaravanRecord" data-click-args="${esc(JSON.stringify([String(c.id), String(c.name || '')]))}" title="حذف کاروان">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
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

window.selectCaravanForManagement = function(id) {
  const picker = document.getElementById('target-caravan-picker');
  if (picker) {
    picker.value = id;
    if (window.loadSelectedCaravanDetails) {
      window.loadSelectedCaravanDetails();
    }
    const detailsSection = picker.closest('.panel-card');
    if (detailsSection) {
      detailsSection.scrollIntoView({ behavior: NopaMotion.scrollBehavior() });
    }
  }
};

window.openChangeCaravanMentorModalForCaravan = function(id) {
  window.selectCaravanForManagement(id);
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
                <strong>دسته‌های کلاس:</strong> <span class="u-c-text u-bold">${st.categoriesCount || 2} دسته</span> <span class="u-fs-2xs u-c-text-faint">(مهارتی و رسانه‌ای)</span>
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

window.loadSelectedCaravanDetails = async function() {
  const picker = document.getElementById('target-caravan-picker');
  if (!picker) return;
  const cId = picker.value;
  
  const mentorEl = document.getElementById('cw-mentor-name');
  const zarikEl = document.getElementById('caravan-detail-zarik');
  const derafshEl = document.getElementById('caravan-detail-derafsh');
  const nokhEl = document.getElementById('caravan-detail-nokh');
  const farshEl = document.getElementById('caravan-detail-farsh');
  const milestonesEl = document.getElementById('caravan-detail-milestones');
  const rosterBody = document.getElementById('caravan-roster-body');

  if (!zarikEl || !milestonesEl || !rosterBody) return;

  if (!cId) {
    if (mentorEl) mentorEl.innerText = '-';
    zarikEl.innerHTML = '0 <i class="fa-solid fa-coins"></i>';
    if (derafshEl) derafshEl.innerHTML = '0 <i class="fa-solid fa-flag"></i>';
    if (nokhEl) nokhEl.innerHTML = '0 <i class="fa-solid fa-layer-group"></i>';
    if (farshEl) farshEl.innerHTML = '0 <i class="fa-solid fa-rug"></i>';
    milestonesEl.innerText = '0%';
    NopaTable.empty(rosterBody, 'کاروانی انتخاب نشده است.');
    return;
  }

  let caravan = window.caravansData?.find(c => c.id === cId);
  if (!caravan) {
    try {
      const res = await request(`/api/v1/admin/caravans/${cId}`);
      if (res.ok) caravan = await res.json();
    } catch (_) {}
  }
  if (!caravan) return;

  if (mentorEl) {
    mentorEl.innerText = caravan.mentorName || caravan.mentor?.name || 'فاقد راهبر';
  }

  const members = caravan.membersList || caravan.members || [];

  // Calculate sum of each asset across ALL members of the caravan
  let sumZarik = 0;
  let sumBeyragh = 0; // درفش
  let sumNokh = 0;   // نخ
  let sumFarsh = 0;  // فرش

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

  zarikEl.innerHTML = `${sumZarik.toLocaleString()} <i class="fa-solid fa-coins"></i>`;
  if (derafshEl) derafshEl.innerHTML = `${sumBeyragh.toLocaleString()} <i class="fa-solid fa-flag"></i>`;
  if (nokhEl) nokhEl.innerHTML = `${sumNokh.toLocaleString()} <i class="fa-solid fa-layer-group"></i>`;
  if (farshEl) farshEl.innerHTML = `${sumFarsh.toLocaleString()} <i class="fa-solid fa-rug"></i>`;

  milestonesEl.innerText = caravan.overallProgress ? `${caravan.overallProgress}%` : '0%';

  rosterBody.innerHTML = '';
  if (members.length === 0) {
    NopaTable.empty(rosterBody, 'این کاروان عضوی ندارد.');
  } else {
    members.forEach(m => {
      const name = m.name || m.user?.name || '-';
      const phone = m.phoneNumber || m.user?.phoneNumber || '-';
      const zarik = Number(m.zarikBalance ?? m.zarik ?? m.assets?.zarik ?? 0).toLocaleString();
      const beyragh = Number(m.beyragh ?? m.derafsh ?? m.assets?.beyragh ?? 0).toLocaleString();
      const nokh = Number(m.nakh ?? m.nokh ?? m.assets?.nakh ?? 0).toLocaleString();
      const farsh = Number(m.farsh ?? m.assets?.farsh ?? 0).toLocaleString();
      const displayId = m.userCode ? `NP-${m.userCode}` : (m.user?.userCode ? `NP-${m.user?.userCode}` : (m.id || '-'));
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="u-mono u-c-primary-text u-bold">${displayId}</td>
        <td><strong>${esc(name)}</strong></td>
        <td class="u-mono" dir="ltr">${esc(phone)}</td>
        <td class="u-c-accent-text u-bold"><i class="fa-solid fa-coins"></i> ${zarik}</td>
        <td class="u-c-primary-text u-bold"><i class="fa-solid fa-flag"></i> ${beyragh}</td>
        <td class="u-c-success-text u-bold"><i class="fa-solid fa-layer-group"></i> ${nokh}</td>
        <td class="u-c-primary-text u-bold"><i class="fa-solid fa-rug"></i> ${farsh}</td>
        <td class="u-nowrap u-flex u-gap-6">
          <button class="btn-action u-bg-info u-c-white u-p-4-8 u-fs-2xs u-r-6 u-pointer" data-click="viewStudentDetails" data-click-args="${esc(JSON.stringify([String(m.id)]))}">جزئیات</button>
          <button class="btn-action u-bg-primary u-c-white u-p-4-8 u-fs-2xs u-r-6 u-pointer" data-click="openUserModal" data-click-args="${esc(JSON.stringify([String(m.id), String(name), String(m.role || 'student'), String(cId)]))}">ویرایش</button>
          <button class="btn-action u-bg-accent u-c-white u-p-4-8 u-fs-2xs u-r-6 u-pointer" data-click="setAccountStatus" data-click-args="${esc(JSON.stringify([String(m.id), "SUSPENDED"]))}">تعلیق</button>
          <button class="btn-action u-bg-danger u-c-white u-p-4-8 u-fs-2xs u-r-6 u-pointer" data-click="removeMemberFromCaravan" data-click-args="${esc(JSON.stringify([String(cId), String(m.id), String(name)]))}">حذف</button>
        </td>
      `;
      rosterBody.appendChild(tr);
    });
  }
};

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

window.pendingCaravanMembers = [];

async function openCaravanWizard() {
  document.getElementById('caravan-wizard-modal').style.display = 'flex';
  document.getElementById('cw-mentor-search').value = '';
  document.getElementById('cw-mentor-id').value = '';
  document.getElementById('cw-student-search').value = '';
  document.getElementById('cw-mentor-results').innerHTML = '';
  document.getElementById('cw-student-results').innerHTML = '';
  
  window.pendingCaravanMembers = [];
  renderPendingMembers();

  // Mentor search logic
  document.getElementById('cw-mentor-search').oninput = async (e) => {
    const q = e.target.value.trim();
    if(q.length < 2) return document.getElementById('cw-mentor-results').innerHTML = '';
    const res = await request(`/api/v1/admin/mentors`);
    const allMentors = await res.json();
    const filtered = allMentors.filter(m => m.name.includes(q) || (m.phoneNumber && m.phoneNumber.includes(q)) || (m.userCode && m.userCode.toString() === q));
    const html = filtered.map(m => `
      <div class="mentor-result-item u-p-10 u-pointer u-bb-border" data-id="${m.id}" data-name="${esc(m.name)}">
        <strong>${esc(m.name)}</strong> - NP-${esc(m.userCode || m.phoneNumber)}
      </div>
    `).join('');
    document.getElementById('cw-mentor-results').innerHTML = html;
  };

  document.getElementById('cw-mentor-results').onclick = (e) => {
    const item = e.target.closest('.mentor-result-item');
    if (item) {
      document.getElementById('cw-mentor-id').value = item.dataset.id;
      document.getElementById('cw-mentor-search').value = item.dataset.name;
      document.getElementById('cw-mentor-results').innerHTML = '';
    }
  };

  // Member search logic
  document.getElementById('cw-student-search').oninput = async (e) => {
    const q = e.target.value.trim();
    if(q.length < 2) return document.getElementById('cw-student-results').innerHTML = '';
    const res = await request(`/api/v1/admin/users?role=student&search=${encodeURIComponent(q)}`);
    const data = await res.json();
    const students = Array.isArray(data) ? data : data.users;
    const html = students.filter(s => !window.pendingCaravanMembers.some(p => p.id === s.id)).map(s => `
      <div class="student-result-item u-p-10 u-pointer u-bb-border u-flex u-justify-between" data-id="${s.id}" data-name="${esc(s.name)}" data-code="${esc(s.userCode || s.phoneNumber)}">
        <span><strong>${esc(s.name)}</strong> - NP-${esc(s.userCode || s.phoneNumber)}</span>
        <i class="fa-solid fa-plus text-primary"></i>
      </div>
    `).join('');
    document.getElementById('cw-student-results').innerHTML = html;
  };

  document.getElementById('cw-student-results').onclick = (e) => {
    const item = e.target.closest('.student-result-item');
    if (item) {
      window.pendingCaravanMembers.push({ id: item.dataset.id, name: item.dataset.name, code: item.dataset.code });
      document.getElementById('cw-student-search').value = '';
      document.getElementById('cw-student-results').innerHTML = '';
      renderPendingMembers();
    }
  };
}

window.removePendingMember = function(id) {
  window.pendingCaravanMembers = window.pendingCaravanMembers.filter(p => p.id !== id);
  renderPendingMembers();
};

function renderPendingMembers() {
  document.getElementById('cw-pending-count').innerText = window.pendingCaravanMembers.length;
  document.getElementById('cw-pending-members').innerHTML = window.pendingCaravanMembers.map(p => `
    <li class="u-bg-primary-color u-p-4-8 u-r-4 u-fs-xs u-flex u-items-center u-gap-6">
      ${esc(p.name)} (NP-${p.code})
      <i role="button" tabindex="0" aria-label="حذف از فهرست" class="fa-solid fa-times u-pointer" data-click="removePendingMember" data-click-args="${esc(JSON.stringify([String(p.id)]))}"></i>
    </li>
  `).join('');
}

function closeCaravanWizard() { document.getElementById('caravan-wizard-modal').style.display = 'none'; }

async function submitCaravan(e) {
  e.preventDefault();
  const name = document.getElementById('cw-name').value;
  const capacityLimit = document.getElementById('cw-capacity').value;
  const mentorId = document.getElementById('cw-mentor-id').value;
  const description = document.getElementById('cw-description').value;
  const socialGroupLink = document.getElementById('cw-social-link').value;
  const studentIds = window.pendingCaravanMembers.map(s => s.id);

  if(!mentorId) return showToast('لطفاً یک راهبر انتخاب کنید.', 'error');

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
  } catch(err) { console.error(err); }
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

  container.innerHTML = '<p class="u-text-center u-c-text-muted u-fs-xs u-m-10-0"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری دانش‌آموزان...</p>';

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
      container.innerHTML = '<p class="u-text-center u-c-danger-text u-fs-xs u-m-10-0">دانش‌آموزی با این مشخصات یافت نشد</p>';
      return;
    }

    container.innerHTML = students.map(u => {
      const hasCaravan = Boolean(u.caravanId || (u.caravanName && u.caravanName !== 'فاقد کاروان' && u.caravanName !== '-'));
      const isChecked = window.selectedCandidateMembers.has(u.id) && !hasCaravan ? 'checked' : '';

      const caravanBadge = hasCaravan 
        ? `<span class="u-c-danger-text u-fs-2xs u-bg-danger-15 u-bd-danger-30 u-p-2-8 u-r-6 u-inline-flex u-items-center u-gap-4"><i class="fa-solid fa-lock u-fs-2xs"></i> عضو کاروان «${esc(u.caravanName)}» (غیرقابل انتخاب)</span>`
        : `<span class="u-c-success-text u-fs-2xs u-bg-success-15 u-bd-success-30 u-p-2-8 u-r-6 u-inline-flex u-items-center u-gap-4"><i class="fa-solid fa-check u-fs-2xs"></i> فاقد کاروان (آماده عضویت)</span>`;

      return `
        <div class="u-flex u-justify-between u-items-center u-p-10-12 u-bb-fg-5 u-fs-sm" data-style="opacity: ${hasCaravan ? '0.6' : '1'}; background: ${hasCaravan ? 'rgb(var(--shade-rgb) / 0.15)' : 'transparent'}">
          <label class="u-flex u-items-center u-gap-12 u-flex-1 u-m-0" data-style="cursor:${hasCaravan ? 'not-allowed' : 'pointer'}">
            <input type="checkbox" 
                   ${hasCaravan ? 'disabled' : `data-change="toggleCandidateSelection" data-change-args="${esc(JSON.stringify(["$this", String(u.id)]))}"`} 
                   ${isChecked}
                   data-style="${hasCaravan ? 'cursor:not-allowed; opacity:0.3;' : 'cursor:pointer;'}">
            <div class="u-flex u-col u-gap-2">
              <div class="u-flex u-items-center u-gap-8">
                <strong data-style="color:${hasCaravan ? 'var(--text-muted)' : 'white'};">${esc(u.name || 'بدون نام')}</strong>
                <span class="u-c-text-muted u-fs-2xs u-mono" dir="ltr">${esc(u.phoneNumber || '-')}</span>
                <span class="u-c-primary-text u-fs-2xs u-bg-primary-10 u-p-1-6 u-r-4">دانش‌آموز</span>
              </div>
              <div class="u-mt-2">
                ${caravanBadge}
              </div>
            </div>
          </label>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = '<p class="u-text-center u-c-danger-text u-fs-xs">خطا در جستجو و دریافت لیست دانش‌آموزان</p>';
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

window.loadUsersData = loadUsers;

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
