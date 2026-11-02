// ==================== INSTRUCTORS MANAGEMENT (بانک و مدیریت اساتید) ====================

window.globalInstructorsList = [];

// Fetch instructors list from backend
window.fetchInstructorsList = async function() {
  try {
    const res = await request('/api/v1/instructors');

    if (res.ok) {
      const data = await res.json();
      window.globalInstructorsList = data.data || [];
      window.renderInstructorsTable();
      if (typeof window.refreshAllInstructorPickers === 'function') {
        window.refreshAllInstructorPickers();
      }
    } else {
      NopaTable.error(document.getElementById('instructors-table-tbody'), 'خطا در دریافت فهرست اساتید');
    }
  } catch (err) {
    console.error('Error fetching instructors:', err);
    NopaTable.error(document.getElementById('instructors-table-tbody'), 'خطا در دریافت فهرست اساتید');
  }
};

// Render instructors table in #instructors-tab
window.renderInstructorsTable = function(list = null) {
  const container = document.getElementById('instructors-table-tbody');
  const badge = document.getElementById('instructors-count-badge');
  const emptyState = document.getElementById('instructors-empty-state');
  const tableWrapper = document.getElementById('instructors-table-wrapper');

  const instructors = list || window.globalInstructorsList || [];

  if (badge) {
    badge.textContent = `${instructors.length} استاد ثبت‌شده`;
  }

  if (!container) return;

  if (instructors.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (tableWrapper) tableWrapper.style.display = 'block';

  let html = '';
  instructors.forEach((inst, index) => {
    const avatar = inst.avatarUrl 
      ? `<img src="${esc(inst.avatarUrl)}" alt="${esc(inst.name)}" class="u-w-40 u-h-40 u-r-50p u-fit-cover u-bd-2-solid-primary">`
      : `<div class="u-w-40 u-h-40 u-r-50p u-bg-grad-primary u-flex u-items-center u-justify-center u-c-white u-bold u-fs-md u-bd-2-solid-primary"><i class="fa-solid fa-chalkboard-user"></i></div>`;

    const degreeBadge = inst.degree 
      ? `<span class="badge u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-fs-2xs u-p-2-8 u-r-6">${esc(inst.degree)}</span>`
      : `<span class="u-c-text-faint u-fs-2xs">-</span>`;

    const phoneDisplay = inst.phoneNumber 
      ? `<span class="u-mono u-direction-ltr u-inline-block u-c-text-soft"><i class="fa-solid fa-phone u-fs-2xs u-c-primary-text"></i> ${esc(inst.phoneNumber)}</span>`
      : `<span class="u-c-text-faint u-fs-2xs">-</span>`;

    const nationalIdDisplay = inst.nationalId
      ? `<span class="u-mono u-c-text-soft"><i class="fa-solid fa-id-card u-fs-2xs u-c-primary-text"></i> ${esc(inst.nationalId)}</span>`
      : `<span class="u-c-text-faint u-fs-2xs">-</span>`;

    const classesDisplay = inst.classes
      ? `<div class="u-maxw-220 u-fs-xs u-c-text u-lh-1_4">${esc(inst.classes)}</div>`
      : `<span class="u-c-text-faint u-fs-2xs">تعریف‌نشده</span>`;

    const resumeDisplay = inst.resume
      ? `<div class="u-maxw-240 u-fs-xs u-c-text-muted u-lh-1_4 u-overflow-hidden u-clamp-2" title="${esc(inst.resume)}">${esc(inst.resume)}</div>`
      : `<span class="u-c-text-faint u-fs-2xs">-</span>`;

    html += `
      <tr class="u-bb-fg-6 u-tr-background-0_2s" data-hover="row">
        <td class="u-p-12 u-text-center u-c-text-muted u-fs-xs">${index + 1}</td>
        <td class="u-p-12">
          <div class="u-flex u-items-center u-gap-12">
            ${avatar}
            <div>
              <div class="u-bold u-c-text u-fs-base u-flex u-items-center u-gap-6">
                ${esc(inst.name)}
              </div>
              <div class="u-fs-2xs u-c-text-muted u-mt-2">
                ${degreeBadge}
              </div>
            </div>
          </div>
        </td>
        <td class="u-p-12 u-fs-xs">
          <div class="u-flex u-col u-gap-4">
            ${phoneDisplay}
            ${nationalIdDisplay}
          </div>
        </td>
        <td class="u-p-12">${classesDisplay}</td>
        <td class="u-p-12">${resumeDisplay}</td>
        <td class="u-p-12 u-text-center">
          <div class="u-flex u-gap-6 u-justify-center">
            <button type="button" class="btn-action u-p-6-10 u-fs-xs u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-r-6 u-pointer" data-click="openInstructorModal" data-click-args="${esc(JSON.stringify([String(inst.id)]))}" title="ویرایش مشخصات استاد">
              <i class="fa-solid fa-pen-to-square"></i> ویرایش
            </button>
            <button type="button" class="btn-action u-p-6-10 u-fs-xs u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-r-6 u-pointer" data-click="deleteInstructorRecord" data-click-args="${esc(JSON.stringify([String(inst.id)]))}" title="حذف استاد">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
};

// Search & filter instructors
window.filterInstructorsList = function() {
  const query = (document.getElementById('instructor-search-input')?.value || '').trim().toLowerCase();
  if (!query) {
    window.renderInstructorsTable(window.globalInstructorsList);
    return;
  }

  const filtered = window.globalInstructorsList.filter(inst => {
    return (
      (inst.name && inst.name.toLowerCase().includes(query)) ||
      (inst.phoneNumber && inst.phoneNumber.includes(query)) ||
      (inst.nationalId && inst.nationalId.includes(query)) ||
      (inst.degree && inst.degree.toLowerCase().includes(query)) ||
      (inst.classes && inst.classes.toLowerCase().includes(query)) ||
      (inst.resume && inst.resume.toLowerCase().includes(query)) ||
      (inst.description && inst.description.toLowerCase().includes(query))
    );
  });

  window.renderInstructorsTable(filtered);
};

// Open Instructor Create / Edit Modal
window.openInstructorModal = function(instructorId = null) {
  const modal = document.getElementById('instructor-form-modal');
  if (!modal) return;

  const form = document.getElementById('instructor-creator-form');
  if (form) form.reset();

  document.getElementById('inst-id').value = '';
  document.getElementById('inst-avatar-preview').src = '';
  document.getElementById('inst-avatar-preview-container').style.display = 'none';

  if (instructorId) {
    const inst = window.globalInstructorsList.find(i => i.id === instructorId);
    if (inst) {
      document.getElementById('instructor-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ویرایش اطلاعات استاد: ${esc(inst.name)}`;
      document.getElementById('inst-id').value = inst.id;
      document.getElementById('inst-name').value = inst.name || '';
      document.getElementById('inst-phone').value = inst.phoneNumber || '';
      document.getElementById('inst-national-id').value = inst.nationalId || '';
      document.getElementById('inst-degree').value = inst.degree || '';
      document.getElementById('inst-classes').value = inst.classes || '';
      document.getElementById('inst-avatar').value = inst.avatarUrl || '';
      document.getElementById('inst-resume').value = inst.resume || '';
      document.getElementById('inst-desc').value = inst.description || '';

      if (inst.avatarUrl) {
        document.getElementById('inst-avatar-preview').src = inst.avatarUrl;
        document.getElementById('inst-avatar-preview-container').style.display = 'block';
      }
    }
  } else {
    document.getElementById('instructor-modal-title').innerHTML = `<i class="fa-solid fa-user-plus"></i> ثبت استاد جدید در بانک اساتید`;
  }

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';
};

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
    description
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
      showToast('اطلاعات استاد با موفقیت در بانک اساتید ذخیره شد.', 'success');
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


  try {
    const res = await request(`/api/v1/admin/instructors/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
        
      }
    });

    if (res.ok) {
      showToast('استاد با موفقیت حذف شد.', 'success');
      await window.fetchInstructorsList();
    } else {
      const d = await res.json();
      showToast('خطا در حذف استاد: ' + (d.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Delete instructor error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
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
