async function initCaravanWorkspace(targetCaravanId = null) {
  const container = document.getElementById('dynamic-caravan-workspace-container');
  if (!container) return;

  const toPersian = (val) => (typeof window.toPersianDigits === 'function' ? window.toPersianDigits(val) : val);

  // 1. Fetch live data with loading placeholder
  container.innerHTML = `
    <div class="glass" style="padding: 32px; text-align: center; color: var(--text-secondary);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-accent); margin-bottom: 12px; display: block;"></i>
      <span>در حال بارگذاری اطلاعات کاروان و اعضا...</span>
    </div>
  `;

  try {
    const [caravansRes, usersRes] = await Promise.all([
      fetch('/api/v1/caravans').then(r => r.json()),
      fetch('/api/v1/admin/users').then(r => r.json())
    ]);
    const caravans = caravansRes.data || caravansRes || [];
    const users = usersRes.data || usersRes || [];

    if (caravans.length === 0) {
      container.innerHTML = '<div class="glass" style="padding: 24px; text-align: center; color: var(--text-secondary);">هیچ کاروانی تعریف نشده است.</div>';
      return;
    }

    // Selected Caravan
    const activeCaravan = targetCaravanId 
      ? (caravans.find(c => String(c.id) === String(targetCaravanId) || c.title === targetCaravanId) || caravans[0])
      : caravans[0];

    // Filter members & mentor
    const members = users.filter(u => 
      u.role !== 'admin' && 
      u.role !== 'mentor' && 
      (String(u.caravanId) === String(activeCaravan.id) || u.caravan === activeCaravan.title)
    );
    const mentorUser = users.find(u => 
      (u.role === 'mentor' || u.role === 'راهبر') && 
      (String(u.caravanId) === String(activeCaravan.id) || u.caravan === activeCaravan.title)
    );
    const mentorName = mentorUser ? mentorUser.name : (activeCaravan.mentor || 'تعیین نشده');
    const totalZarik = members.reduce((sum, m) => sum + (Number(m.zarikBalance) || 0), 0);

    // 2. Render Full UI using semantic glassmorphic styles
    container.innerHTML = `
      <div class="glass" style="padding: 24px; direction: rtl; color: var(--text-primary);">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0;">
            <span style="width: 8px; height: 22px; background: var(--color-accent); border-radius: 4px; display: inline-block;"></span>
            مدیریت و جزئیات کاروان
          </h3>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="font-size: 13px; color: var(--text-secondary);">انتخاب کاروان:</label>
            <select id="standalone-caravan-select" onchange="window.initCaravanWorkspace(this.value)" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 10px; padding: 8px 14px; font-size: 13px; outline: none; cursor: pointer;">
              ${caravans.map(c => `
                <option value="${c.id}" ${String(c.id) === String(activeCaravan.id) ? 'selected' : ''}>${c.title || c.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Stats Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="glass" style="padding: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">راهبر اختصاصی</div>
            <div style="font-size: 16px; font-weight: 700; color: #38bdf8;">${mentorName}</div>
          </div>
          <div class="glass" style="padding: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">مجموع ثروت کاروان (زریک)</div>
            <div style="font-size: 17px; font-weight: 700; color: #fbbf24;">${toPersian(totalZarik)} 🟡</div>
          </div>
          <div class="glass" style="padding: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">تعداد اعضای فعال</div>
            <div style="font-size: 17px; font-weight: 700; color: #34d399;">${toPersian(members.length)} نفر</div>
          </div>
        </div>

        <!-- Roster Table -->
        <div style="overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-color);">
          <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 13px;">
            <thead>
              <tr style="background: rgba(255,255,255,0.04); color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">
                <th style="padding: 12px 16px; font-weight: 600;">شناسه</th>
                <th style="padding: 12px 16px; font-weight: 600;">نام عضو</th>
                <th style="padding: 12px 16px; font-weight: 600;">شماره تماس</th>
                <th style="padding: 12px 16px; font-weight: 600;">موجودی زریک</th>
                <th style="padding: 12px 16px; font-weight: 600; text-align: center;">عملیات</th>
              </tr>
            </thead>
            <tbody>
              ${members.length === 0 
                ? '<tr><td colspan="5" style="text-align: center; padding: 28px; color: var(--text-secondary);">عضوی در این کاروان یافت نشد.</td></tr>' 
                : members.map(m => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.03)'" onmouseleave="this.style.background='transparent'">
                    <td style="padding: 12px 16px; color: var(--text-secondary); font-size: 12px;">${toPersian(m.customId || m.id)}</td>
                    <td style="padding: 12px 16px; font-weight: 600; color: var(--text-primary);">${m.name}</td>
                    <td style="padding: 12px 16px; color: var(--text-secondary);">${toPersian(m.phoneNumber || m.phone || '-')}</td>
                    <td style="padding: 12px 16px; color: #fbbf24; font-weight: 700;">${toPersian(m.zarikBalance || 0)} 🟡</td>
                    <td style="padding: 12px 16px; text-align: center;">
                      <div style="display: inline-flex; gap: 8px;">
                        <button onclick="window.editMemberZarikPrompt('${m.id}', ${m.zarikBalance || 0})" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: all 0.2s;">
                          تغییر زریک
                        </button>
                        <button onclick="window.removeUserFromCaravanAction('${m.id}')" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: all 0.2s;">
                          حذف از کاروان
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Caravan workspace error:', err);
    container.innerHTML = `
      <div class="glass" style="padding: 24px; text-align: center; color: var(--color-danger);">
        خطا در دریافت اطلاعات کاروان. لطفاً اتصال اینترنت یا سرور را بررسی فرمایید.
      </div>
    `;
  }
}

window.initCaravanWorkspace = initCaravanWorkspace;

window.editMemberZarikPrompt = async function(userId, currentZarik) {
  let modal = document.getElementById('zarik-edit-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'zarik-edit-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.zIndex = '999999';
  modal.innerHTML = `
    <div class="modal-content glass" style="max-width: 380px; padding: 24px; direction: rtl; text-align: right;">
      <h3 style="color: #fbbf24; margin-bottom: 12px; font-size: 16px;">
        <i class="fa-solid fa-coins"></i> تغییر موجودی زریک عضو
      </h3>
      <p style="color: var(--text-secondary); font-size: 12.5px; margin-bottom: 14px;">
        موجودی جدید زریک را وارد نمایید:
      </p>
      <input type="number" id="zarik-edit-input" value="${currentZarik}" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 8px; color: #fff; font-size: 14px; margin-bottom: 18px;" />
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="zarik-edit-cancel" class="page-btn" style="background: rgba(255,255,255,0.1); color: #fff; padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">انصراف</button>
        <button id="zarik-edit-submit" class="page-btn" style="background: #d97706; color: #fff; padding: 8px 20px; border-radius: 8px; border: none; font-weight: bold;">ذخیره موجودی</button>
      </div>
    </div>
  `;

  const input = document.getElementById('zarik-edit-input');
  const close = () => modal.classList.remove('active');
  document.getElementById('zarik-edit-cancel').onclick = close;

  document.getElementById('zarik-edit-submit').onclick = async () => {
    const val = input.value.trim();
    if (val === '' || isNaN(Number(val))) {
      if (typeof window.showToastError === 'function') {
        window.showToastError('لطفاً یک عدد معتبر وارد نمایید');
      }
      return;
    }
    close();
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
      const res = await fetch('/api/v1/admin/users/' + userId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ zarikBalance: Number(val) })
      });
      if (res.ok) {
        if (typeof window.showToastSuccess === 'function') {
          window.showToastSuccess('✅ موجودی زریک عضو با موفقیت به‌روزرسانی شد');
        }
        const currentSel = document.getElementById('standalone-caravan-select');
        window.initCaravanWorkspace(currentSel ? currentSel.value : null);
      } else {
        const d = await res.json();
        if (typeof window.showToastError === 'function') {
          window.showToastError(d.error || 'خطا در ثبت موجودی');
        }
      }
    } catch (e) {
      if (typeof window.showToastError === 'function') {
        window.showToastError('خطا در برقراری ارتباط با سرور');
      }
    }
  };
};

window.removeUserFromCaravanAction = async function(userId) {
  const confirmed = typeof window.showConfirmDialog === 'function'
    ? await window.showConfirmDialog({
        title: 'حذف عضو از کاروان',
        message: 'آیا از حذف این عضو از کاروان اطمینان دارید؟',
        isDanger: true
      })
    : confirm('آیا از حذف این عضو از کاروان اطمینان دارید؟');
  if (!confirmed) return;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('nopa_admin_token') || '';
    const res = await fetch('/api/v1/admin/users/' + userId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ caravanId: null, caravan: null })
    });
    if (res.ok) {
      if (typeof window.showToastSuccess === 'function') {
        window.showToastSuccess('✅ کاربر از کاروان خارج گردید');
      }
      const currentSel = document.getElementById('standalone-caravan-select');
      window.initCaravanWorkspace(currentSel ? currentSel.value : null);
    } else {
      const d = await res.json();
      if (typeof window.showToastError === 'function') {
        window.showToastError(d.error || 'خطا در حذف از کاروان');
      }
    }
  } catch (e) {
    if (typeof window.showToastError === 'function') {
      window.showToastError('خطا در برقراری ارتباط با سرور');
    }
  }
};

// Auto-mount on load
document.addEventListener('DOMContentLoaded', () => {
  window.initCaravanWorkspace();
});
