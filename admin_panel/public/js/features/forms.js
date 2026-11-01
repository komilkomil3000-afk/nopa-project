// Dynamic form builder.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// FORM BUILDER LOGIC
async function loadDynForms() {
  try {
    const res = await request('/api/v1/admin/forms');
    const forms = await res.json();
    const tbody = document.querySelector('#dyn-forms-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    forms.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(f.title)}</td>
        <td>${esc(f.placement)}</td>
        <td>${esc(f.targetAudience)}</td>
        <td>
           <button class="page-btn btn-danger" data-click="deleteDynForm" data-click-args="${esc(JSON.stringify([String(f.id)]))}"><i class="fa-solid fa-trash"></i> حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error(e); }
}

async function submitDynamicForm(e) {
  e.preventDefault();
  const id = document.getElementById('dyn-form-id').value;
  const title = document.getElementById('dyn-form-title').value;
  const purpose = document.getElementById('dyn-form-purpose').value;
  const placement = document.getElementById('dyn-form-placement').value;
  const targetAudience = document.getElementById('dyn-form-audience').value;
  
  try {
    const res = await request('/api/v1/admin/forms', {
      method: 'POST', body: JSON.stringify({ id, title, purpose, placement, targetAudience })
    });
    if(res.ok) { showToast('فرم با موفقیت ذخیره شد', 'success'); document.getElementById('dyn-form-builder').reset(); loadDynForms(); }
  } catch(e) { console.error(e); }
}

async function deleteDynForm(id) {
  if(!(await NopaConfirm('آیا از حذف این فرم مطمئن هستید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/forms/${id}`, { method: 'DELETE' });
    if(res.ok) loadDynForms();
  } catch(e) { console.error(e); }
}
