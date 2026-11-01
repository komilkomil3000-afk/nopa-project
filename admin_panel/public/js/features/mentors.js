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

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--primary-text);"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری لیست راهبران و اساتید...</td></tr>';

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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger-text);"><i class="fa-solid fa-triangle-exclamation"></i> خطا در بارگذاری اطلاعات: ${esc(err.message)}</td></tr>`;
  }
};

window.filterMentorsList = function() {
  const tbody = document.getElementById('mentors-table-body') || document.querySelector('#mentors-table tbody');
  if (!tbody) return;

  if (!window.mentorsMasterList || window.mentorsMasterList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">هیچ راهبری در سیستم ثبت نشده است.</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-filter-circle-xmark" style="font-size:24px; color:var(--text-faint); margin-bottom:8px; display:block;"></i> هیچ راهبری با معیارهای فیلتر و جستجوی انتخاب‌شده مطابقت ندارد.</td></tr>';
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
      ? caravans.map(c => `<span class="badge" style="background:rgb(var(--primary-rgb) / 0.2); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.4); padding:3px 8px; border-radius:6px; font-size:11px; margin:2px; display:inline-block;"><i class="fa-solid fa-people-group"></i> ${esc(c.name)}</span>`).join(' ')
      : '<span style="color:var(--text-faint); font-size:12px;">فاقد کاروان</span>';

    // Status indicator
    const isSuspended = m.accountStatus === 'SUSPENDED' || m.blocked || m.isDeleted;
    const statusDot = isSuspended ? '<span title="مسدود / غیرفعال" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--danger);"></span>' : '<span title="فعال" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--success);"></span>';

    // National ID (only real data)
    const nationalIdText = (m.nationalId && m.nationalId !== 'null' && m.nationalId.trim() && !m.nationalId.startsWith('۱۲۳۴۵۶') && !m.nationalId.startsWith('123456'))
      ? `<span style="font-family:monospace; color:var(--text-soft);">${esc(m.nationalId)}</span>`
      : '<span style="color:var(--text-faint); font-size:11px;">وارد نشده است</span>';

    return `
      <tr style="transition:all 0.2s ease;">
        <td style="text-align:center;">
          <div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg, var(--primary), var(--primary)); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:13px; margin:0 auto; box-shadow:0 2px 6px rgb(var(--shade-rgb) / 0.3);">
            ${avatarInitials}
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            ${statusDot}
            <strong style="color:var(--text); font-size:13.5px;">${esc(m.name || 'راهبر بدون نام')}</strong>
          </div>
          ${m.role === 'SUPER_MENTOR' ? '<span style="font-size:10px; color:var(--accent-text); background:rgb(var(--accent-rgb) / 0.15); padding:1px 6px; border-radius:4px;">سرراهبر</span>' : ''}
        </td>
        <td style="font-family:monospace; direction:ltr; text-align:right; color:var(--text-soft);">${esc(m.phoneNumber || '-')}</td>
        <td style="text-align:center;">${nationalIdText}</td>
        <td>${caravansHtml}</td>
        <td style="text-align:center; white-space:nowrap;">
          <div style="display:inline-flex; gap:6px; align-items:center;">
            <button class="btn-action" onclick="window.viewMentorDossier('${m.id}')" style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.35); border-radius:6px; padding:5px 9px; font-size:11.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:4px;" title="نمایش شناسنامه جامع">
              <i class="fa-solid fa-eye"></i> شناسنامه
            </button>
            <button class="btn-action" onclick="window.editMentor('${m.id}')" style="background:rgb(var(--success-rgb) / 0.15); color:var(--success-text); border:1px solid rgb(var(--success-rgb) / 0.35); border-radius:6px; padding:5px 9px; font-size:11.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:4px;" title="ویرایش اطلاعات">
              <i class="fa-solid fa-pen"></i> ویرایش
            </button>
            <button class="btn-action" onclick="window.openMentorModerationModal('${m.id}')" style="background:rgb(var(--danger-rgb) / 0.15); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.35); border-radius:6px; padding:5px 9px; font-size:11.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:4px;" title="مدیریت وضعیت و تعلیق">
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
  body.innerHTML = '<div style="text-align:center; padding:30px; color:var(--primary-text);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px;">در حال بارگذاری شناسنامه جامع راهبر...</div></div>';

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
    
    document.getElementById('dossier-mentor-name').innerHTML = `<i class="fa-solid fa-id-card" style="color:var(--primary-text);"></i> شناسنامه راهبر: ${esc(mentorName)}`;
    const cleanNatId = (dossier?.identity?.nationalId || mentor?.nationalId || '').trim();
    const natIdDisplay = (cleanNatId && cleanNatId !== 'null' && !cleanNatId.startsWith('۱۲۳۴۵۶') && !cleanNatId.startsWith('123456')) ? cleanNatId : 'وارد نشده است';
    document.getElementById('dossier-mentor-subtitle').textContent = `کد ملی: ${natIdDisplay} | موبایل: ${dossier?.identity?.phoneNumber || mentor?.phoneNumber || '-'}`;
    document.getElementById('dossier-avatar').textContent = initials;

    // Build rich dossier content with pure real ratings
    const caravans = dossier?.caravans || mentor?.mentoredCaravans || [];
    const students = dossier?.supervisedStudents || [];
    const starsInfo = window.calculateMentorStars(mentor?.ratingsReceived, mentor?.evaluationsReceived);
    const scoreTitle = starsInfo.score !== null ? `${starsInfo.score} <span style="font-size:12px; color:var(--text-muted);">/ ۵</span>` : `<span style="font-size:15px; color:var(--text-muted);">فاقد ارزیابی</span>`;
    const scoreSub = starsInfo.count > 0 ? `از میان ${starsInfo.count} ارزیابی ثبت‌شده` : `هنوز ارزیابی یا امتیازی برای این راهبر ثبت نشده است`;

    body.innerHTML = `
      <!-- TOP STATS CARDS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:18px;">
        <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--primary-rgb) / 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:var(--text-soft); margin-bottom:4px;"><i class="fa-solid fa-people-group" style="color:var(--primary-text);"></i> کاروان‌های تحت راهبری</div>
          <div style="font-size:22px; font-weight:bold; color:var(--primary-text);">${caravans.length} <span style="font-size:12px; color:var(--text-muted);">کاروان</span></div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">گروه‌های فعال آموزشی</div>
        </div>

        <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--success-rgb) / 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:var(--text-soft); margin-bottom:4px;"><i class="fa-solid fa-users" style="color:var(--success-text);"></i> دانش‌آموزان تحت نظارت</div>
          <div style="font-size:22px; font-weight:bold; color:var(--success-text);">${students.length} <span style="font-size:12px; color:var(--text-muted);">دانش‌آموز</span></div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">افراد تحت سرپرستی این راهبر</div>
        </div>

        <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--primary-rgb) / 0.3); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:11px; color:var(--text-soft); margin-bottom:4px;"><i class="fa-solid fa-shield-halved" style="color:var(--primary-text);"></i> وضعیت حساب کاربری</div>
          <div style="font-size:18px; font-weight:bold; color:var(--success-text); margin-top:4px;">${mentor?.accountStatus || 'ACTIVE'}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">دسترسی به پنل راهبر</div>
        </div>
      </div>

      <!-- PERSONAL & IDENTITY DOSSIER -->
      <div style="background:rgb(var(--surface-rgb) / 0.6); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:bold; color:var(--primary-text); font-size:13.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-user-check"></i> مشخصات هویتی و فردی راهبر
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:12.5px;">
          <div><strong style="color:var(--text-muted);">نام کامل:</strong> <span style="color:var(--text);">${esc(mentorName)}</span></div>
          <div><strong style="color:var(--text-muted);">شماره همراه:</strong> <span style="color:var(--text); font-family:monospace;">${esc(mentor?.phoneNumber || '-')}</span></div>
          <div><strong style="color:var(--text-muted);">کد ملی:</strong> <span style="color:var(--text); font-family:monospace;">${mentor?.nationalId && mentor?.nationalId !== 'null' && !mentor?.nationalId.startsWith('۱۲۳۴۵۶') && !mentor?.nationalId.startsWith('123456') ? esc(mentor.nationalId) : 'وارد نشده است'}</span></div>
          <div><strong style="color:var(--text-muted);">تاریخ تولد:</strong> <span style="color:var(--text);">${esc(mentor?.dateOfBirth || 'ثبت نشده')}</span></div>
          <div><strong style="color:var(--text-muted);">شهر محل سکونت:</strong> <span style="color:var(--text);">${esc(mentor?.city || 'ثبت نشده')}</span></div>
          <div><strong style="color:var(--text-muted);">پلتفرم پیام‌رسان:</strong> <span style="color:var(--text);">${esc(mentor?.socialPlatform || 'ثبت نشده')} (${esc(mentor?.socialMessengerHandle || '-')})</span></div>
          <div><strong style="color:var(--text-muted);">وضعیت احراز هویت:</strong> <span style="color:${mentor?.identityVerified ? 'var(--success-text)' : 'var(--accent)'};">${mentor?.identityVerified ? 'تایید شده' : 'در انتظار بررسی'}</span></div>
        </div>
      </div>

      <!-- CARAVANS LIST -->
      <div style="background:rgb(var(--surface-rgb) / 0.6); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:bold; color:var(--primary-text); font-size:13.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-caravan"></i> وضعیت کاروان‌های تحت نظارت
        </div>
        ${caravans.length > 0 ? `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
            ${caravans.map(c => `
              <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--fg-rgb) / 0.06); border-radius:10px; padding:12px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:var(--primary-text); margin-bottom:6px;">
                  <span>${esc(c.name)}</span>
                  <span style="font-size:11px; color:var(--text-soft);">${c.memberCount || 0} عضو</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">پیشرفت کلی کاروان: ${c.progress || 0}%</div>
                <div style="background:rgb(var(--shade-rgb) / 0.3); height:6px; border-radius:3px; overflow:hidden;">
                  <div style="background:linear-gradient(90deg, var(--primary), var(--success)); height:100%; width:${c.progress || 0}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div style="color:var(--text-muted); font-size:12px;">راهبر در حال حاضر به کاروانی منتسب نشده است.</div>'}
      </div>

      <!-- SUPERVISED STUDENTS SECTION (افراد تحت سرپرستی این راهبر) -->
      <div style="background:rgb(var(--surface-rgb) / 0.6); border:1px solid rgb(var(--primary-rgb) / 0.3); border-radius:14px; padding:18px; margin-bottom:16px; box-shadow: 0 4px 20px rgb(var(--shade-rgb) / 0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.08); padding-bottom:14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:38px; height:38px; border-radius:10px; background:rgb(var(--primary-rgb) / 0.15); border:1px solid rgb(var(--primary-rgb) / 0.3); display:flex; align-items:center; justify-content:center; color:var(--primary-text); font-size:17px;">
              <i class="fa-solid fa-users"></i>
            </div>
            <div>
              <div style="font-weight:bold; color:var(--primary-text); font-size:14.5px;">دانش‌آموزان تحت سرپرستی این راهبر</div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">فقط دانش‌آموزان کاروان‌های این راهبر به همراه تیکت‌ها و رفت‌وبرگشت چالش‌ها</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="background:rgb(var(--primary-rgb) / 0.12); border:1px solid rgb(var(--primary-rgb) / 0.3); color:var(--primary-text); padding:5px 12px; border-radius:20px; font-size:12px; font-weight:bold;">
              ${students.length} دانش‌آموز تحت نظارت
            </span>
            <input type="text" id="dossier-student-filter-input" placeholder="جستجو در نام، موبایل یا کاروان..." oninput="window.filterDossierStudents(this.value)" style="background:rgb(var(--shade-rgb) / 0.35); border:1px solid rgb(var(--fg-rgb) / 0.15); color:var(--text); padding:6px 12px; border-radius:8px; font-size:12px; outline:none; width:210px;">
          </div>
        </div>

        <div id="dossier-students-container">
          <!-- Populated by window.renderDossierStudents -->
        </div>
      </div>
    `;

    window.renderDossierStudents(students, mentorId);

    footerActions.innerHTML = `
      <button type="button" class="btn-primary" onclick="document.getElementById('mentor-dossier-modal').style.display = 'none'; window.editMentor('${mentorId}')" style="background:linear-gradient(135deg, var(--success), var(--success-strong)); color:white; border:none; padding:8px 18px; border-radius:8px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-pen"></i> ویرایش مشخصات این راهبر
      </button>
    `;
  } catch (err) {
    console.error('viewMentorDossier error:', err);
    body.innerHTML = `<div style="color:var(--danger-text); text-align:center; padding:20px;">خطا در دریافت اطلاعات پرونده: ${esc(err.message)}</div>`;
  }
};

window.renderDossierStudents = function(students, mentorId) {
  const container = document.getElementById('dossier-students-container');
  if (!container) return;

  if (!students || students.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:35px 20px; background:rgb(var(--shade-rgb) / 0.2); border-radius:12px; color:var(--text-muted); border:1px dashed rgb(var(--fg-rgb) / 0.08);">
        <i class="fa-solid fa-user-graduate fa-2x" style="color:var(--text-faint); margin-bottom:8px;"></i>
        <div style="font-size:13.5px; font-weight:bold; color:var(--text-soft);">هیچ دانش‌آموزی در کاروان‌های این راهبر یافت نشد</div>
        <div style="font-size:11.5px; margin-top:4px;">به محض انتساب دانش‌آموزان به کاروان‌های این راهبر، لیست آن‌ها به همراه سوابق تعاملی در این قسمت نمایش می‌یابد.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${students.map(s => {
        const initials = (s.name || 'دا').trim().split(' ').map(n => n[0]).join('').substring(0, 2);
        const openTicketsBadge = s.stats.openTickets > 0 ? 
          `<span style="background:rgb(var(--danger-rgb) / 0.2); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.4); padding:2px 7px; border-radius:6px; font-size:10.5px; font-weight:bold;">${s.stats.openTickets} تیکت باز</span>` : 
          `<span style="background:rgb(var(--success-rgb) / 0.15); color:var(--success-text); padding:2px 7px; border-radius:6px; font-size:10.5px;">تیکت بازی ندارد</span>`;
        
        const pendingSubmissionsBadge = s.stats.pendingSubmissions > 0 ?
          `<span style="background:rgb(var(--accent-rgb) / 0.2); color:var(--accent-text); border:1px solid rgb(var(--accent-rgb) / 0.4); padding:2px 7px; border-radius:6px; font-size:10.5px; font-weight:bold;">${s.stats.pendingSubmissions} در انتظار بررسی</span>` :
          `<span style="background:rgb(var(--success-rgb) / 0.15); color:var(--success-text); padding:2px 7px; border-radius:6px; font-size:10.5px;">تکالیف بررسی‌شده</span>`;

        return `
          <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; transition:all 0.2s;" onmouseover="this.style.borderColor = 'rgb(var(--primary-rgb) / 0.45)'" onmouseout="this.style.borderColor = 'rgb(var(--fg-rgb) / 0.08)'">
            <!-- Student Bio & Info -->
            <div style="display:flex; align-items:center; gap:12px; min-width:240px;">
              <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg, var(--success), var(--primary)); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:15px; color:white; border:2px solid rgb(var(--fg-rgb) / 0.2); flex-shrink:0;">
                ${initials}
              </div>
              <div>
                <div style="font-weight:bold; color:var(--text); font-size:14px; display:flex; align-items:center; gap:8px;">
                  <span>${esc(s.name)}</span>
                  <span style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.3); padding:1px 7px; border-radius:5px; font-size:11px; font-weight:normal;">
                    <i class="fa-solid fa-campground"></i> ${esc(s.caravanName)}
                  </span>
                </div>
                <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px; display:flex; gap:12px; font-family:monospace;">
                  <span>موبایل: ${esc(s.phoneNumber || '-')}</span>
                  <span>کد: ${s.userCode || '-'}</span>
                  <span style="color:var(--accent-text);">${s.zarikBalance || 0} زریک</span>
                </div>
              </div>
            </div>

            <!-- Stats Indicators -->
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <div style="background:rgb(var(--surface-rgb) / 0.7); border:1px solid rgb(var(--fg-rgb) / 0.06); border-radius:8px; padding:6px 10px; font-size:11.5px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-headset" style="color:var(--accent-text);"></i>
                <span style="color:var(--text-soft);">کل تیکت‌ها: ${s.stats.totalTickets}</span>
                ${openTicketsBadge}
              </div>

              <div style="background:rgb(var(--surface-rgb) / 0.7); border:1px solid rgb(var(--fg-rgb) / 0.06); border-radius:8px; padding:6px 10px; font-size:11.5px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-trophy" style="color:var(--primary-text);"></i>
                <span style="color:var(--text-soft);">ارسال‌ها: ${s.stats.totalSubmissions}</span>
                ${pendingSubmissionsBadge}
              </div>
            </div>

            <!-- Action Buttons for Tickets & Challenges -->
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <button type="button" onclick="window.openStudentTicketsModal('${mentorId}', '${s.id}')" style="background:linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), rgb(var(--accent-rgb) / 0.28)); border:1px solid rgb(var(--accent-rgb) / 0.5); color:var(--accent-text); padding:7px 14px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;" onmouseover="this.style.background = 'rgb(var(--accent-rgb) / 0.35)'" onmouseout="this.style.background = 'linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), rgb(var(--accent-rgb) / 0.28))'">
                <i class="fa-solid fa-comments"></i> مشاهده تیکت‌ها (${s.stats.totalTickets})
              </button>

              <button type="button" onclick="window.openStudentChallengesModal('${mentorId}', '${s.id}')" style="background:linear-gradient(135deg, rgb(var(--primary-rgb) / 0.18), rgb(var(--primary-rgb) / 0.28)); border:1px solid rgb(var(--primary-rgb) / 0.5); color:var(--primary-text); padding:7px 14px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;" onmouseover="this.style.background = 'rgb(var(--primary-rgb) / 0.35)'" onmouseout="this.style.background = 'linear-gradient(135deg, rgb(var(--primary-rgb) / 0.18), rgb(var(--primary-rgb) / 0.28))'">
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
  document.getElementById('student-tickets-title').innerHTML = `<i class="fa-solid fa-headset" style="color:var(--accent-text);"></i> تیکت‌ها و مکالمات: <span style="color:var(--text);">${esc(student.name)}</span> <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">(تحت سرپرستی: ${mentorName})</span>`;
  document.getElementById('student-tickets-subtitle').textContent = `کاروان: ${student.caravanName} | موبایل: ${student.phoneNumber || '-'} | کد دانش‌آموزی: ${student.userCode || '-'}`;

  const tickets = student.tickets || [];
  if (tickets.length === 0) {
    body.innerHTML = `
      <div style="text-align:center; padding:35px 20px; color:var(--text-muted); background:rgb(var(--shade-rgb) / 0.25); border-radius:12px; border:1px dashed rgb(var(--fg-rgb) / 0.1);">
        <i class="fa-solid fa-inbox fa-3x" style="color:var(--text-faint); margin-bottom:12px;"></i>
        <div style="font-size:14px; font-weight:bold; color:var(--text-soft);">هیچ تیکتی بین این دانش‌آموز و این راهبر رد و بدل نشده است</div>
        <div style="font-size:12px; margin-top:6px; color:var(--text-muted);">تیکت‌های مطرح‌شده توسط دانش‌آموز در کاروان و پاسخ‌های ارسالی راهبر، به صورت خودکار در این تاریخچه ثبت می‌شوند.</div>
      </div>
    `;
  } else {
    body.innerHTML = tickets.map(t => {
      let statusBadge = '';
      if (t.status === 'resolved') {
        statusBadge = '<span style="background:rgb(var(--success-rgb) / 0.15); color:var(--success-text); border:1px solid rgb(var(--success-rgb) / 0.3); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:bold;">حل‌شده</span>';
      } else if (t.status === 'answered') {
        statusBadge = '<span style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.3); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:bold;">پاسخ داده شده</span>';
      } else {
        statusBadge = '<span style="background:rgb(var(--danger-rgb) / 0.15); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.3); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:bold;">در انتظار پاسخ</span>';
      }

      const tDate = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fa-IR') : '';
      const replies = t.replies || [];

      return `
        <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:12px; padding:16px;">
          <!-- Ticket Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.06); padding-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:rgb(var(--accent-rgb) / 0.15); color:var(--accent-text); border:1px solid rgb(var(--accent-rgb) / 0.3); padding:2px 8px; border-radius:6px; font-size:11.5px; font-weight:bold;">
                ${esc(t.category || 'پشتیبانی')}
              </span>
              <span style="font-weight:bold; color:var(--text); font-size:13.5px;">${esc(t.subject || 'بدون موضوع')}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${tDate}</span>
              ${statusBadge}
            </div>
          </div>

          <!-- Initial Message from Student -->
          <div style="background:rgb(var(--surface-rgb) / 0.6); border-radius:10px; padding:12px; margin-bottom:12px; border-right:3px solid var(--primary);">
            <div style="font-size:11.5px; font-weight:bold; color:var(--primary-text); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-user-graduate"></i> پیام دانش‌آموز (${esc(student.name)}):
            </div>
            <div style="font-size:13px; color:var(--text); line-height:1.6;">${esc(t.subject || '')}</div>
            ${t.voiceUrl ? `<div style="margin-top:8px;"><audio controls src="${esc(t.voiceUrl)}" style="height:34px; width:100%; max-width:320px;"></audio></div>` : ''}
            ${t.attachmentUrl ? `<div style="margin-top:8px;"><a href="${esc(t.attachmentUrl)}" target="_blank" style="color:var(--primary-text); font-size:12px; text-decoration:none;"><i class="fa-solid fa-paperclip"></i> مشاهده فایل ضمیمه</a></div>` : ''}
          </div>

          <!-- Conversation Replies History -->
          ${replies.length > 0 ? `
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding-right:12px; border-right:2px dashed rgb(var(--fg-rgb) / 0.1);">
              ${replies.map(r => {
                const rDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : '';
                return `
                  <div style="background:rgb(var(--surface-rgb) / 0.8); border:1px solid rgb(var(--fg-rgb) / 0.06); border-radius:8px; padding:10px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11.5px;">
                      <span style="font-weight:bold; color:var(--success-text); display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-reply"></i> پاسخ راهبر (${esc(r.mentor?.name || mentorName)}):
                      </span>
                      <span style="color:var(--text-muted); font-family:monospace;">${rDate}</span>
                    </div>
                    <div style="font-size:12.5px; color:var(--text); line-height:1.6;">${esc(r.message)}</div>
                    ${r.voiceUrl ? `<div style="margin-top:6px;"><audio controls src="${esc(r.voiceUrl)}" style="height:30px; width:100%; max-width:300px;"></audio></div>` : ''}
                    ${r.attachmentUrl ? `<div style="margin-top:6px;"><a href="${esc(r.attachmentUrl)}" target="_blank" style="color:var(--primary-text); font-size:11.5px;"><i class="fa-solid fa-paperclip"></i> مشاهده فایل ضمیمه</a></div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div style="font-size:11.5px; color:var(--text-muted); margin-bottom:12px; padding:6px 0;">هنوز پاسخی به این تیکت ثبت نشده است.</div>'}

          <!-- Quick Reply & Action Form -->
          <div style="background:rgb(var(--surface-rgb) / 0.5); border:1px solid rgb(var(--fg-rgb) / 0.05); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; gap:8px;">
              <input type="text" id="ticket-reply-input-${t.id}" placeholder="ثبت پاسخ راهبر به دانش‌آموز..." style="flex:1; background:rgb(var(--shade-rgb) / 0.3); border:1px solid rgb(var(--fg-rgb) / 0.15); color:var(--text); padding:8px 12px; border-radius:8px; font-size:12.5px; outline:none;">
              <button type="button" onclick="window.sendTicketReply('${t.id}', '${mentorId}', '${studentId}')" style="background:linear-gradient(135deg, var(--accent), var(--accent-strong)); color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-paper-plane"></i> ارسال پاسخ
              </button>
              ${t.status !== 'resolved' ? `
                <button type="button" onclick="window.resolveStudentTicket('${t.id}', '${mentorId}', '${studentId}')" style="background:rgb(var(--success-rgb) / 0.15); border:1px solid rgb(var(--success-rgb) / 0.35); color:var(--success-text); padding:8px 12px; border-radius:8px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:5px;" title="تغییر وضعیت تیکت به حل‌شده">
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
  document.getElementById('student-challenges-title').innerHTML = `<i class="fa-solid fa-trophy" style="color:var(--primary-text);"></i> رفت و برگشت چالش‌ها و تکالیف: <span style="color:var(--text);">${esc(student.name)}</span> <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">(راهبر: ${mentorName})</span>`;
  document.getElementById('student-challenges-subtitle').textContent = `کاروان: ${student.caravanName} | تکالیف، فایل‌های ارسالی، نمرات و بازخوردهای اصلاحی راهبر`;

  const submissions = student.submissions || [];
  const quizSubs = student.quizSubmissions || [];

  if (submissions.length === 0 && quizSubs.length === 0) {
    body.innerHTML = `
      <div style="text-align:center; padding:35px 20px; color:var(--text-muted); background:rgb(var(--shade-rgb) / 0.25); border-radius:12px; border:1px dashed rgb(var(--fg-rgb) / 0.1);">
        <i class="fa-solid fa-file-circle-xmark fa-3x" style="color:var(--text-faint); margin-bottom:12px;"></i>
        <div style="font-size:14px; font-weight:bold; color:var(--text-soft);">هیچ ارسال چالشی از طرف این دانش‌آموز ثبت نشده است</div>
        <div style="font-size:12px; margin-top:6px; color:var(--text-muted);">به محض ارسال تکالیف یا آزمون‌های کاروان توسط دانش‌آموز، جهت بررسی و ثبت بازخورد در این قسمت قرار می‌گیرند.</div>
      </div>
    `;
  } else {
    body.innerHTML = submissions.map(sub => {
      let statusBadge = '';
      if (sub.status === 'approved' || sub.status === 'APPROVED') {
        statusBadge = '<span style="background:rgb(var(--success-rgb) / 0.15); color:var(--success-text); border:1px solid rgb(var(--success-rgb) / 0.3); padding:3px 10px; border-radius:6px; font-size:11.5px; font-weight:bold;">تایید شده</span>';
      } else if (sub.status === 'rejected' || sub.status === 'REJECTED') {
        statusBadge = '<span style="background:rgb(var(--danger-rgb) / 0.15); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.3); padding:3px 10px; border-radius:6px; font-size:11.5px; font-weight:bold;">نیاز به اصلاح / رد شده</span>';
      } else {
        statusBadge = '<span style="background:rgb(var(--accent-rgb) / 0.15); color:var(--accent-text); border:1px solid rgb(var(--accent-rgb) / 0.3); padding:3px 10px; border-radius:6px; font-size:11.5px; font-weight:bold;">در انتظار بررسی راهبر</span>';
      }

      const subDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('fa-IR') : '';
      const defaultScore = sub.score !== undefined && sub.score !== null ? sub.score : (sub.challenge?.rewardZarik || 200);

      return `
        <div style="background:rgb(var(--surface-2-rgb) / 0.7); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:12px; padding:16px;">
          <!-- Challenge Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.06); padding-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.3); padding:2px 8px; border-radius:6px; font-size:11.5px; font-weight:bold;">
                چالش کاروان
              </span>
              <span style="font-weight:bold; color:var(--text); font-size:14px;"><i class="fa-solid fa-award" style="color:var(--accent-text);"></i> ${esc(sub.challenge?.title || 'عنوان چالش')}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${subDate}</span>
              ${statusBadge}
            </div>
          </div>

          <!-- Student Submission Box -->
          <div style="background:rgb(var(--surface-rgb) / 0.6); border-radius:10px; padding:12px; margin-bottom:12px; border-right:3px solid var(--primary);">
            <div style="font-size:11.5px; font-weight:bold; color:var(--primary-text); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-user-pen"></i> پاسخ ارسالی دانش‌آموز (${esc(student.name)}):
            </div>
            <div style="font-size:13px; color:var(--text); line-height:1.7;">${esc(sub.answerText || 'فاقد متن ارسالی (فقط فایل ضمیمه)')}</div>
            ${sub.fileUrl ? `
              <div style="margin-top:8px;">
                <a href="${esc(sub.fileUrl)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:rgb(var(--primary-rgb) / 0.12); border:1px solid rgb(var(--primary-rgb) / 0.3); color:var(--primary-text); padding:5px 12px; border-radius:6px; font-size:12px; text-decoration:none;">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> مشاهده فایل / تصویر پیوست دانش‌آموز
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Mentor Feedback History (if any) -->
          ${sub.mentorFeedback ? `
            <div style="background:rgb(var(--success-rgb) / 0.08); border:1px solid rgb(var(--success-rgb) / 0.2); border-radius:10px; padding:12px; margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:12px;">
                <span style="font-weight:bold; color:var(--success-text); display:flex; align-items:center; gap:6px;">
                  <i class="fa-solid fa-comments"></i> بازخورد ثبت‌شده توسط راهبر:
                </span>
                <span style="background:rgb(var(--success-rgb) / 0.2); color:var(--success-text); padding:2px 8px; border-radius:6px; font-weight:bold; font-size:11px;">
                  امتیاز اعطایی: ${sub.score || 0} زریک
                </span>
              </div>
              <div style="font-size:12.5px; color:var(--text); line-height:1.6;">${esc(sub.mentorFeedback)}</div>
            </div>
          ` : ''}

          <!-- Mentor Review / Correction Form -->
          <div style="background:rgb(var(--surface-rgb) / 0.7); border:1px solid rgb(var(--primary-rgb) / 0.2); border-radius:10px; padding:12px;">
            <div style="font-size:12px; font-weight:bold; color:var(--primary-text); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-pen-to-square"></i> ثبت / بازنویسی نمره و بازخورد راهبر:
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) auto; gap:10px; align-items:center;">
              <select id="review-status-${sub.id}" style="background:var(--surface-2); border:1px solid rgb(var(--fg-rgb) / 0.2); color:var(--text); padding:7px 10px; border-radius:6px; font-size:12px;">
                <option value="approved" ${sub.status === 'approved' || sub.status === 'APPROVED' ? 'selected' : ''}>تایید تکلیف (قبول)</option>
                <option value="rejected" ${sub.status === 'rejected' || sub.status === 'REJECTED' ? 'selected' : ''}>رد تکلیف (نیاز به اصلاح)</option>
              </select>
              <input type="number" id="review-score-${sub.id}" placeholder="امتیاز زریک" value="${defaultScore}" style="background:var(--surface-2); border:1px solid rgb(var(--fg-rgb) / 0.2); color:var(--text); padding:7px 10px; border-radius:6px; font-size:12px;">
              <input type="text" id="review-feedback-${sub.id}" placeholder="متن بازخورد و راهنمایی راهبر..." value="${esc(sub.mentorFeedback || '')}" style="grid-column: span 2; background:var(--surface-2); border:1px solid rgb(var(--fg-rgb) / 0.2); color:var(--text); padding:7px 10px; border-radius:6px; font-size:12px;">
              <button type="button" onclick="window.submitSubmissionReview('${sub.id}', '${mentorId}', '${studentId}')" style="background:linear-gradient(135deg, var(--success), var(--success-strong)); color:white; border:none; padding:7px 16px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
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
  document.getElementById('modal-mentor-name').value = m.name || '';
  document.getElementById('modal-mentor-phone').value = m.phoneNumber || '';
  document.getElementById('modal-mentor-national-id').value = m.nationalId || '';
  document.getElementById('modal-mentor-dob').value = m.dateOfBirth || '';
  document.getElementById('modal-mentor-city').value = m.city || '';
  { const g = document.getElementById('modal-mentor-gender'); if (g) g.value = m.gender || ''; }
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
        let statusTag = doc.status === 'approved' ? '<span class="badge" style="background:var(--success);color:white;">تایید شده</span>' :
                        (doc.status === 'rejected' ? '<span class="badge" style="background:var(--danger);color:white;">رد شده</span>' : '<span class="badge" style="background:var(--accent);color:white;">در انتظار</span>');
        return `
          <tr>
            <td>${esc(doc.filename || 'مدرک پیوست')}</td>
            <td><a href="${esc(doc.url)}" target="_blank" style="color:var(--primary-text); text-decoration:underline;">مشاهده مدرک</a></td>
            <td>${statusTag}</td>
            <td>
              ${doc.status === 'pending' ? `
                <button type="button" class="btn-icon" style="color:var(--success-text); background:none; border:none; cursor:pointer;" onclick="window.inlineApproveCert('${doc.id}', '${m.id}')" title="تایید مدرک"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn-icon" style="color:var(--danger-text); background:none; border:none; cursor:pointer;" onclick="window.inlineRejectCert('${doc.id}', '${m.id}')" title="رد مدرک"><i class="fa-solid fa-times"></i></button>
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

  container.innerHTML = '<span style="font-size:11px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> در حال بارگذاری کاروان‌ها...</span>';
  
  try {
    const res = await request('/api/v1/admin/caravans');
    const caravans = res.ok ? await res.json() : [];
    window.cachedCaravansForMentorModal = Array.isArray(caravans) ? caravans : [];

    if (window.cachedCaravansForMentorModal.length === 0) {
      container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">هیچ کاروانی در سامانه ثبت نشده است.</span>';
      return;
    }

    container.innerHTML = window.cachedCaravansForMentorModal.map(c => `
      <label class="mentor-caravan-item-label" data-caravan-name="${(c.name || '').toLowerCase()}" style="display:flex; align-items:center; gap:8px; background:rgb(var(--surface-rgb) / 0.85); border:1px solid rgb(var(--fg-rgb) / 0.12); border-radius:8px; padding:8px 12px; color:var(--text); font-size:12.5px; cursor:pointer; transition:all 0.2s;">
        <input type="checkbox" class="mentor-caravan-checkbox" value="${c.id}" ${assignedIds.includes(c.id) ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
        <span style="font-weight:500;">${esc(c.name)}</span>
      </label>
    `).join('');
  } catch (e) {
    console.error('Error fetching caravans checklist:', e);
    container.innerHTML = '<span style="font-size:12px; color:var(--danger-text);">خطا در دریافت لیست کاروان‌ها</span>';
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
  const name = document.getElementById('modal-mentor-name').value.trim();
  const phoneNumber = document.getElementById('modal-mentor-phone').value.trim();
  const nationalId = document.getElementById('modal-mentor-national-id').value.trim();
  const dateOfBirth = document.getElementById('modal-mentor-dob').value.trim();
  const city = document.getElementById('modal-mentor-city').value.trim();
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
    nationalId: nationalId || null,
    dateOfBirth: dateOfBirth || null,
    city: city || null,
    gender: document.getElementById('modal-mentor-gender')?.value ?? '',
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
  try {
    const res = await request('/api/v1/admin/mentors/documents/pending');
    if(!res.ok) return console.error('Failed to load mentor docs');
    const docs = await res.json();
    _mentorDocsCache = docs;
    const tbody = document.querySelector('#mentor-docs-table tbody');
    if (!tbody) return;
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td>${esc(d.user?.name || 'نامعلوم')}</td>
        <td>${d.fileName ? `<a href="${esc(d.url || '/uploads/' + d.filePath)}" target="_blank">باز کردن</a>` : '-'}</td>
        <td>${esc(d.documentType || '-')}</td>
        <td>${new Date(d.createdAt).toLocaleString('fa-IR')}</td>
        <td>${d.status || 'pending'}</td>
        <td>
          <button class="btn-icon" onclick="openMentorDocModal('${d.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" style="color:green" onclick="quickApproveMentorDoc('${d.id}')"><i class="fa-solid fa-check"></i></button>
          <button class="btn-icon" style="color:red" onclick="openMentorDocModal('${d.id}', true)"><i class="fa-solid fa-ban"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    console.error('Failed to load mentor docs', e);
  }
}

window.openMentorDocModal = function(id, focusReject = false) {
  const doc = _mentorDocsCache.find(x => x.id === id);
  _currentMentorDocId = id;
  const preview = document.getElementById('mentor-doc-preview');
  if(!doc) {
    preview.innerHTML = '<div>مدرک یافت نشد</div>';
  } else {
    let html = `<div style="display:flex; gap:12px; align-items:center;">
      <div style="flex:1">
        <strong>مربی: </strong>${esc(doc.user?.name || '-')}<br>
        <strong>نوع: </strong>${esc(doc.documentType || '-')}<br>
        <strong>فایل: </strong>${esc(doc.fileName || '-')}
      </div>
      <div style="flex:1; text-align:left;">
        <a href="${esc(doc.url || ('/uploads/' + doc.filePath))}" target="_blank" class="btn-action">باز کردن در پنجره جدید</a>
      </div>
    </div>`;
    // If image show inline preview
    if(doc.mimeType && doc.mimeType.startsWith('image')) {
      html += `<div style="margin-top:10px;"><img src="${esc(doc.url || ('/uploads/' + doc.filePath))}" style="max-width:100%; max-height:360px;"/></div>`;
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
        ? '<span class="badge" style="background:var(--success);color:white;">تایید شده</span>'
        : '<span class="badge" style="background:var(--danger);color:white;">رد شده</span>';
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
