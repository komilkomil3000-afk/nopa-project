
// ==================== JARCHI NEWS MANAGEMENT ====================

document.querySelector('[data-tab="news-tab"]')?.addEventListener('click', loadNewsTab);

async function loadNewsTab() {
  try {
    const res = await fetch('/api/v1/news', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) return console.error('Failed to load news');
    const news = await res.json();
    const tbody = document.querySelector('#news-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    news.forEach(item => {
      const tr = document.createElement('tr');
      const date = new Date(item.publishDate).toLocaleString('fa-IR');
      const img = item.imageUrl ? `<img src="${API_BASE_URL}${item.imageUrl}" style="width:50px; border-radius:4px;">` : 'بدون تصویر';
      tr.innerHTML = `
        <td>${img}</td>
        <td>${item.title}</td>
        <td>${item.category}</td>
        <td>${item.source}</td>
        <td>${date}</td>
        <td>
          <button class="btn-icon" onclick="editNews('${item.id}')" title="ویرایش"><i class="fa-solid fa-edit"></i></button>
          <button class="btn-icon" onclick="deleteNews('${item.id}')" title="حذف" style="color:var(--color-danger)"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
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
    document.getElementById('news-category').value = news.category;
    document.getElementById('news-source').value = news.source;
    const dt = new Date(news.publishDate);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    document.getElementById('news-publish-date').value = dt.toISOString().slice(0, 16);
    document.getElementById('news-modal-title').innerHTML = '<i class="fa-solid fa-edit" style="color: #38bdf8;"></i> ویرایش خبر';
  } else {
    document.getElementById('news-id').value = '';
    document.getElementById('news-modal-title').innerHTML = '<i class="fa-solid fa-newspaper" style="color: #38bdf8;"></i> افزودن خبر جدید';
  }
  document.getElementById('news-modal').style.display = 'flex';
}

window.closeNewsModal = function() {
  document.getElementById('news-modal').style.display = 'none';
}

window.editNews = async function(id) {
  try {
    const res = await fetch(API_BASE_URL + '/news', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const newsList = await res.json();
    const news = newsList.find(n => n.id === id);
    if (news) {
      openNewsModal(news);
    }
  } catch (error) {
    console.error('Error fetching news details:', error);
  }
}

window.deleteNews = async function(id) {
  if (!confirm('آیا از حذف این خبر اطمینان دارید؟')) return;
  try {
    const res = await fetch(API_BASE_URL + `/admin/news/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
  const title = document.getElementById('news-title').value;
  const body = document.getElementById('news-body').value;
  const category = document.getElementById('news-category').value;
  const source = document.getElementById('news-source').value;
  const publishDate = document.getElementById('news-publish-date').value;
  const imageFile = document.getElementById('news-image').files[0];

  const formData = new FormData();
  formData.append('title', title);
  formData.append('body', body);
  formData.append('category', category);
  formData.append('source', source);
  formData.append('publishDate', publishDate);
  if (imageFile) formData.append('image', imageFile);

  try {
    let url = API_BASE_URL + '/admin/news';
    let method = 'POST';
    if (id) {
      url = API_BASE_URL + `/admin/news/${id}`;
      method = 'PUT';
    }
    
    const res = await fetch(url, {
      method: method,
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
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
