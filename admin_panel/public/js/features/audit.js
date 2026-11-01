// Audit logs tab.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// Audit logs: role buttons pass a role ('all' clears the filter); the tab itself calls it with no args
window.loadAuditLogs = async function(role = null) {
  try {
    if(role) {
      const activeRoleInput = document.getElementById('audit-active-role');
      if (activeRoleInput) activeRoleInput.value = role === 'all' ? '' : role;
    }
    const activeRole = document.getElementById('audit-active-role')?.value || '';
    const action = document.getElementById('audit-action-filter')?.value || '';
    const search = document.getElementById('audit-search')?.value || '';
    
    let url = `/api/v1/admin/audit/logs?actorRole=${encodeURIComponent(activeRole)}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await request(url);
    const data = await res.json();
    const tbody = document.querySelector('#audit-logs-table tbody');
    if (!tbody) return;
    
    // Fallback if data is array or object with logs array
    const logs = data.logs || data || [];
    
    NopaTable.render(tbody, logs, l => `
      <tr>
        <td><span style="font-size:0.8rem">${new Date(l.createdAt).toLocaleString('fa-IR')}</span></td>
        <td>${esc(l.actorName)}</td>
        <td><span class="badge badge-mentor">${esc(l.actorRole || '')}</span></td>
        <td>${esc(l.action)}</td>
        <td>${esc(l.targetEntity)}</td>
        <td><span style="font-size:0.8rem">${esc(l.details)}</span></td>
        <td>${esc(l.ipAddress || '-')}</td>
      </tr>
    `, { empty: 'رویدادی با این فیلترها ثبت نشده است', emptyIcon: 'fa-solid fa-clock-rotate-left' });
  } catch(e) {
    console.error(e);
  }
}

document.getElementById('audit-filter-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  loadAuditLogs();
});
