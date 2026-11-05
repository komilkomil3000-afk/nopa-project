// LMS station access & lock control modal.
// Split out of the former lms.js (Phase 7).

// ==========================================
// STATION ACCESS & LOCK CONTROL MODAL LOGIC
// ==========================================
window.openStationAccessModal = function(stationId) {
  // Find station by id, orderIndex or identifier
  const station = window.lmsStationsMasterList.find(s => s.id === stationId || String(s.orderIndex) === String(stationId) || ('MZ' + s.orderIndex) === String(stationId));
  if (!station) {
    showToast('منزلگاه مورد نظر یافت نشد.', 'error');
    return;
  }

  const modal = document.getElementById('station-access-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['صفر', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const idx = station.orderIndex ?? 1;
  const stationTitleName = PERSIAN_NUMS[idx - 1] ? `منزلگاه ${PERSIAN_NUMS[idx - 1]}` : `منزلگاه ${idx}`;

  document.getElementById('sam-station-id').value = station.id;
  document.getElementById('sam-station-title').textContent = `تنظیمات دسترسی ${stationTitleName}: ${station.title || ''}`;
  document.getElementById('sam-station-subtitle').textContent = `کد: MZ${idx} | تنظیم قفل/فعال، زمان بازگشایی و شرط پیش‌نیاز`;

  // Status (active vs locked)
  const isTimeLocked = station.isTimeLocked || (station.scheduledUnlockTime && new Date() < new Date(station.scheduledUnlockTime));
  const isLocked = Boolean(station.isLocked || station.status === 'locked' || isTimeLocked);

  const activeRadio = document.getElementById('sam-status-active');
  const lockedRadio = document.getElementById('sam-status-locked');
  if (isLocked) {
    if (lockedRadio) lockedRadio.checked = true;
  } else {
    if (activeRadio) activeRadio.checked = true;
  }
  if (typeof window.handleSamStatusChange === 'function') window.handleSamStatusChange();

  // Caravan scope
  const scopeSelect = document.getElementById('sam-caravan-scope');
  const customBox = document.getElementById('sam-caravans-custom-box');
  let targetCaravans = [];
  try {
    if (station.targetCaravansJson) {
      targetCaravans = JSON.parse(station.targetCaravansJson);
      if (!Array.isArray(targetCaravans)) targetCaravans = [];
    }
  } catch (_) {}

  // Populate custom caravan list
  const caravans = window.caravansData || [];
  if (customBox) {
    if (caravans.length === 0) {
      customBox.innerHTML = '<div class="u-c-text-muted u-fs-xs u-p-6">کاروانی در حافظه بارگذاری نشده است.</div>';
    } else {
      customBox.innerHTML = caravans.map(c => `
        <label class="u-flex u-items-center u-gap-8 u-mb-6 u-fs-xs u-c-text-soft u-pointer">
          <input type="checkbox" class="sam-caravan-check u-accent-primary" value="${c.id}" ${targetCaravans.includes(c.id) ? 'checked' : ''}>
          <span>${esc(c.name)} (${esc(c.mentorName || c.mentor?.name || 'بدون راهبر')})</span>
        </label>
      `).join('');
    }
  }

  if (scopeSelect) {
    if (targetCaravans.length > 0) {
      scopeSelect.value = 'custom';
    } else {
      scopeSelect.value = 'all';
    }
  }
  if (typeof window.handleSamScopeChange === 'function') window.handleSamScopeChange();

  // Scheduled unlock
  const schedCheckbox = document.getElementById('sam-schedule-enable');
  const schedDate = document.getElementById('sam-schedule-date');
  const schedTime = document.getElementById('sam-schedule-time');

  if (station.scheduledUnlockTime) {
    try {
      const d = new Date(station.scheduledUnlockTime);
      if (schedCheckbox) schedCheckbox.checked = true;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      if (schedDate) schedDate.value = `${yyyy}-${mm}-${dd}`;
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      if (schedTime) schedTime.value = `${hh}:${min}`;
    } catch (_) {
      if (schedCheckbox) schedCheckbox.checked = false;
      if (schedDate) schedDate.value = '';
      if (schedTime) schedTime.value = '';
    }
  } else {
    if (schedCheckbox) schedCheckbox.checked = false;
    if (schedDate) schedDate.value = '';
    if (schedTime) schedTime.value = '';
  }
  if (typeof window.handleSamScheduleToggle === 'function') window.handleSamScheduleToggle();

  // Conditional unlock on previous station
  const condCheckbox = document.getElementById('sam-condition-enable');
  const condDesc = document.getElementById('sam-condition-desc');
  if (condCheckbox && condDesc) {
    if (idx <= 1) {
      condCheckbox.checked = false;
      condCheckbox.disabled = true;
      condDesc.innerHTML = `<span class="u-c-accent-text"><i class="fa-solid fa-circle-info"></i> این منزلگاه، منزلگاه اول (نقطه آغاز مسابقه) است و نیازی به پیش‌نیاز قبلی ندارد.</span>`;
    } else {
      condCheckbox.disabled = false;
      condCheckbox.checked = Boolean(station.requirePreviousComplete);
      const prevStationName = PERSIAN_NUMS[idx - 2] ? `منزلگاه ${PERSIAN_NUMS[idx - 2]}` : `منزلگاه ${idx - 1}`;
      condDesc.innerHTML = `در صورت فعال بودن، کاروان‌ها و اعضا تنها در صورتی مجاز به ورود و شروع این منزلگاه خواهند بود که تمام مراحل و جلسات <strong>«${prevStationName}»</strong> را به اتمام رسانده باشند.`;
    }
  }

  modal.style.display = 'flex';
};

window.closeStationAccessModal = function() {
  const modal = document.getElementById('station-access-modal');
  if (modal) modal.style.display = 'none';
};

window.handleSamStatusChange = function() {
  const activeRadio = document.getElementById('sam-status-active');
  const activeLabel = document.getElementById('sam-status-active-label');
  const lockedLabel = document.getElementById('sam-status-locked-label');

  if (activeRadio && activeRadio.checked) {
    if (activeLabel) {
      activeLabel.style.border = '2px solid var(--success)';
      activeLabel.style.background = 'rgb(var(--success-rgb) / 0.14)';
    }
    if (lockedLabel) {
      lockedLabel.style.border = '1px solid rgb(var(--danger-rgb) / 0.3)';
      lockedLabel.style.background = 'rgb(var(--danger-rgb) / 0.05)';
    }
  } else {
    if (activeLabel) {
      activeLabel.style.border = '1px solid rgb(var(--success-rgb) / 0.3)';
      activeLabel.style.background = 'rgb(var(--success-rgb) / 0.05)';
    }
    if (lockedLabel) {
      lockedLabel.style.border = '2px solid var(--danger)';
      lockedLabel.style.background = 'rgb(var(--danger-rgb) / 0.14)';
    }
  }
};

window.handleSamScopeChange = function() {
  const scopeSelect = document.getElementById('sam-caravan-scope');
  const customBox = document.getElementById('sam-caravans-custom-box');
  if (customBox) {
    customBox.style.display = (scopeSelect && scopeSelect.value === 'custom') ? 'block' : 'none';
  }
};

window.handleSamScheduleToggle = function() {
  const schedCheckbox = document.getElementById('sam-schedule-enable');
  const inputsBox = document.getElementById('sam-schedule-inputs-box');
  const previewBox = document.getElementById('sam-schedule-status-preview');

  const isEnabled = Boolean(schedCheckbox && schedCheckbox.checked);
  if (inputsBox) inputsBox.style.display = isEnabled ? 'grid' : 'none';
  if (previewBox) previewBox.style.display = isEnabled ? 'block' : 'none';
  if (isEnabled && typeof window.updateSamSchedulePreview === 'function') {
    window.updateSamSchedulePreview();
  }
};

window.updateSamSchedulePreview = function() {
  const schedDate = document.getElementById('sam-schedule-date')?.value;
  const schedTime = document.getElementById('sam-schedule-time')?.value || '00:00';
  const previewBox = document.getElementById('sam-schedule-status-preview');
  if (!previewBox) return;

  if (!schedDate) {
    previewBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation u-c-accent-text"></i> لطفاً تاریخ بازگشایی را مشخص کنید.';
    return;
  }

  try {
    const target = new Date(`${schedDate}T${schedTime}`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      previewBox.innerHTML = `
        <div class="u-bold"><i class="fa-solid fa-lock u-c-danger-text"></i> منزلگاه تا زمان بازگشایی به صورت خودکار قفل خواهد ماند.</div>
        <div class="u-fs-2xs u-c-text-soft u-mt-4">
          زمان مقرر: ${target.toLocaleDateString('fa-IR')} ساعت ${target.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
          (حدود ${diffDays > 0 ? diffDays + ' روز و ' : ''}${remainingHours} ساعت باقی‌مانده)
        </div>
      `;
    } else {
      previewBox.innerHTML = `
        <div class="u-bold u-c-success-text"><i class="fa-solid fa-lock-open"></i> تاریخ بازگشایی فرارسیده است (منزلگاه فعال و در دسترس).</div>
      `;
    }
  } catch (_) {
    previewBox.textContent = 'فرمت تاریخ و ساعت صحیح نیست.';
  }
};

window.saveStationAccessSettings = async function() {
  const stationId = document.getElementById('sam-station-id')?.value;
  if (!stationId) return;

  const btn = document.getElementById('btn-save-station-access');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> در حال ذخیره...';
  }

  try {
    const activeRadio = document.getElementById('sam-status-active');
    const isLocked = !activeRadio.checked;
    const status = isLocked ? 'locked' : 'active';

    // Scope
    const scopeSelect = document.getElementById('sam-caravan-scope')?.value;
    let targetCaravansJson = null;
    if (scopeSelect === 'custom') {
      const checkedBoxes = Array.from(document.querySelectorAll('.sam-caravan-check:checked')).map(cb => cb.value);
      targetCaravansJson = JSON.stringify(checkedBoxes);
    }

    // Schedule
    const schedCheckbox = document.getElementById('sam-schedule-enable');
    let scheduledUnlockTime = null;
    if (schedCheckbox && schedCheckbox.checked) {
      const sDate = document.getElementById('sam-schedule-date')?.value;
      const sTime = document.getElementById('sam-schedule-time')?.value || '00:00';
      if (sDate) {
        scheduledUnlockTime = new Date(`${sDate}T${sTime}`).toISOString();
      }
    }

    // Conditional unlock
    const condCheckbox = document.getElementById('sam-condition-enable');
    const requirePreviousComplete = Boolean(condCheckbox && condCheckbox.checked && !condCheckbox.disabled);

    const res = await request(`/api/v1/lms/stations/${stationId}/access`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({
        isLocked,
        status,
        scheduledUnlockTime,
        requirePreviousComplete,
        targetCaravansJson
      })
    });

    if (res.ok) {
      const old = (window.lmsStationsMasterList || []).find(s => String(s.id) === String(stationId));
      if (old) {
        // «لغو» within 10s puts the station's old status and access back (all five settings, as this form sends them)
        NopaUndo.afterEdit({
          message: 'تنظیمات وضعیت و دسترسی منزلگاه ذخیره شد.',
          url: `/api/v1/lms/stations/${stationId}/access`,
          revert: {
            isLocked: !!old.isLocked,
            status: old.status || (old.isLocked ? 'locked' : 'active'),
            scheduledUnlockTime: old.scheduledUnlockTime || null,
            requirePreviousComplete: !!old.requirePreviousComplete,
            targetCaravansJson: old.targetCaravansJson ?? null,
          },
          done: () => (typeof window.fetchLiveLmsStations === 'function' ? window.fetchLiveLmsStations() : null),
        });
      } else {
        showToast('تنظیمات وضعیت و دسترسی منزلگاه با موفقیت ذخیره شد.', 'success');
      }
      window.closeStationAccessModal();
      if (typeof window.fetchLiveLmsStations === 'function') {
        await window.fetchLiveLmsStations();
      }
    } else {
      const err = await res.json();
      showToast('خطا در ذخیره تنظیمات: ' + (err.error || err.message || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('saveStationAccessSettings error:', err);
    showToast('خطا در برقراری ارتباط با سرور: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};
