// Media manager: stored files, upload, delete.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// 6. AUDIT LOGS
// 7. MEDIA & ASSETS
let _storedFiles = [];

function _fileKind(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'doc';
}

function _fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

async function loadMediaAssets() {
  try {
    const res = await request('/api/v1/admin/media/files');
    const data = await res.json();
    _storedFiles = data.files || [];
    const summary = document.getElementById('files-summary');
    if (summary) summary.textContent = _storedFiles.length + ' فایل - ' + _fmtSize(data.totalSize || 0);
    renderStoredFiles();
  } catch (err) {
    console.error('Failed to load stored files:', err);
  }
}

function renderStoredFiles() {
  const tbody = document.querySelector('#media-gallery-table tbody');
  if (!tbody) return;
  const q = (document.getElementById('files-search')?.value || '').trim().toLowerCase();
  const kind = document.getElementById('files-type-filter')?.value || '';
  const list = _storedFiles.filter(f =>
    (!q || f.path.toLowerCase().includes(q) || (f.title || '').toLowerCase().includes(q)) &&
    (!kind || _fileKind(f.mimeType) === kind));
  const all = document.getElementById('files-select-all');
  if (all) all.checked = false;
  tbody.innerHTML = '';
  if (list.length === 0) {
    NopaTable.empty(tbody, 'فایلی یافت نشد');
    return;
  }
  list.forEach(f => {
    const k = _fileKind(f.mimeType);
    const icon = k === 'video' ? 'fa-video' : k === 'image' ? 'fa-image' : k === 'audio' ? 'fa-music' : 'fa-file';
    const abs = window.location.origin + f.url;
    const preview = k === 'image'
      ? `<a href="${esc(f.url)}" target="_blank"><img src="${esc(f.url)}" loading="lazy" class="u-w-48 u-h-48 u-fit-cover u-r-8"></a>`
      : `<a href="${esc(f.url)}" target="_blank"><i class="fa-solid ${icon} u-fs-22 u-c-color-neon-blue"></i></a>`;
    const sub = (f.title || f.path !== f.name)
      ? `<div class="u-fs-10 u-c-text-secondary u-direction-ltr">${esc(f.path)}</div>` : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="file-check" data-path="${esc(f.path)}"></td>
      <td>${preview}</td>
      <td><strong class="u-wb-break-all">${esc(f.title || f.name)}</strong>${sub}</td>
      <td><span class="badge badge-student">${esc(f.mimeType)}</span></td>
      <td>${_fmtSize(f.size)}</td>
      <td><div class="u-flex u-items-center u-gap-8">
        <input type="text" readonly class="input-ctrl u-mono u-fs-11 u-p-4 u-h-26 u-direction-ltr" value="${esc(abs)}">
        <button class="page-btn file-copy u-p-4-8 u-fs-11 u-shrink-0" data-url="${esc(abs)}"><i class="fa-solid fa-copy"></i></button></div></td>
      <td class="u-fs-11 u-c-text-secondary">${new Date(f.modifiedAt).toLocaleString('fa-IR')}</td>
      <td><button class="page-btn file-del u-p-4-8 u-fs-11 u-c-danger-text" data-path="${esc(f.path)}"><i class="fa-solid fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
  });
}

async function deleteStoredFiles(paths) {
  if (!paths.length) return;
  if (!(await NopaConfirm('حذف ' + paths.length + ' فایل از سرور؟ این کار قابل بازگشت نیست و اگر فایل در جایی از اپ استفاده شده باشد، دیگر نمایش داده نمی‌شود.'))) return;
  try {
    const res = await request('/api/v1/admin/media/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    const data = await res.json();
    if (res.ok) {
      const failed = data.failed && data.failed.length;
      showToast(data.deleted + ' فایل حذف شد' + (failed ? ' (' + data.failed.length + ' مورد ناموفق)' : ''), failed ? 'error' : 'success');
    } else {
      showToast(data.error || 'خطا در حذف فایل', 'error');
    }
  } catch (err) {
    console.error(err);
  }
  loadMediaAssets();
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('.file-del, .file-copy, #btn-files-refresh, #btn-files-delete-selected');
  if (!t) return;
  if (t.classList.contains('file-del')) deleteStoredFiles([t.dataset.path]);
  else if (t.classList.contains('file-copy')) { navigator.clipboard.writeText(t.dataset.url); showToast('لینک کپی شد', 'success'); }
  else if (t.id === 'btn-files-refresh') loadMediaAssets();
  else if (t.id === 'btn-files-delete-selected') deleteStoredFiles([...document.querySelectorAll('.file-check:checked')].map(c => c.dataset.path));
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'files-search') renderStoredFiles();
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'files-type-filter') renderStoredFiles();
  else if (ev.target.id === 'files-select-all') document.querySelectorAll('.file-check').forEach(c => { c.checked = ev.target.checked; });
});

async function handleMediaUpload(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('media-file-input');
  if (fileInput.files.length === 0) return;
  
  const file = fileInput.files[0];
  const assetType = document.getElementById('media-asset-type').value;
  const title = document.getElementById('media-title').value;
  const instructor = document.getElementById('media-instructor').value;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assetType', assetType);
  if (title) formData.append('title', title);
  if (instructor) formData.append('instructor', instructor);
  
  const btn = document.getElementById('btn-upload-media');
  const progressText = document.getElementById('media-upload-progress');
  
  try {
    btn.disabled = true;
    progressText.style.display = 'block';
    
    const res = await request('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast('فایل با موفقیت آپلود شد!', 'success');
      fileInput.value = '';
      document.getElementById('media-title').value = '';
      document.getElementById('media-instructor').value = '';
      loadMediaAssets();
    } else {
      showToast(data.error || 'خطا در آپلود فایل', 'error');
    }
  } catch (err) {
    console.error('Upload Error:', err);
    showToast('خطا در ارتباط با سرور هنگام آپلود', 'error');
  } finally {
    btn.disabled = false;
    progressText.style.display = 'none';
  }
}
