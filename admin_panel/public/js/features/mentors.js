// Mentors: list, dossier, mentor modal, moderation, document verification queue.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ===============================
// MODULE A: MENTORS OPERATIONS & DOSSIER
// ===============================

window.mentorsMasterList = [];

window.calculateMentorStars = function(ratings, evals) {
  let sum = 0, count = 0;
  if (Array.isArray(ratings)) {
    ratings.forEach(r => {
      const v = Number(r.ratingValue) || Number(r.rating) || 0;
      if (v > 0) { sum += v; count++; }
    });
  }
  if (Array.isArray(evals)) {
    evals.forEach(e => {
      const v = Number(e.rating) || Number(e.responsivenessScore) || 0;
      if (v > 0) { sum += v; count++; }
    });
  }
  if (count === 0) {
    return { score: null, count: 0, text: 'فاقد ارزیابی (۰ نظر)', avgNumeric: 0 };
  }
  const avg = (sum / count).toFixed(1);
  return { score: avg, count: count, text: `${avg} (${count} نظر)`, avgNumeric: parseFloat(avg) };
};

window.loadMentors = async function() {
  const tbody = document.getElementById('mentors-table-body') || document.querySelector('#mentors-table tbody');
  if (!tbody) return;

  NopaTable.loading(tbody, 'در حال بارگذاری لیست راهبران و اساتید...');

  try {
    const res = await request('/api/v1/admin/mentors');
    if (!res.ok) throw new Error('خطا در دریافت لیست راهبران');
    const mentors = await res.json();
    window.mentorsMasterList = Array.isArray(mentors) ? mentors : [];

    const totalBadge = document.getElementById('mentors-total-count-badge');
    if (totalBadge) {
      totalBadge.textContent = `${window.mentorsMasterList.length} راهبر`;
    }

    window.filterMentorsList();
  } catch (err) {
    console.error('Error loading mentors:', err);
    NopaTable.error(tbody, `خطا در بارگذاری اطلاعات: ${err.message}`);
  }
};

window.filterMentorsList = function() {
  const tbody = document.getElementById('mentors-table-body') || document.querySelector('#mentors-table tbody');
  if (!tbody) return;

  if (!window.mentorsMasterList || window.mentorsMasterList.length === 0) {
    NopaTable.empty(tbody, 'هیچ راهبری در سیستم ثبت نشده است.');
    return;
  }

  const query = (document.getElementById('mentor-filter-search')?.value || '').trim().toLowerCase();
  const levelFilter = document.getElementById('mentor-filter-level')?.value || 'all';
  const caravanFilter = document.getElementById('mentor-filter-caravan')?.value || 'all';
  const statusFilter = document.getElementById('mentor-filter-status')?.value || 'all';
  const sortFilter = document.getElementById('mentor-filter-sort')?.value || 'caravans_desc';

  let filtered = [...window.mentorsMasterList];

  // 1. Text search filter
  if (query) {
    filtered = filtered.filter(m => {
      const name = (m.name || '').toLowerCase();
      const phone = (m.phoneNumber || '').toLowerCase();
      const natId = (m.nationalId || '').toLowerCase();
      const city = (m.city || '').toLowerCase();
      const caravanNames = (m.mentoredCaravans || []).map(c => (c.name || '').toLowerCase()).join(' ');

      return name.includes(query) || phone.includes(query) || natId.includes(query) || city.includes(query) || caravanNames.includes(query);
    });
  }

  // 2. Mentor level filter
  if (levelFilter !== 'all') {
    const targetLvl = parseInt(levelFilter);
    filtered = filtered.filter(m => (parseInt(m.mentorLevel) || 1) === targetLvl);
  }

  // 3. Caravan assignment filter
  if (caravanFilter === 'has_caravan') {
    filtered = filtered.filter(m => (m.mentoredCaravans && m.mentoredCaravans.length > 0) || m.caravanId != null);
  } else if (caravanFilter === 'no_caravan') {
    filtered = filtered.filter(m => (!m.mentoredCaravans || m.mentoredCaravans.length === 0) && !m.caravanId);
  }

  // 4. Account status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(m => (m.accountStatus || 'ACTIVE') === statusFilter);
  }

  // 5. Sorting
  filtered.sort((a, b) => {
    const caravansCountA = (a.mentoredCaravans?.length || 0);
    const caravansCountB = (b.mentoredCaravans?.length || 0);

    if (sortFilter === 'caravans_desc') {
      return caravansCountB - caravansCountA;
    } else if (sortFilter === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '', 'fa');
    }
    return 0;
  });

  // Update count badge
  const totalBadge = document.getElementById('mentors-total-count-badge');
  if (totalBadge) {
    if (filtered.length === window.mentorsMasterList.length) {
      totalBadge.textContent = `${window.mentorsMasterList.length} راهبر`;
    } else {
      totalBadge.textContent = `نمایش ${filtered.length} از ${window.mentorsMasterList.length} راهبر`;
    }
  }

  // Render rows
  if (filtered.length === 0) {
    NopaTable.empty(tbody, 'هیچ راهبری با معیارهای فیلتر و جستجوی انتخاب‌شده مطابقت ندارد.', 'fa-solid fa-filter-circle-xmark');
    return;
  }

  window.renderMentorsRows(filtered, tbody);
};

window.renderMentorsRows = function(mentorsList, tbody) {
  tbody.innerHTML = mentorsList.map(m => {
    const avatarInitials = (m.name ? m.name.trim().split(' ').map(n => n[0]).join('') : 'را').substring(0, 2);

    // Format caravans badges
    const caravans = m.mentoredCaravans || (m.caravan ? [m.caravan] : []);
    const caravansHtml = caravans.length > 0
      ? caravans.map(c => `<span class="badge u-bg-primary-20 u-c-primary-text u-bd-primary-40 u-p-4-8 u-r-6 u-fs-2xs u-m-2 u-inline-block"><i class="fa-solid fa-people-group"></i> ${esc(c.name)}</span>`).join(' ')
      : '<span class="u-c-text-faint u-fs-xs">فاقد کاروان</span>';

    // Status indicator
    const isSuspended = m.accountStatus === 'SUSPENDED' || m.blocked || m.isDeleted;
    const statusDot = isSuspended ? '<span title="مسدود / غیرفعال" class="u-inline-block u-w-9 u-h-9 u-r-50p u-bg-danger"></span>' : '<span title="فعال" class="u-inline-block u-w-9 u-h-9 u-r-50p u-bg-success"></span>';

    // National ID (only real data)
    const nationalIdText = (m.nationalId && m.nationalId !== 'null' && m.nationalId.trim() && !m.nationalId.startsWith('۱۲۳۴۵۶') && !m.nationalId.startsWith('123456'))
      ? `<span class="u-mono u-c-text-soft">${esc(m.nationalId)}</span>`
      : '<span class="u-c-text-faint u-fs-2xs">وارد نشده است</span>';

    return `
      <tr class="u-tr-all-0_2s-ease">
        <td class="u-text-center">
          <div class="u-w-38 u-h-38 u-r-50p u-flex u-items-center u-justify-center u-bold u-c-white u-fs-sm u-m-0-auto u-shadow-0-2-6-shade-30 u-bg-primary">
            ${avatarInitials}
          </div>
        </td>
        <td>
          <div class="u-flex u-items-center u-gap-6">
            ${statusDot}
            <strong class="u-c-text u-fs-base">${esc(m.name || 'راهبر بدون نام')}</strong>
          </div>
          ${m.role === 'SUPER_MENTOR' ? '<span class="u-fs-2xs u-c-accent-text u-bg-accent-15 u-p-1-6 u-r-4">سرراهبر</span>' : ''}
        </td>
        <td class="u-mono u-direction-ltr u-text-right u-c-text-soft">${esc(m.phoneNumber || '-')}</td>
        <td class="u-text-center">${nationalIdText}</td>
        <td>${caravansHtml}</td>
        <td class="u-text-center u-nowrap">
          <div class="u-inline-flex u-gap-6 u-items-center">
            <button class="btn-action u-bg-primary-15 u-c-primary-text u-bd-primary-35 u-r-6 u-p-6-10 u-fs-xs u-pointer u-fw-500 u-inline-flex u-items-center u-gap-4" data-click="viewMentorDossier" data-click-args="${esc(JSON.stringify([String(m.id)]))}" title="نمایش شناسنامه جامع">
              <i class="fa-solid fa-eye"></i> شناسنامه
            </button>
            <button class="btn-action u-bg-success-15 u-c-success-text u-bd-success-35 u-r-6 u-p-6-10 u-fs-xs u-pointer u-fw-500 u-inline-flex u-items-center u-gap-4" data-click="editMentor" data-click-args="${esc(JSON.stringify([String(m.id)]))}" title="ویرایش اطلاعات">
              <i class="fa-solid fa-pen"></i> ویرایش
            </button>
            <button class="btn-action u-bg-danger-15 u-c-danger-text u-bd-danger-35 u-r-6 u-p-6-10 u-fs-xs u-pointer u-fw-500 u-inline-flex u-items-center u-gap-4" data-click="openMentorModerationModal" data-click-args="${esc(JSON.stringify([String(m.id)]))}" title="مدیریت وضعیت و تعلیق">
              <i class="fa-solid fa-user-shield"></i> وضعیت
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.currentDossierData = null;
window.currentMentorId = null;

window.viewMentorDossier = async function(mentorId) {
  const modal = document.getElementById('mentor-dossier-modal');
  const body = document.getElementById('dossier-content-body');
  const footerActions = document.getElementById('dossier-footer-actions');
  if (!modal || !body) return;

  window.currentMentorId = mentorId;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
  body.innerHTML = '<div class="u-text-center u-p-32 u-c-primary-text"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><div class="u-mt-10">در حال بارگذاری شناسنامه جامع راهبر...</div></div>';

  let mentor = window.mentorsMasterList.find(m => m.id === mentorId);

  try {
    const res = await request(`/api/v1/admin/mentors/${mentorId}/dossier`);
    let dossier = null;
    if (res.ok) {
      dossier = await res.json();
    }
    window.currentDossierData = dossier;

    if (!mentor && dossier?.identity) {
      mentor = dossier.identity;
    }

    const mentorName = dossier?.identity?.name || mentor?.name || 'راهبر آموزشی';
    const initials = mentorName.trim().split(' ').map(n => n[0]).join('').substring(0, 2);
    
    document.getElementById('dossier-mentor-name').innerHTML = `<i class="fa-solid fa-id-card u-c-primary-text"></i> شناسنامه راهبر: ${esc(mentorName)}`;
    const cleanNatId = (dossier?.identity?.nationalId || mentor?.nationalId || '').trim();
    const natIdDisplay = (cleanNatId && cleanNatId !== 'null' && !cleanNatId.startsWith('۱۲۳۴۵۶') && !cleanNatId.startsWith('123456')) ? cleanNatId : 'وارد نشده است';
    document.getElementById('dossier-mentor-subtitle').textContent = `کد ملی: ${natIdDisplay} | موبایل: ${dossier?.identity?.phoneNumber || mentor?.phoneNumber || '-'}`;
    document.getElementById('dossier-avatar').textContent = initials;

    // Build rich dossier content with pure real ratings
    const caravans = dossier?.caravans || mentor?.mentoredCaravans || [];
    const students = dossier?.supervisedStudents || [];
    const starsInfo = window.calculateMentorStars(mentor?.ratingsReceived, mentor?.evaluationsReceived);
    const scoreTitle = starsInfo.score !== null ? `${starsInfo.score} <span class="u-fs-xs u-c-text-muted">/ ۵</span>` : `<span class="u-fs-md u-c-text-muted">فاقد ارزیابی</span>`;
    const scoreSub = starsInfo.count > 0 ? `از میان ${starsInfo.count} ارزیابی ثبت‌شده` : `هنوز ارزیابی یا امتیازی برای این راهبر ثبت نشده است`;

    body.innerHTML = `
      <!-- TOP STATS CARDS -->
      <div class="u-grid u-cols-fit-200 u-gap-12 u-mb-20">
        <div class="u-bg-surface-2-70 u-bd-primary-30 u-r-12 u-p-14 u-text-center">
          <div class="u-fs-2xs u-c-text-soft u-mb-4"><i class="fa-solid fa-people-group u-c-primary-text"></i> کاروان‌های تحت راهبری</div>
          <div class="u-fs-xl u-bold u-c-primary-text">${caravans.length} <span class="u-fs-xs u-c-text-muted">کاروان</span></div>
          <div class="u-fs-2xs u-c-text-muted u-mt-2">گروه‌های فعال آموزشی</div>
        </div>

        <div class="u-bg-surface-2-70 u-bd-success-30 u-r-12 u-p-14 u-text-center">
          <div class="u-fs-2xs u-c-text-soft u-mb-4"><i class="fa-solid fa-users u-c-success-text"></i> دانش‌آموزان تحت نظارت</div>
          <div class="u-fs-xl u-bold u-c-success-text">${students.length} <span class="u-fs-xs u-c-text-muted">دانش‌آموز</span></div>
          <div class="u-fs-2xs u-c-text-muted u-mt-2">افراد تحت سرپرستی این راهبر</div>
        </div>

        <div class="u-bg-surface-2-70 u-bd-primary-30 u-r-12 u-p-14 u-text-center">
          <div class="u-fs-2xs u-c-text-soft u-mb-4"><i class="fa-solid fa-shield-halved u-c-primary-text"></i> وضعیت حساب کاربری</div>
          <div class="u-fs-lg u-bold u-c-success-text u-mt-4">${mentor?.accountStatus || 'ACTIVE'}</div>
          <div class="u-fs-2xs u-c-text-muted u-mt-4">دسترسی به پنل راهبر</div>
        </div>
      </div>

      <!-- PERSONAL & IDENTITY DOSSIER -->
      <div class="u-bg-surface-60 u-bd-fg-8 u-r-12 u-p-16 u-mb-16">
        <div class="u-bold u-c-primary-text u-fs-base u-mb-12 u-flex u-items-center u-gap-6">
          <i class="fa-solid fa-user-check"></i> مشخصات هویتی و فردی راهبر
        </div>
        <div class="u-grid u-cols-fit-200 u-gap-12 u-fs-sm">
          <div><strong class="u-c-text-muted">نام کامل:</strong> <span class="u-c-text">${esc(mentorName)}</span></div>
          <div><strong class="u-c-text-muted">شماره همراه:</strong> <span class="u-c-text u-mono">${esc(mentor?.phoneNumber || '-')}</span></div>
          <div><strong class="u-c-text-muted">کد ملی:</strong> <span class="u-c-text u-mono">${mentor?.nationalId && mentor?.nationalId !== 'null' && !mentor?.nationalId.startsWith('۱۲۳۴۵۶') && !mentor?.nationalId.startsWith('123456') ? esc(mentor.nationalId) : 'وارد نشده است'}</span></div>
          <div><strong class="u-c-text-muted">تاریخ تولد:</strong> <span class="u-c-text">${esc(mentor?.dateOfBirth || 'ثبت نشده')}</span></div>
          <div><strong class="u-c-text-muted">شهر محل سکونت:</strong> <span class="u-c-text">${esc(mentor?.city || 'ثبت نشده')}</span></div>
          <div><strong class="u-c-text-muted">پلتفرم پیام‌رسان:</strong> <span class="u-c-text">${esc(mentor?.socialPlatform || 'ثبت نشده')} (${esc(mentor?.socialMessengerHandle || '-')})</span></div>
          <div><strong class="u-c-text-muted">وضعیت احراز هویت:</strong> <span data-style="color:${mentor?.identityVerified ? 'var(--success-text)' : 'var(--accent)'};">${mentor?.identityVerified ? 'تایید شده' : 'در انتظار بررسی'}</span></div>
        </div>
      </div>

      <!-- CARAVANS LIST -->
      <div class="u-bg-surface-60 u-bd-fg-8 u-r-12 u-p-16 u-mb-16">
        <div class="u-bold u-c-primary-text u-fs-base u-mb-12 u-flex u-items-center u-gap-6">
          <i class="fa-solid fa-caravan"></i> وضعیت کاروان‌های تحت نظارت
        </div>
        ${caravans.length > 0 ? `
          <div class="u-grid u-cols-fit-240 u-gap-10">
            ${caravans.map(c => `
              <div class="u-bg-surface-2-70 u-bd-fg-6 u-r-10 u-p-12">
                <div class="u-flex u-justify-between u-fs-sm u-bold u-c-primary-text u-mb-6">
                  <span>${esc(c.name)}</span>
                  <span class="u-fs-2xs u-c-text-soft">${c.memberCount || 0} عضو</span>
                </div>
                <div class="u-fs-2xs u-c-text-muted u-mb-6">پیشرفت کلی کاروان: ${c.progress || 0}%</div>
                <div class="u-bg-shade-30 u-h-6 u-r-3 u-overflow-hidden">
                  <div class="u-h-full" data-style="background:linear-gradient(90deg, var(--primary), var(--success)); width:${c.progress || 0}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="u-c-text-muted u-fs-xs">راهبر در حال حاضر به کاروانی منتسب نشده است.</div>'}
      </div>

      <!-- SUPERVISED STUDENTS SECTION (افراد تحت سرپرستی این راهبر) -->
      <div class="u-bg-surface-60 u-bd-primary-30 u-r-14 u-p-20 u-mb-16 u-shadow-0-4-20-shade-30">
        <div class="u-flex u-justify-between u-items-center u-wrap u-gap-12 u-mb-16 u-bb-fg-8 u-pb-14">
          <div class="u-flex u-items-center u-gap-10">
            <div class="u-w-38 u-h-38 u-r-10 u-bg-primary-15 u-bd-primary-30 u-flex u-items-center u-justify-center u-c-primary-text u-fs-md">
              <i class="fa-solid fa-users"></i>
            </div>
            <div>
              <div class="u-bold u-c-primary-text u-fs-base">دانش‌آموزان تحت سرپرستی این راهبر</div>
              <div class="u-fs-xs u-c-text-muted u-mt-2">فقط دانش‌آموزان کاروان‌های این راهبر به همراه تیکت‌ها و رفت‌وبرگشت چالش‌ها</div>
            </div>
          </div>
          <div class="u-flex u-items-center u-gap-10">
            <span class="u-bg-primary-12 u-bd-primary-30 u-c-primary-text u-p-6-12 u-r-20 u-fs-xs u-bold">
              ${students.length} دانش‌آموز تحت نظارت
            </span>
            <input type="text" id="dossier-student-filter-input" placeholder="جستجو در نام، موبایل یا کاروان..." data-input="filterDossierStudents" data-input-args="[&quot;$value&quot;]" class="u-bg-shade-35 u-bd-fg-15 u-c-text u-p-6-12 u-r-8 u-fs-xs u-w-210">
          </div>
        </div>

        <div id="dossier-students-container">
          <!-- Populated by window.renderDossierStudents -->
        </div>
      </div>
    `;

    window.renderDossierStudents(students, mentorId);

    footerActions.innerHTML = `
      <button type="button" class="btn-primary u-bg-grad-success u-c-white u-bd-none u-p-8-20 u-r-8 u-bold u-pointer u-inline-flex u-items-center u-gap-6" data-click="editMentorFromDossier" data-click-args="${esc(JSON.stringify([String(mentorId)]))}">
        <i class="fa-solid fa-pen"></i> ویرایش مشخصات این راهبر
      </button>
    `;
  } catch (err) {
    console.error('viewMentorDossier error:', err);
    body.innerHTML = `<div class="u-c-danger-text u-text-center u-p-20">خطا در دریافت اطلاعات پرونده: ${esc(err.message)}</div>`;
  }
};

window.renderDossierStudents = function(students, mentorId) {
  const container = document.getElementById('dossier-students-container');
  if (!container) return;

  if (!students || students.length === 0) {
    container.innerHTML = `
      <div class="u-text-center u-p-32-20 u-bg-shade-20 u-r-12 u-c-text-muted u-bd-1-dashed-fg-8">
        <i class="fa-solid fa-user-graduate fa-2x u-c-text-faint u-mb-8"></i>
        <div class="u-fs-base u-bold u-c-text-soft">هیچ دانش‌آموزی در کاروان‌های این راهبر یافت نشد</div>
        <div class="u-fs-xs u-mt-4">به محض انتساب دانش‌آموزان به کاروان‌های این راهبر، لیست آن‌ها به همراه سوابق تعاملی در این قسمت نمایش می‌یابد.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="u-flex u-col u-gap-10">
      ${students.map(s => {
        const initials = (s.name || 'دا').trim().split(' ').map(n => n[0]).join('').substring(0, 2);
        const openTicketsBadge = s.stats.openTickets > 0 ? 
          `<span class="u-bg-danger-20 u-c-danger-text u-bd-danger-40 u-p-2-8 u-r-6 u-fs-2xs u-bold">${s.stats.openTickets} تیکت باز</span>` : 
          `<span class="u-bg-success-15 u-c-success-text u-p-2-8 u-r-6 u-fs-2xs">تیکت بازی ندارد</span>`;
        
        const pendingSubmissionsBadge = s.stats.pendingSubmissions > 0 ?
          `<span class="u-bg-accent-20 u-c-accent-text u-bd-accent-40 u-p-2-8 u-r-6 u-fs-2xs u-bold">${s.stats.pendingSubmissions} در انتظار بررسی</span>` :
          `<span class="u-bg-success-15 u-c-success-text u-p-2-8 u-r-6 u-fs-2xs">تکالیف بررسی‌شده</span>`;

        return `
          <div class="u-bg-surface-2-70 u-bd-fg-8 u-r-12 u-p-14 u-flex u-justify-between u-items-center u-wrap u-gap-14 u-transition" data-hover="border-primary">
            <!-- Student Bio & Info -->
            <div class="u-flex u-items-center u-gap-12 u-minw-240">
              <div class="u-w-44 u-h-44 u-r-50p u-flex u-items-center u-justify-center u-bold u-fs-md u-c-white u-bd-2-solid-fg-20 u-shrink-0 u-grad-success-primary">
                ${initials}
              </div>
              <div>
                <div class="u-bold u-c-text u-fs-base u-flex u-items-center u-gap-8">
                  <span>${esc(s.name)}</span>
                  <span class="u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-p-1-8 u-r-5 u-fs-2xs u-fw-normal">
                    <i class="fa-solid fa-campground"></i> ${esc(s.caravanName)}
                  </span>
                </div>
                <div class="u-fs-xs u-c-text-muted u-mt-4 u-flex u-gap-12 u-mono">
                  <span>موبایل: ${esc(s.phoneNumber || '-')}</span>
                  <span>کد: ${s.userCode || '-'}</span>
                  <span class="u-c-accent-text">${s.zarikBalance || 0} زریک</span>
                </div>
              </div>
            </div>

            <!-- Stats Indicators -->
            <div class="u-flex u-gap-10 u-items-center u-wrap">
              <div class="u-bg-surface-70 u-bd-fg-6 u-r-8 u-p-6-10 u-fs-xs u-flex u-items-center u-gap-6">
                <i class="fa-solid fa-headset u-c-accent-text"></i>
                <span class="u-c-text-soft">کل تیکت‌ها: ${s.stats.totalTickets}</span>
                ${openTicketsBadge}
              </div>

              <div class="u-bg-surface-70 u-bd-fg-6 u-r-8 u-p-6-10 u-fs-xs u-flex u-items-center u-gap-6">
                <i class="fa-solid fa-trophy u-c-primary-text"></i>
                <span class="u-c-text-soft">ارسال‌ها: ${s.stats.totalSubmissions}</span>
                ${pendingSubmissionsBadge}
              </div>
            </div>

            <!-- Action Buttons for Tickets & Challenges -->
            <div class="u-flex u-gap-8 u-items-center u-wrap">
              <button type="button" data-click="openStudentTicketsModal" data-click-args="${esc(JSON.stringify([String(mentorId), String(s.id)]))}" class="u-bd-accent-50 u-c-accent-text u-p-8-14 u-r-8 u-fs-xs u-bold u-pointer u-inline-flex u-items-center u-gap-6 u-transition u-grad-accent-soft" data-hover="accent-fill">
                <i class="fa-solid fa-comments"></i> مشاهده تیکت‌ها (${s.stats.totalTickets})
              </button>

              <button type="button" data-click="openStudentChallengesModal" data-click-args="${esc(JSON.stringify([String(mentorId), String(s.id)]))}" class="u-bd-primary-50 u-c-primary-text u-p-8-14 u-r-8 u-fs-xs u-bold u-pointer u-inline-flex u-items-center u-gap-6 u-transition u-grad-primary-soft" data-hover="primary-fill">
                <i class="fa-solid fa-trophy"></i> رفت و برگشت چالش‌ها (${s.stats.totalSubmissions})
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
};

window.filterDossierStudents = function(query) {
  if (!window.currentDossierData?.supervisedStudents) return;
  const q = (query || '').trim().toLowerCase();
  const filtered = window.currentDossierData.supervisedStudents.filter(s => {
    return (s.name && s.name.toLowerCase().includes(q)) ||
           (s.phoneNumber && s.phoneNumber.includes(q)) ||
           (s.caravanName && s.caravanName.toLowerCase().includes(q));
  });
  window.renderDossierStudents(filtered, window.currentMentorId);
};

window.openStudentTicketsModal = function(mentorId, studentId) {
  const modal = document.getElementById('student-tickets-modal');
  const body = document.getElementById('student-tickets-content-body');
  if (!modal || !body) return;

  const student = window.currentDossierData?.supervisedStudents?.find(s => s.id === studentId);
  if (!student) {
    showToast('اطلاعات دانش‌آموز یافت نشد.', 'error');
    return;
  }

  const mentorName = window.currentDossierData?.identity?.name || 'راهبر آموزشی';
  document.getElementById('student-tickets-title').innerHTML = `<i class="fa-solid fa-headset u-c-accent-text"></i> تیکت‌ها و مکالمات: <span class="u-c-text">${esc(student.name)}</span> <span class="u-fs-xs u-c-text-muted u-fw-normal">(تحت سرپرستی: ${mentorName})</span>`;
  document.getElementById('student-tickets-subtitle').textContent = `کاروان: ${student.caravanName} | موبایل: ${student.phoneNumber || '-'} | کد دانش‌آموزی: ${student.userCode || '-'}`;

  const tickets = student.tickets || [];
  if (tickets.length === 0) {
    body.innerHTML = `
      <div class="u-text-center u-p-32-20 u-c-text-muted u-bg-shade-25 u-r-12 u-bd-1-dashed-fg-10">
        <i class="fa-solid fa-inbox fa-3x u-c-text-faint u-mb-12"></i>
        <div class="u-fs-base u-bold u-c-text-soft">هیچ تیکتی بین این دانش‌آموز و این راهبر رد و بدل نشده است</div>
        <div class="u-fs-xs u-mt-6 u-c-text-muted">تیکت‌های مطرح‌شده توسط دانش‌آموز در کاروان و پاسخ‌های ارسالی راهبر، به صورت خودکار در این تاریخچه ثبت می‌شوند.</div>
      </div>
    `;
  } else {
    body.innerHTML = tickets.map(t => {
      let statusBadge = '';
      if (t.status === 'resolved') {
        statusBadge = '<span class="u-bg-success-15 u-c-success-text u-bd-success-30 u-p-4-8 u-r-6 u-fs-2xs u-bold">حل‌شده</span>';
      } else if (t.status === 'answered') {
        statusBadge = '<span class="u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-p-4-8 u-r-6 u-fs-2xs u-bold">پاسخ داده شده</span>';
      } else {
        statusBadge = '<span class="u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-p-4-8 u-r-6 u-fs-2xs u-bold">در انتظار پاسخ</span>';
      }

      const tDate = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fa-IR') : '';
      const replies = t.replies || [];

      return `
        <div class="u-bg-surface-2-70 u-bd-fg-8 u-r-12 u-p-16">
          <!-- Ticket Header -->
          <div class="u-flex u-justify-between u-items-center u-wrap u-gap-8 u-mb-12 u-bb-fg-6 u-pb-10">
            <div class="u-flex u-items-center u-gap-8">
              <span class="u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-p-2-8 u-r-6 u-fs-xs u-bold">
                ${esc(t.category || 'پشتیبانی')}
              </span>
              <span class="u-bold u-c-text u-fs-base">${esc(t.subject || 'بدون موضوع')}</span>
            </div>
            <div class="u-flex u-items-center u-gap-10">
              <span class="u-fs-xs u-c-text-muted u-mono">${tDate}</span>
              ${statusBadge}
            </div>
          </div>

          <!-- Initial Message from Student -->
          <div class="u-bg-surface-60 u-r-10 u-p-12 u-mb-12 u-br-3-solid-primary">
            <div class="u-fs-xs u-bold u-c-primary-text u-mb-4 u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-user-graduate"></i> پیام دانش‌آموز (${esc(student.name)}):
            </div>
            <div class="u-fs-sm u-c-text u-lh-1_6">${esc(t.subject || '')}</div>
            ${t.voiceUrl ? `<div class="u-mt-8"><audio controls src="${esc(t.voiceUrl)}" class="u-h-34 u-w-full u-maxw-320"></audio></div>` : ''}
            ${t.attachmentUrl ? `<div class="u-mt-8"><a href="${esc(t.attachmentUrl)}" target="_blank" class="u-c-primary-text u-fs-xs u-no-underline"><i class="fa-solid fa-paperclip"></i> مشاهده فایل ضمیمه</a></div>` : ''}
          </div>

          <!-- Conversation Replies History -->
          ${replies.length > 0 ? `
            <div class="u-flex u-col u-gap-8 u-mb-12 u-pr-12 u-br-2-dashed-fg-10">
              ${replies.map(r => {
                const rDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : '';
                return `
                  <div class="u-bg-surface-80 u-bd-fg-6 u-r-8 u-p-10-12">
                    <div class="u-flex u-justify-between u-items-center u-mb-4 u-fs-xs">
                      <span class="u-bold u-c-success-text u-flex u-items-center u-gap-6">
                        <i class="fa-solid fa-reply"></i> پاسخ راهبر (${esc(r.mentor?.name || mentorName)}):
                      </span>
                      <span class="u-c-text-muted u-mono">${rDate}</span>
                    </div>
                    <div class="u-fs-sm u-c-text u-lh-1_6">${esc(r.message)}</div>
                    ${r.voiceUrl ? `<div class="u-mt-6"><audio controls src="${esc(r.voiceUrl)}" class="u-h-30 u-w-full u-maxw-300"></audio></div>` : ''}
                    ${r.attachmentUrl ? `<div class="u-mt-6"><a href="${esc(r.attachmentUrl)}" target="_blank" class="u-c-primary-text u-fs-xs"><i class="fa-solid fa-paperclip"></i> مشاهده فایل ضمیمه</a></div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="u-fs-xs u-c-text-muted u-mb-12 u-p-6-0">هنوز پاسخی به این تیکت ثبت نشده است.</div>'}

          <!-- Quick Reply & Action Form -->
          <div class="u-bg-surface-50 u-bd-fg-5 u-r-8 u-p-10 u-flex u-col u-gap-8">
            <div class="u-flex u-gap-8">
              <input type="text" id="ticket-reply-input-${t.id}" placeholder="ثبت پاسخ راهبر به دانش‌آموز..." class="u-flex-1 u-bg-shade-30 u-bd-fg-15 u-c-text u-p-8-12 u-r-8 u-fs-sm">
              <button type="button" data-click="sendTicketReply" data-click-args="${esc(JSON.stringify([String(t.id), String(mentorId), String(studentId)]))}" class="u-bg-grad-accent u-c-white u-bd-none u-p-8-16 u-r-8 u-bold u-pointer u-fs-xs u-inline-flex u-items-center u-gap-6">
                <i class="fa-solid fa-paper-plane"></i> ارسال پاسخ
              </button>
              ${t.status !== 'resolved' ? `
                <button type="button" data-click="resolveStudentTicket" data-click-args="${esc(JSON.stringify([String(t.id), String(mentorId), String(studentId)]))}" class="u-bg-success-15 u-bd-success-35 u-c-success-text u-p-8-12 u-r-8 u-pointer u-fs-xs u-inline-flex u-items-center u-gap-6" title="تغییر وضعیت تیکت به حل‌شده">
                  <i class="fa-solid fa-check"></i> حل‌شد
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
};

window.sendTicketReply = async function(ticketId, mentorId, studentId) {
  const input = document.getElementById(`ticket-reply-input-${ticketId}`);
  if (!input || !input.value.trim()) {
    showToast('لطفاً متن پاسخ را وارد نمایید.', 'error');
    return;
  }
  const message = input.value.trim();

  try {
    const res = await request(`/api/v1/admin/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ message, mentorId })
    });
    const result = await res.json();
    if (res.ok) {
      showToast('پاسخ با موفقیت ثبت و برای دانش‌آموز ارسال شد.', 'success');
      await window.refreshDossierData(mentorId);
      window.openStudentTicketsModal(mentorId, studentId);
    } else {
      showToast('خطا در ارسال پاسخ: ' + (result.error || 'خطای سرور'), 'error');
    }
  } catch (e) {
    console.error('sendTicketReply error:', e);
    showToast('خطا در برقراری ارتباط با سرور: ' + e.message, 'error');
  }
};

window.resolveStudentTicket = async function(ticketId, mentorId, studentId) {
  if (!(await NopaConfirm('آیا از تغییر وضعیت این تیکت به «حل‌شده» اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/tickets/${ticketId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      }
    });
    if (res.ok) {
      showToast('وضعیت تیکت با موفقیت به «حل‌شده» تغییر یافت.', 'success');
      await window.refreshDossierData(mentorId);
      window.openStudentTicketsModal(mentorId, studentId);
    } else {
      const err = await res.json();
      showToast('خطا: ' + (err.error || 'عملیات ناموفق'), 'error');
    }
  } catch (e) {
    showToast('خطا در ارتباط با سرور: ' + e.message, 'error');
  }
};

window.openStudentChallengesModal = function(mentorId, studentId) {
  const modal = document.getElementById('student-challenges-modal');
  const body = document.getElementById('student-challenges-content-body');
  if (!modal || !body) return;

  const student = window.currentDossierData?.supervisedStudents?.find(s => s.id === studentId);
  if (!student) {
    showToast('اطلاعات دانش‌آموز یافت نشد.', 'error');
    return;
  }

  const mentorName = window.currentDossierData?.identity?.name || 'راهبر آموزشی';
  document.getElementById('student-challenges-title').innerHTML = `<i class="fa-solid fa-trophy u-c-primary-text"></i> رفت و برگشت چالش‌ها و تکالیف: <span class="u-c-text">${esc(student.name)}</span> <span class="u-fs-xs u-c-text-muted u-fw-normal">(راهبر: ${mentorName})</span>`;
  document.getElementById('student-challenges-subtitle').textContent = `کاروان: ${student.caravanName} | تکالیف، فایل‌های ارسالی، نمرات و بازخوردهای اصلاحی راهبر`;

  const submissions = student.submissions || [];
  const quizSubs = student.quizSubmissions || [];

  if (submissions.length === 0 && quizSubs.length === 0) {
    body.innerHTML = `
      <div class="u-text-center u-p-32-20 u-c-text-muted u-bg-shade-25 u-r-12 u-bd-1-dashed-fg-10">
        <i class="fa-solid fa-file-circle-xmark fa-3x u-c-text-faint u-mb-12"></i>
        <div class="u-fs-base u-bold u-c-text-soft">هیچ ارسال چالشی از طرف این دانش‌آموز ثبت نشده است</div>
        <div class="u-fs-xs u-mt-6 u-c-text-muted">به محض ارسال تکالیف یا آزمون‌های کاروان توسط دانش‌آموز، جهت بررسی و ثبت بازخورد در این قسمت قرار می‌گیرند.</div>
      </div>
    `;
  } else {
    body.innerHTML = submissions.map(sub => {
      let statusBadge = '';
      if (sub.status === 'approved' || sub.status === 'APPROVED') {
        statusBadge = '<span class="u-bg-success-15 u-c-success-text u-bd-success-30 u-p-4-10 u-r-6 u-fs-xs u-bold">تایید شده</span>';
      } else if (sub.status === 'rejected' || sub.status === 'REJECTED') {
        statusBadge = '<span class="u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-p-4-10 u-r-6 u-fs-xs u-bold">نیاز به اصلاح / رد شده</span>';
      } else {
        statusBadge = '<span class="u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-p-4-10 u-r-6 u-fs-xs u-bold">در انتظار بررسی راهبر</span>';
      }

      const subDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('fa-IR') : '';
      const defaultScore = sub.score !== undefined && sub.score !== null ? sub.score : (sub.challenge?.rewardZarik || 200);

      return `
        <div class="u-bg-surface-2-70 u-bd-fg-8 u-r-12 u-p-16">
          <!-- Challenge Header -->
          <div class="u-flex u-justify-between u-items-center u-wrap u-gap-8 u-mb-12 u-bb-fg-6 u-pb-10">
            <div class="u-flex u-items-center u-gap-8">
              <span class="u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-p-2-8 u-r-6 u-fs-xs u-bold">
                چالش کاروان
              </span>
              <span class="u-bold u-c-text u-fs-base"><i class="fa-solid fa-award u-c-accent-text"></i> ${esc(sub.challenge?.title || 'عنوان چالش')}</span>
            </div>
            <div class="u-flex u-items-center u-gap-10">
              <span class="u-fs-xs u-c-text-muted u-mono">${subDate}</span>
              ${statusBadge}
            </div>
          </div>

          <!-- Student Submission Box -->
          <div class="u-bg-surface-60 u-r-10 u-p-12 u-mb-12 u-br-3-solid-primary">
            <div class="u-fs-xs u-bold u-c-primary-text u-mb-4 u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-user-pen"></i> پاسخ ارسالی دانش‌آموز (${esc(student.name)}):
            </div>
            <div class="u-fs-sm u-c-text u-lh-1_7">${esc(sub.answerText || 'فاقد متن ارسالی (فقط فایل ضمیمه)')}</div>
            ${sub.fileUrl ? `
              <div class="u-mt-8">
                <a href="${esc(sub.fileUrl)}" target="_blank" class="u-inline-flex u-items-center u-gap-6 u-bg-primary-12 u-bd-primary-30 u-c-primary-text u-p-6-12 u-r-6 u-fs-xs u-no-underline">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> مشاهده فایل / تصویر پیوست دانش‌آموز
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Mentor Feedback History (if any) -->
          ${sub.mentorFeedback ? `
            <div class="u-bg-success-8 u-bd-success-20 u-r-10 u-p-12 u-mb-12">
              <div class="u-flex u-justify-between u-items-center u-mb-4 u-fs-xs">
                <span class="u-bold u-c-success-text u-flex u-items-center u-gap-6">
                  <i class="fa-solid fa-comments"></i> بازخورد ثبت‌شده توسط راهبر:
                </span>
                <span class="u-bg-success-20 u-c-success-text u-p-2-8 u-r-6 u-bold u-fs-2xs">
                  امتیاز اعطایی: ${sub.score || 0} زریک
                </span>
              </div>
              <div class="u-fs-sm u-c-text u-lh-1_6">${esc(sub.mentorFeedback)}</div>
            </div>
          ` : ''}

          <!-- Mentor Review / Correction Form -->
          <div class="u-bg-surface-70 u-bd-primary-20 u-r-10 u-p-12">
            <div class="u-fs-xs u-bold u-c-primary-text u-mb-8 u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-pen-to-square"></i> ثبت / بازنویسی نمره و بازخورد راهبر:
            </div>
            <div class="u-grid u-gap-10 u-items-center u-cols-fit-140-auto">
              <select id="review-status-${sub.id}" class="u-bg-surface-2 u-bd-fg-20 u-c-text u-p-8-10 u-r-6 u-fs-xs">
                <option value="approved" ${sub.status === 'approved' || sub.status === 'APPROVED' ? 'selected' : ''}>تایید تکلیف (قبول)</option>
                <option value="rejected" ${sub.status === 'rejected' || sub.status === 'REJECTED' ? 'selected' : ''}>رد تکلیف (نیاز به اصلاح)</option>
              </select>
              <input type="number" id="review-score-${sub.id}" placeholder="امتیاز زریک" value="${defaultScore}" class="u-bg-surface-2 u-bd-fg-20 u-c-text u-p-8-10 u-r-6 u-fs-xs">
              <input type="text" id="review-feedback-${sub.id}" placeholder="متن بازخورد و راهنمایی راهبر..." value="${esc(sub.mentorFeedback || '')}" class="u-col-span-span-2 u-bg-surface-2 u-bd-fg-20 u-c-text u-p-8-10 u-r-6 u-fs-xs">
              <button type="button" data-click="submitSubmissionReview" data-click-args="${esc(JSON.stringify([String(sub.id), String(mentorId), String(studentId)]))}" class="u-bg-grad-success u-c-white u-bd-none u-p-8-16 u-r-6 u-bold u-pointer u-fs-xs u-inline-flex u-items-center u-gap-6 u-nowrap">
                <i class="fa-solid fa-floppy-disk"></i> ثبت بازخورد
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
};

window.submitSubmissionReview = async function(submissionId, mentorId, studentId) {
  const statusEl = document.getElementById(`review-status-${submissionId}`);
  const scoreEl = document.getElementById(`review-score-${submissionId}`);
  const feedbackEl = document.getElementById(`review-feedback-${submissionId}`);

  const status = statusEl ? statusEl.value : 'approved';
  const score = scoreEl ? parseInt(scoreEl.value, 10) || 0 : 0;
  const mentorFeedback = feedbackEl ? feedbackEl.value.trim() : '';

  try {
    const res = await request(`/api/v1/admin/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ status, score, mentorFeedback })
    });
    const result = await res.json();
    if (res.ok) {
      showToast('بازخورد و نمره راهبر با موفقیت ثبت شد و در پرونده ذخیره گردید.', 'success');
      await window.refreshDossierData(mentorId);
      window.openStudentChallengesModal(mentorId, studentId);
    } else {
      showToast('خطا در ثبت بازخورد: ' + (result.error || 'خطای سرور'), 'error');
    }
  } catch (e) {
    console.error('submitSubmissionReview error:', e);
    showToast('خطا در برقراری ارتباط با سرور: ' + e.message, 'error');
  }
};

window.refreshDossierData = async function(mentorId) {
  try {
    const res = await request(`/api/v1/admin/mentors/${mentorId}/dossier`);
    if (res.ok) {
      const dossier = await res.json();
      window.currentDossierData = dossier;
      if (dossier.supervisedStudents) {
        window.renderDossierStudents(dossier.supervisedStudents, mentorId);
      }
    }
  } catch (e) {
    console.error('refreshDossierData error:', e);
  }
};

window.cachedCaravansForMentorModal = [];

window.showMentorModal = async function() {
  const form = document.getElementById('mentor-form');
  if (form) form.reset();
  NopaPersonFields.fill('modal-mentor', {}); // also forgets a previously loaded phone and clears field errors

  document.getElementById('modal-mentor-id').value = '';
  document.getElementById('mentor-modal-form-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> ثبت راهبر جدید در سامانه';
  const certsSection = document.getElementById('modal-mentor-certs-section');
  if (certsSection) certsSection.style.display = 'none';

  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';

  // Load caravans for checklist (starts completely unchecked: Standalone Mentor)
  await window.populateMentorCaravansChecklist([]);

  const modal = document.getElementById('mentor-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

window.editMentor = async function(mentorId) {
  const m = window.mentorsMasterList.find(x => x.id === mentorId);
  if (!m) {
    showToast('اطلاعات راهبر یافت نشد.', 'error');
    return;
  }

  document.getElementById('modal-mentor-id').value = m.id;
  NopaPersonFields.fill('modal-mentor', {
    name: m.name, phoneNumber: m.phoneNumber, nationalId: m.nationalId, dateOfBirth: m.dateOfBirth, gender: m.gender, city: m.city
  });
  document.getElementById('modal-mentor-academic-degree').value = m.academicDegree || m.education || '';
  document.getElementById('modal-mentor-level').value = String(m.mentorLevel || 1);
  document.getElementById('modal-mentor-status').value = m.accountStatus || 'ACTIVE';
  document.getElementById('modal-mentor-social-platform').value = m.socialPlatform || '';
  document.getElementById('modal-mentor-social-handle').value = m.socialMessengerHandle || '';

  document.getElementById('mentor-modal-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> ویرایش اطلاعات راهبر: ${esc(m.name || '')}`;

  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';

  // Populate assigned caravans checklist
  const assignedCaravanIds = (m.mentoredCaravans || []).map(c => c.id);
  if (m.caravanId && !assignedCaravanIds.includes(m.caravanId)) {
    assignedCaravanIds.push(m.caravanId);
  }
  await window.populateMentorCaravansChecklist(assignedCaravanIds);

  // Populate certificates if any
  const certsSection = document.getElementById('modal-mentor-certs-section');
  const certsTbody = document.getElementById('modal-mentor-certs-tbody');
  if (certsSection && certsTbody) {
    if (m.mentorDocuments && m.mentorDocuments.length > 0) {
      certsSection.style.display = 'block';
      certsTbody.innerHTML = m.mentorDocuments.map(doc => {
        let statusTag = doc.status === 'approved' ? '<span class="badge u-bg-success u-c-white">تایید شده</span>' :
                        (doc.status === 'rejected' ? '<span class="badge u-bg-danger u-c-white">رد شده</span>' : '<span class="badge u-bg-accent u-c-white">در انتظار</span>');
        return `
          <tr>
            <td>${esc(doc.filename || 'مدرک پیوست')}</td>
            <td><a href="${esc(doc.url)}" target="_blank" class="u-c-primary-text u-td-underline">مشاهده مدرک</a></td>
            <td>${statusTag}</td>
            <td>
              ${doc.status === 'pending' ? `
                <button type="button" class="btn-icon u-c-success-text u-bg-none u-bd-none u-pointer" data-click="inlineApproveCert" data-click-args="${esc(JSON.stringify([String(doc.id), String(m.id)]))}" title="تایید مدرک"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn-icon u-c-danger-text u-bg-none u-bd-none u-pointer" data-click="inlineRejectCert" data-click-args="${esc(JSON.stringify([String(doc.id), String(m.id)]))}" title="رد مدرک"><i class="fa-solid fa-times"></i></button>
              ` : '-'}
            </td>
          </tr>
        `;
      }).join('');
    } else {
      certsSection.style.display = 'none';
    }
  }

  const modal = document.getElementById('mentor-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

window.populateMentorCaravansChecklist = async function(assignedIds = []) {
  const container = document.getElementById('modal-mentor-caravans-list');
  if (!container) return;

  container.innerHTML = '<span class="u-fs-2xs u-c-text-muted"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری کاروان‌ها...</span>';
  
  try {
    const res = await request('/api/v1/admin/caravans');
    const caravans = res.ok ? await res.json() : [];
    window.cachedCaravansForMentorModal = Array.isArray(caravans) ? caravans : [];

    if (window.cachedCaravansForMentorModal.length === 0) {
      container.innerHTML = '<span class="u-fs-xs u-c-text-muted">هیچ کاروانی در سامانه ثبت نشده است.</span>';
      return;
    }

    container.innerHTML = window.cachedCaravansForMentorModal.map(c => `
      <label class="mentor-caravan-item-label u-flex u-items-center u-gap-8 u-bg-surface-85 u-bd-fg-12 u-r-8 u-p-8-12 u-c-text u-fs-sm u-pointer u-transition" data-caravan-name="${(c.name || '').toLowerCase()}">
        <input type="checkbox" class="mentor-caravan-checkbox u-w-16 u-h-16 u-pointer" value="${c.id}" ${assignedIds.includes(c.id) ? 'checked' : ''}>
        <span class="u-fw-500">${esc(c.name)}</span>
      </label>
    `).join('');
  } catch (e) {
    console.error('Error fetching caravans checklist:', e);
    container.innerHTML = '<span class="u-fs-xs u-c-danger-text">خطا در دریافت لیست کاروان‌ها</span>';
  }
};

window.filterMentorCaravansChecklist = function(query) {
  const term = (query || '').trim().toLowerCase();
  const items = document.querySelectorAll('.mentor-caravan-item-label');
  items.forEach(el => {
    const cName = el.getAttribute('data-caravan-name') || '';
    if (!term || cName.includes(term)) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
};

window.uncheckAllMentorCaravans = function() {
  const checkboxes = document.querySelectorAll('.mentor-caravan-checkbox');
  checkboxes.forEach(cb => { cb.checked = false; });
  const caravanSearch = document.getElementById('mentor-caravan-search-input');
  if (caravanSearch) caravanSearch.value = '';
  window.filterMentorCaravansChecklist('');
};

window.handleMentorFormSubmit = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('modal-mentor-id').value;
  // a new mentor logs in with this phone, so it is required on create
  if (!NopaPersonFields.validate('modal-mentor', { requirePhone: !id })) return;
  // normalised (Latin digits, 09…); phoneNumber is undefined when an edit left it untouched
  const { name, phoneNumber, nationalId, dateOfBirth, city, gender } = NopaPersonFields.read('modal-mentor');
  const academicDegree = document.getElementById('modal-mentor-academic-degree').value.trim();
  const mentorLevel = parseInt(document.getElementById('modal-mentor-level').value) || 1;
  const accountStatus = document.getElementById('modal-mentor-status').value;
  const socialPlatform = document.getElementById('modal-mentor-social-platform').value;
  const socialMessengerHandle = document.getElementById('modal-mentor-social-handle').value.trim();

  // Read all selected caravan checkboxes (Can be empty [] for standalone mentors without caravans)
  const caravanCheckboxes = document.querySelectorAll('.mentor-caravan-checkbox:checked');
  const assignedCaravanIds = Array.from(caravanCheckboxes).map(cb => cb.value);

  const payload = {
    id: id || undefined,
    name,
    phoneNumber,
    nationalId,
    dateOfBirth,
    city,
    gender,
    academicDegree: academicDegree || null,
    mentorLevel,
    accountStatus,
    socialPlatform: socialPlatform || null,
    socialMessengerHandle: socialMessengerHandle || null,
    assignedCaravanIds: assignedCaravanIds, // Array of caravan IDs (empty array if no caravan chosen)
    caravanId: assignedCaravanIds.length > 0 ? assignedCaravanIds[0] : null
  };

  try {
    const res = await request('/api/v1/admin/mentors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const msg = assignedCaravanIds.length > 0 
        ? `راهبر «${name}» با موفقیت همراه با ${assignedCaravanIds.length} کاروان ثبت و ذخیره شد.`
        : `راهبر «${name}» با موفقیت به عنوان راهبر مستقل (بدون کاروان) ثبت و ذخیره شد.`;
      showToast(msg);
      document.getElementById('mentor-modal-overlay').style.display = 'none';
      await window.loadMentors();
    } else {
      const err = await res.json();
      showToast('خطا در ذخیره‌سازی: ' + (err.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save mentor error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

window.openMentorModerationModal = function(mentorId) {
  const m = window.mentorsMasterList.find(x => x.id === mentorId);
  document.getElementById('mod-mentor-id').value = mentorId;
  
  if (m) {
    document.getElementById('mod-mentor-subtitle').textContent = `راهبر: ${m.name || ''} (${m.phoneNumber || ''}) - وضعیت فعلی: ${m.accountStatus || 'ACTIVE'}`;
  }

  window.toggleTempSuspendDate(false);
  const modal = document.getElementById('mentor-moderation-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
  }
};

window.toggleTempSuspendDate = function(show) {
  const container = document.getElementById('mod-temp-date-container');
  if (container) container.style.display = show ? 'block' : 'none';
};

window.executeMentorModeration = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('mod-mentor-id').value;
  if (!id) return;

  const action = document.querySelector('input[name="mod_action"]:checked')?.value || 'activate';
  const suspendedUntil = document.getElementById('mod-suspended-until')?.value;

  try {
    const res = await request(`/api/v1/admin/mentors/${id}/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ action, suspendedUntil: suspendedUntil || undefined })
    });

    if (res.ok) {
      showToast('اقدام مدیریتی با موفقیت بر روی حساب کاربری راهبر اعمال شد.', 'success');
      document.getElementById('mentor-moderation-modal').style.display = 'none';
      await window.loadMentors();
    } else {
      const err = await res.json();
      showToast('خطا در اعمال اقدام: ' + (err.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Mentor moderation error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

// ===============================
// MODULE A (CONT.) : MENTOR DOCUMENTS QUEUE
// ===============================

let _mentorDocsCache = [];
let _currentMentorDocId = null;

window.loadMentorDocs = async function() {
  const tbody = document.querySelector('#mentor-docs-table tbody');
  try {
    const res = await request('/api/v1/admin/mentors/documents/pending');
    if (!res.ok) { console.error('Failed to load mentor docs'); return NopaTable.error(tbody, 'خطا در دریافت مدارک'); }
    const docs = await res.json();
    _mentorDocsCache = Array.isArray(docs) ? docs : [];
    if (!tbody) return;
    if (!_mentorDocsCache.length) return NopaTable.empty(tbody, 'مدرکی در انتظار بررسی نیست', 'fa-solid fa-circle-check');
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td>${esc(d.user?.name || 'نامعلوم')}</td>
        <td>${d.fileName ? `<a href="${esc(d.url || '/uploads/' + d.filePath)}" target="_blank">باز کردن</a>` : '-'}</td>
        <td>${esc(d.documentType || '-')}</td>
        <td>${new Date(d.createdAt).toLocaleString('fa-IR')}</td>
        <td>${d.status || 'pending'}</td>
        <td>
          <button title="مشاهده‌ی مدرک" aria-label="مشاهده‌ی مدرک" class="btn-icon" data-click="openMentorDocModal" data-click-args="${esc(JSON.stringify([String(d.id)]))}"><i class="fa-solid fa-eye"></i></button>
          <button title="تأیید مدرک" aria-label="تأیید مدرک" class="btn-icon u-c-green" data-click="quickApproveMentorDoc" data-click-args="${esc(JSON.stringify([String(d.id)]))}"><i class="fa-solid fa-check"></i></button>
          <button title="رد مدرک" aria-label="رد مدرک" class="btn-icon u-c-red" data-click="openMentorDocModal" data-click-args="${esc(JSON.stringify([String(d.id), true]))}"><i class="fa-solid fa-ban"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error('Failed to load mentor docs', e);
    NopaTable.error(tbody, 'خطا در دریافت مدارک');
  }
}

window.openMentorDocModal = function(id, focusReject = false) {
  const doc = _mentorDocsCache.find(x => x.id === id);
  _currentMentorDocId = id;
  const preview = document.getElementById('mentor-doc-preview');
  if(!doc) {
    preview.innerHTML = '<div>مدرک یافت نشد</div>';
  } else {
    let html = `<div class="u-flex u-gap-12 u-items-center">
      <div class="u-flex-1">
        <strong>مربی: </strong>${esc(doc.user?.name || '-')}<br>
        <strong>نوع: </strong>${esc(doc.documentType || '-')}<br>
        <strong>فایل: </strong>${esc(doc.fileName || '-')}
      </div>
      <div class="u-flex-1 u-text-left">
        <a href="${esc(doc.url || ('/uploads/' + doc.filePath))}" target="_blank" class="btn-action">باز کردن در پنجره جدید</a>
      </div>
    </div>`;
    // If image show inline preview
    if(doc.mimeType && doc.mimeType.startsWith('image')) {
      html += `<div class="u-mt-10"><img src="${esc(doc.url || ('/uploads/' + doc.filePath))}" class="u-maxw-100p u-maxh-360"/></div>`;
    }
    preview.innerHTML = html;
  }
  document.getElementById('mentor-doc-admin-note').value = '';
  document.getElementById('mentor-doc-modal').style.display = 'flex';
  if(focusReject) document.getElementById('mentor-doc-admin-note').focus();
}

window.quickApproveMentorDoc = async function(id) {
  if(!(await NopaConfirm('آیا مطمئنید می‌خواهید این مدرک را بدون اضافه کردن یادداشت تایید کنید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/mentors/documents/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'تایید سریع توسط ادمین' })
    });
    if(res.ok) {
      showToast('مدرک تایید شد', 'success');
      loadMentorDocs();
    } else {
      const d = await res.json(); showToast(d.error || 'خطا در تایید', 'error');
    }
  } catch(e) { console.error(e); showToast('خطا', 'error'); }
}

document.getElementById('btn-close-mentor-doc-modal')?.addEventListener('click', () => {
  document.getElementById('mentor-doc-modal').style.display = 'none';
  _currentMentorDocId = null;
});

document.getElementById('btn-approve-mentor-doc')?.addEventListener('click', async () => {
  if(!_currentMentorDocId) return showToast('مدرکی انتخاب نشده', 'error');
  const note = document.getElementById('mentor-doc-admin-note').value || 'تایید شد';
  try {
    const res = await request(`/api/v1/admin/mentors/documents/${_currentMentorDocId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if(res.ok) {
      showToast('مدرک تایید شد', 'success');
      document.getElementById('mentor-doc-modal').style.display = 'none';
      loadMentorDocs();
    } else {
      const d = await res.json(); showToast(d.error || 'خطا', 'error');
    }
  } catch(e) { console.error(e); showToast('خطا', 'error'); }
});

document.getElementById('btn-reject-mentor-doc')?.addEventListener('click', async () => {
  if(!_currentMentorDocId) return showToast('مدرکی انتخاب نشده', 'error');
  const note = document.getElementById('mentor-doc-admin-note').value;
  if(!note || note.trim().length < 3) return showToast('لطفا علت رد را وارد کنید (حداقل ۳ کاراکتر)', 'error');
  try {
    const res = await request(`/api/v1/admin/mentors/documents/${_currentMentorDocId}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if(res.ok) {
      showToast('مدرک رد شد', 'info');
      document.getElementById('mentor-doc-modal').style.display = 'none';
      loadMentorDocs();
    } else {
      const d = await res.json(); showToast(d.error || 'خطا', 'error');
    }
  } catch(e) { console.error(e); showToast('خطا', 'error'); }
});

// Approve / reject a certificate from inside the mentor modal (buttons rendered by editMentor).
// Only the row is updated so unsaved edits in the mentor form are kept.
async function decideMentorCertInline(docId, decision) {
  let note = 'تایید شد';
  if (decision === 'reject') {
    note = prompt('علت رد مدرک را وارد کنید (حداقل ۳ کاراکتر):') || '';
    if (note.trim().length < 3) return;
  }
  try {
    const res = await request(`/api/v1/admin/mentors/documents/${encodeURIComponent(docId)}/${decision}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return showToast(d.error || 'خطا در ثبت وضعیت مدرک', 'error');
    }
    const row = Array.from(document.querySelectorAll('#modal-mentor-certs-tbody tr'))
      .find(tr => tr.innerHTML.includes(docId));
    if (row && row.cells.length >= 4) {
      row.cells[2].innerHTML = decision === 'approve'
        ? '<span class="badge u-bg-success u-c-white">تایید شده</span>'
        : '<span class="badge u-bg-danger u-c-white">رد شده</span>';
      row.cells[3].innerHTML = '';
    }
    showToast(decision === 'approve' ? 'مدرک تایید شد' : 'مدرک رد شد', 'success');
    if (typeof window.loadMentorDocs === 'function') window.loadMentorDocs();
  } catch (e) {
    console.error(e);
  }
}
window.inlineApproveCert = (docId) => decideMentorCertInline(docId, 'approve');
window.inlineRejectCert = (docId) => decideMentorCertInline(docId, 'reject');

// Hook refresh button
document.getElementById('btn-refresh-mentor-docs')?.addEventListener('click', loadMentorDocs);

// 3. Mentors Table Loader (#mentors-tbody)
window.loadMentorsData = async function() {
  if (typeof window.loadMentors === 'function') {
    await window.loadMentors();
  }
};

// "edit" button inside the mentor dossier: close the dossier, open the mentor form
window.editMentorFromDossier = function(mentorId) {
  const dossier = document.getElementById('mentor-dossier-modal');
  if (dossier) dossier.style.display = 'none';
  return window.editMentor(mentorId);
};
