// ==================== INSTRUCTORS MANAGEMENT (بانک و مدیریت اساتید) ====================

window.globalInstructorsList = [];

// Fetch instructors list from backend
window.fetchInstructorsList = async function() {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
    const res = await fetch('/api/v1/instructors', {
      headers: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    });

    if (res.ok) {
      const data = await res.json();
      window.globalInstructorsList = data.data || [];
      window.renderInstructorsTable();
      if (typeof window.refreshAllInstructorPickers === 'function') {
        window.refreshAllInstructorPickers();
      }
    }
  } catch (err) {
    console.error('Error fetching instructors:', err);
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
      ? `<img src="${inst.avatarUrl}" alt="${inst.name}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #38bdf8;">`
      : `<div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, #0284c7, #0369a1); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:15px; border:2px solid #38bdf8;"><i class="fa-solid fa-chalkboard-user"></i></div>`;

    const degreeBadge = inst.degree 
      ? `<span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:11px; padding:2px 8px; border-radius:6px;">${inst.degree}</span>`
      : `<span style="color:#64748b; font-size:11px;">-</span>`;

    const phoneDisplay = inst.phoneNumber 
      ? `<span style="font-family:monospace; direction:ltr; display:inline-block; color:#cbd5e1;"><i class="fa-solid fa-phone" style="font-size:10px; color:#38bdf8;"></i> ${inst.phoneNumber}</span>`
      : `<span style="color:#64748b; font-size:11px;">-</span>`;

    const nationalIdDisplay = inst.nationalId
      ? `<span style="font-family:monospace; color:#cbd5e1;"><i class="fa-solid fa-id-card" style="font-size:10px; color:#a78bfa;"></i> ${inst.nationalId}</span>`
      : `<span style="color:#64748b; font-size:11px;">-</span>`;

    const classesDisplay = inst.classes
      ? `<div style="max-width:220px; font-size:12px; color:#e2e8f0; line-height:1.4;">${inst.classes}</div>`
      : `<span style="color:#64748b; font-size:11px;">تعریف‌نشده</span>`;

    const resumeDisplay = inst.resume
      ? `<div style="max-width:240px; font-size:11.5px; color:#94a3b8; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${inst.resume}">${inst.resume}</div>`
      : `<span style="color:#64748b; font-size:11px;">-</span>`;

    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 12px; text-align:center; color:#94a3b8; font-size:12px;">${index + 1}</td>
        <td style="padding: 12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${avatar}
            <div>
              <div style="font-weight:bold; color:white; font-size:13.5px; display:flex; align-items:center; gap:6px;">
                ${inst.name}
              </div>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
                ${degreeBadge}
              </div>
            </div>
          </div>
        </td>
        <td style="padding: 12px; font-size:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${phoneDisplay}
            ${nationalIdDisplay}
          </div>
        </td>
        <td style="padding: 12px;">${classesDisplay}</td>
        <td style="padding: 12px;">${resumeDisplay}</td>
        <td style="padding: 12px; text-align:center;">
          <div style="display:flex; gap:6px; justify-content:center;">
            <button type="button" class="btn-action" onclick="window.openInstructorModal('${inst.id}')" style="padding:5px 10px; font-size:11.5px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:6px; cursor:pointer;" title="ویرایش مشخصات استاد">
              <i class="fa-solid fa-pen-to-square"></i> ویرایش
            </button>
            <button type="button" class="btn-action" onclick="window.deleteInstructorRecord('${inst.id}')" style="padding:5px 10px; font-size:11.5px; background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:6px; cursor:pointer;" title="حذف استاد">
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
      document.getElementById('instructor-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ویرایش اطلاعات استاد: ${inst.name}`;
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
  modal.style.zIndex = '999999';
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
    alert('نام استاد الزامی است.');
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

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';

  try {
    const url = id ? `/api/v1/admin/instructors/${id}` : '/api/v1/admin/instructors';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('✅ اطلاعات استاد با موفقیت در بانک اساتید ذخیره شد.');
      document.getElementById('instructor-form-modal').style.display = 'none';
      await window.fetchInstructorsList();

      // If opened from a specific category block in LMS modal, auto-select this new instructor
      if (window.lastTargetCategoryBlockId) {
        window.selectInstructorForBlock(window.lastTargetCategoryBlockId, name, true);
        window.lastTargetCategoryBlockId = null;
      }
    } else {
      const errData = await res.json();
      alert('خطا در ذخیره استاد: ' + (errData.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Save instructor error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
  }
};

// Delete Instructor
window.deleteInstructorRecord = async function(id) {
  const inst = window.globalInstructorsList.find(i => i.id === id);
  const instName = inst ? inst.name : 'این استاد';

  if (!confirm(`آیا از حذف «${instName}» از بانک اساتید اطمینان دارید؟`)) return;

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || '';

  try {
    const res = await fetch(`/api/v1/admin/instructors/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    });

    if (res.ok) {
      alert('✅ استاد با موفقیت حذف شد.');
      await window.fetchInstructorsList();
    } else {
      const d = await res.json();
      alert('خطا در حذف استاد: ' + (d.error || 'خطای سرور'));
    }
  } catch (err) {
    console.error('Delete instructor error:', err);
    alert('ارتباط با سرور برقرار نشد: ' + err.message);
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
    box.innerHTML = `<span style="color:#64748b; font-size:12px; user-select:none;">یک یا چند استاد را از بانک اساتید انتخاب کنید...</span>`;
    return;
  }

  let html = '';
  selectedNames.forEach(name => {
    html += `
      <span class="inst-selected-tag" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.45); color: #38bdf8; font-size: 11.5px; font-weight: bold; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
        <i class="fa-solid fa-user-check" style="font-size:10px;"></i>
        <span>${name}</span>
        <span class="inst-tag-remove-btn" onclick="window.removeInstructorFromBlock('${blockId}', '${name}', event)" style="cursor:pointer; color:#ef4444; font-size:13px; line-height:1; padding:0 2px;" title="حذف">&times;</span>
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
      <div style="padding:10px; text-align:center; color:#94a3b8; font-size:11.5px;">
        <div>هیچ استادی در بانک اساتید ثبت نشده است.</div>
        <button type="button" onclick="window.openInstructorModalQuick('${blockId}')" style="margin-top:6px; background:#0284c7; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
          <i class="fa-solid fa-plus"></i> ثبت اولین استاد
        </button>
      </div>
    `;
    return;
  }

  let html = `
    <div style="padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 11px; color: #94a3b8;"><i class="fa-solid fa-database" style="color:#38bdf8;"></i> اساتید ثبت‌شده در بانک:</span>
      <button type="button" onclick="window.openInstructorModalQuick('${blockId}')" style="background: none; border: none; color: #38bdf8; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 3px;">
        <i class="fa-solid fa-plus"></i> افزودن جدید
      </button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 4px;">
  `;

  instructors.forEach(inst => {
    const isChecked = selectedNames.has(inst.name);
    html += `
      <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s; background: ${isChecked ? 'rgba(56, 189, 248, 0.15)' : 'transparent'};" onmouseover="this.style.background='rgba(56, 189, 248, 0.12)'" onmouseout="this.style.background='${isChecked ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}'">
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.selectInstructorForBlock('${blockId}', '${inst.name}', this.checked)" style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7;">
          <div>
            <div style="font-size: 12.5px; font-weight: bold; color: white;">${inst.name}</div>
            <div style="font-size: 10.5px; color: #94a3b8;">${inst.degree || inst.classes || 'مدرس دوره'}</div>
          </div>
        </div>
        ${inst.avatarUrl ? `<img src="${inst.avatarUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">` : ''}
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
  document.querySelectorAll('.modal-category-card').forEach(card => {
    window.renderSelectedInstructorBadges(card.id);
  });
};

// Initial load of instructors data on script execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.fetchInstructorsList);
} else {
  window.fetchInstructorsList();
}
