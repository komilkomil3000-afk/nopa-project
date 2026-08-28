const fs = require('fs');
let lines = fs.readFileSync('public/app.js', 'utf8').split('\n');
let start = lines.findIndex(l => l.includes('JARCHI NEWS MANAGEMENT'));
if(start !== -1) {
  lines.splice(start);
}

const replacement = `// ==================== BANNERS & NEWS MANAGEMENT ====================

document.querySelector('[data-tab="news-tab"]')?.addEventListener('click', () => {
  loadBannersTab();
  loadNewsTab();
});

async function loadBannersTab() {
  try {
    const res = await fetch(API_BASE_URL + '/admin/banners', {
      headers: { 'Authorization': \\\`Bearer \\\${localStorage.getItem('token')}\\\` }
    });
    if (!res.ok) return console.error('Failed to load banners');
    const banners = await res.json();
    window.bannersData = banners;
    const tbody = document.querySelector('#banners-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    banners.forEach(item => {
      const tr = document.createElement('tr');
      const img = item.imageUrl ? \\\`<img src="\\\${API_BASE_URL}\\\${item.imageUrl}" style="width:50px; border-radius:4px;">\\\` : 'بدون تصویر';
      tr.innerHTML = \\\`
        <td>\\\${img}</td>
        <td>\\\${item.title}</td>
        <td>\\\${item.position === 'home_slider' ? 'اسلایدر خانه' : 'بالای بازار'}</td>
        <td>\\\${item.orderIndex}</td>
        <td>\\\${item.isActive ? '<span class="badge badge-mentor">فعال</span>' : '<span class="badge badge-student">غیرفعال</span>'}</td>
        <td>
          <button class="btn-icon" onclick="editBanner('\\\${item.id}')" title="ویرایش"><i class="fa-solid fa-edit"></i></button>
          <button class="btn-icon" onclick="deleteBanner('\\\${item.id}')" title="حذف" style="color:var(--color-danger)"><i class="fa-solid fa-trash"></i></button>
        </td>
      \\\`;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading banners:', error);
  }
}

window.openBannerModal = function(banner = null) {
  document.getElementById('banner-form').reset();
  if (banner) {
    document.getElementById('banner-id').value = banner.id;
    document.getElementById('banner-title').value = banner.title;
    document.getElementById('banner-target').value = banner.targetRoute || '';
    document.getElementById('banner-position').value = banner.position;
    document.getElementById('banner-order').value = banner.orderIndex;
    document.getElementById('banner-active').checked = banner.isActive;
    document.getElementById('banner-modal-title').innerHTML = '<i class="fa-solid fa-edit" style="color: #f59e0b;"></i> ویرایش بنر';
  } else {
    document.getElementById('banner-id').value = '';
    document.getElementById('banner-active').checked = true;
    document.getElementById('banner-order').value = 0;
    document.getElementById('banner-modal-title').innerHTML = '<i class="fa-solid fa-image" style="color: #f59e0b;"></i> افزودن بنر جدید';
  }
  document.getElementById('banner-modal').style.display = 'flex';
}

window.closeBannerModal = function() {
  document.getElementById('banner-modal').style.display = 'none';
}

window.editBanner = async function(id) {
  if(window.bannersData) {
    const banner = window.bannersData.find(b => b.id === id);
    if (banner) openBannerModal(banner);
  }
}

window.deleteBanner = async function(id) {
  if (!confirm('آیا از حذف این بنر اطمینان دارید؟')) return;
  try {
    const res = await fetch(API_BASE_URL + \\\`/admin/banners/\\\${id}\\\`, { 
      method: 'DELETE',
      headers: { 'Authorization': \\\`Bearer \\\${localStorage.getItem('token')}\\\` }
    });
    if (res.ok) {
      loadBannersTab();
    } else {
      alert('خطا در حذف بنر');
    }
  } catch (error) {
    console.error('Error deleting banner:', error);
  }
}

window.submitBanner = async function(e) {
  e.preventDefault();
  const id = document.getElementById('banner-id').value;
  const formData = new FormData();
  formData.append('title', document.getElementById('banner-title').value);
  formData.append('targetRoute', document.getElementById('banner-target').value);
  formData.append('position', document.getElementById('banner-position').value);
  formData.append('orderIndex', document.getElementById('banner-order').value);
  formData.append('isActive', document.getElementById('banner-active').checked);
  
  const imageFile = document.getElementById('banner-image').files[0];
  if (imageFile) formData.append('image', imageFile);

  try {
    let requestUrl = API_BASE_URL + '/admin/banners';
    let method = 'POST';
    if (id) {
      requestUrl = API_BASE_URL + \\\`/admin/banners/\\\${id}\\\`;
      method = 'PUT';
    }
    
    const res = await fetch(requestUrl, {
      method: method,
      headers: { 'Authorization': \\\`Bearer \\\${localStorage.getItem('token')}\\\` },
      body: formData
    });
    
    if (res.ok) {
      closeBannerModal();
      loadBannersTab();
    } else {
      alert('خطا در ثبت بنر');
    }
  } catch (error) {
    console.error('Error submitting banner:', error);
  }
}

async function loadNewsTab() {
  try {
    const res = await fetch(API_BASE_URL + '/admin/news', {
      headers: { 'Authorization': \\\`Bearer \\\${localStorage.getItem('token')}\\\` }
    });
    if (!res.ok) return console.error('Failed to load news');
    const news = await res.json();
    window.newsData = news;
    const tbody = document.querySelector('#news-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    news.forEach(item => {
      const tr = document.createElement('tr');
      const date = new Date(item.createdAt).toLocaleString('fa-IR');
      const img = item.imageUrl ? \\\`<img src="\\\${API_BASE_URL}\\\${item.imageUrl}" style="width:50px; border-radius:4px;">\\\` : 'بدون تصویر';
      tr.innerHTML = \\\`
        <td>\\\${img}</td>
        <td>\\\${item.title}</td>
        <td>\\\${item.category || '-'}</td>
        <td>\\\${item.reporter || '-'}</td>
        <td>\\\${date}</td>
        <td>\\\${item.isPublished ? '<span class="badge badge-mentor">منتشر شده</span>' : '<span class="badge badge-student">پیش‌نویس</span>'}</td>
        <td>
          <button class="btn-icon" onclick="editNews('\\\${item.id}')" title="ویرایش"><i class="fa-solid fa-edit"></i></button>
          <button class="btn-icon" onclick="deleteNews('\\\${item.id}')" title="حذف" style="color:var(--color-danger)"><i class="fa-solid fa-trash"></i></button>
        </td>
      \\\`;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading news:', error);
  }
}

window.openNewsModal = function(news = null) {
  document.getElementById('news-form').reset();
  if (news) {
    document.getElementById('news-id').value = news.id;
    document.getElementById('news-title').value = news.title;
    document.getElementById('news-body').value = news.body;
    document.getElementById('news-category').value = news.category || '';
    document.getElementById('news-source').value = news.reporter || '';
    document.getElementById('news-published').checked = news.isPublished;
    document.getElementById('news-modal-title').innerHTML = '<i class="fa-solid fa-edit" style="color: #38bdf8;"></i> ویرایش خبر';
  } else {
    document.getElementById('news-id').value = '';
    document.getElementById('news-published').checked = true;
    document.getElementById('news-modal-title').innerHTML = '<i class="fa-solid fa-newspaper" style="color: #38bdf8;"></i> افزودن خبر جدید';
  }
  document.getElementById('news-modal').style.display = 'flex';
}

window.closeNewsModal = function() {
  document.getElementById('news-modal').style.display = 'none';
}

window.editNews = async function(id) {
  if(window.newsData) {
    const news = window.newsData.find(n => n.id === id);
    if (news) openNewsModal(news);
  }
}

window.deleteNews = async function(id) {
  if (!confirm('آیا از حذف این خبر اطمینان دارید؟')) return;
  try {
    const res = await fetch(API_BASE_URL + \\\`/admin/news/\\\${id}\\\`, { 
      method: 'DELETE',
      headers: { 'Authorization': \\\`Bearer \\\${localStorage.getItem('token')}\\\` }
    });
    if (res.ok) {
      loadNewsTab();
    } else {
      alert('خطا در حذف خبر');
    }
  } catch (error) {
    console.error('Error deleting news:', error);
  }
}

window.submitNews = async function(e) {
  e.preventDefault();
  const id = document.getElementById('news-id').value;
  const formData = new FormData();
  formData.append('title', document.getElementById('news-title').value);
  formData.append('body', document.getElementById('news-body').value);
  formData.append('category', document.getElementById('news-category').value);
  formData.append('reporter', document.getElementById('news-source').value);
  formData.append('isPublished', document.getElementById('news-published').checked);

  const imageFile = document.getElementById('news-image').files[0];
  if (imageFile) formData.append('image', imageFile);

  try {
    let requestUrl = API_BASE_URL + '/admin/news';
    let method = 'POST';
    if (id) {
      requestUrl = API_BASE_URL + \\\`/admin/news/\\\${id}\\\`;
      method = 'PUT';
    }
    
    const res = await fetch(requestUrl, {
      method: method,
      headers: { 'Authorization': \\\`Bearer \\\${localStorage.getItem('token')}\\\` },
      body: formData
    });
    
    if (res.ok) {
      closeNewsModal();
      loadNewsTab();
    } else {
      alert('خطا در ثبت خبر');
    }
  } catch (error) {
    console.error('Error submitting news:', error);
  }
}
`.replace(/\\\\`/g, '`').replace(/\\\\\$/g, '$');

lines.push(replacement);
fs.writeFileSync('public/app.js', lines.join('\n'));
