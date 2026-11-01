// Jarchi: banners and news.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// --- BANNERS & NEWS MANAGEMENT ---

window.switchJarchiSubTab = function(subtab) {
  const bannersView = document.getElementById('jarchi-banners-view');
  const newsView = document.getElementById('jarchi-news-view');
  const btnBanners = document.getElementById('subtab-btn-banners');
  const btnNews = document.getElementById('subtab-btn-news');

  if (subtab === 'banners') {
    if (bannersView) bannersView.style.display = 'block';
    if (newsView) newsView.style.display = 'none';
    if (btnBanners) {
      btnBanners.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-strong))';
      btnBanners.style.color = 'white';
      btnBanners.style.boxShadow = '0 4px 12px rgb(var(--accent-rgb) / 0.35)';
      btnBanners.style.border = 'none';
    }
    if (btnNews) {
      btnNews.style.background = 'rgb(var(--fg-rgb) / 0.06)';
      btnNews.style.color = 'var(--text-muted)';
      btnNews.style.boxShadow = 'none';
      btnNews.style.border = '1px solid rgb(var(--fg-rgb) / 0.1)';
    }
    window.loadBannersTab();
  } else {
    if (bannersView) bannersView.style.display = 'none';
    if (newsView) newsView.style.display = 'block';
    if (btnNews) {
      btnNews.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-strong))';
      btnNews.style.color = 'white';
      btnNews.style.boxShadow = '0 4px 12px rgb(var(--primary-rgb) / 0.35)';
      btnNews.style.border = 'none';
    }
    if (btnBanners) {
      btnBanners.style.background = 'rgb(var(--fg-rgb) / 0.06)';
      btnBanners.style.color = 'var(--text-muted)';
      btnBanners.style.boxShadow = 'none';
      btnBanners.style.border = '1px solid rgb(var(--fg-rgb) / 0.1)';
    }
    window.loadNewsTab();
  }
};

window.previewBannerImage = function(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('banner-image-preview');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      preview.src = evt.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
};

window.loadNewsAndBanners = function() {
  window.loadBannersTab();
  window.loadNewsTab();
};

window.cachedBannerList = [];

window.loadBannersTab = async function() {
  const tbody = document.querySelector('#banners-tbody') || document.querySelector('#banners-table tbody');
  if (tbody) {
    NopaTable.loading(tbody, 'در حال بارگذاری بنرها...');
  }

  try {
    const res = await request('/api/v1/admin/banners');
    
    if (!res.ok) {
      NopaTable.error(tbody, 'خطا در دریافت بنرها از سرور');
      return;
    }

    const banners = await res.json();
    const bannerList = Array.isArray(banners) ? banners : [];
    window.cachedBannerList = bannerList;

    // Update Stats
    const totalCount = bannerList.length;
    const homeCount = bannerList.filter(b => b.position === 'home_top').length;
    const bazaarCount = bannerList.filter(b => b.position === 'bazaar_top').length;
    const activeCount = bannerList.filter(b => (b.isActive === true || b.isActive === 1 || b.isActive === 'true')).length;

    const elTotal = document.getElementById('banners-stat-total');
    const elHome = document.getElementById('banners-stat-home');
    const elBazaar = document.getElementById('banners-stat-bazaar');
    const elActive = document.getElementById('banners-stat-active');

    if (elTotal) elTotal.textContent = `${totalCount} بنر`;
    if (elHome) elHome.textContent = `${homeCount} بنر`;
    if (elBazaar) elBazaar.textContent = `${bazaarCount} بنر`;
    if (elActive) elActive.textContent = `${activeCount} بنر فعال`;

    if (!tbody) return;
    if (bannerList.length === 0) {
      NopaTable.empty(tbody, 'هنوز بنری ثبت نشده است. با زدن دکمه بالا بنر جدید اضافه کنید.', 'fa-solid fa-images');
      return;
    }

    const positionLabels = {
      'home_top': '<span class="badge u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-house"></i> بالای صفحه اصلی</span>',
      'bazaar_top': '<span class="badge u-bg-success-15 u-c-success-text u-bd-success-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-store"></i> بالای صفحه بازار</span>',
      'lms_slider': '<span class="badge u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-graduation-cap"></i> آموزش و منزلگاه</span>',
      'general': '<span class="badge u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-globe"></i> عمومی</span>'
    };

    tbody.innerHTML = bannerList.map(b => {
      const posLabel = positionLabels[b.position] || `<span class="badge">${b.position}</span>`;
      const isBannerActive = (b.isActive === true || b.isActive === 1 || b.isActive === 'true');
      const statusBadge = isBannerActive
        ? `<span class="badge u-bg-success-15 u-c-success-text u-bd-success-30 u-fs-11 u-p-3-8 u-r-6 u-pointer" data-click="toggleBannerStatus" data-click-args="${esc(JSON.stringify([String(b.id), true]))}" title="کلیک برای غیرفعال کردن"><i class="fa-solid fa-check"></i> فعال</span>`
        : `<span class="badge u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-fs-11 u-p-3-8 u-r-6 u-pointer" data-click="toggleBannerStatus" data-click-args="${esc(JSON.stringify([String(b.id), false]))}" title="کلیک برای فعال کردن"><i class="fa-solid fa-xmark"></i> غیرفعال</span>`;
      
      const imgMarkup = b.imageUrl
        ? `<img src="${esc(b.imageUrl)}" class="u-w-75 u-h-42 u-r-6 u-fit-cover u-bd-fg-10 u-shadow-0-2-6-shade-30" data-error="NopaActions.fallbackSrc" data-error-args="[&quot;$this&quot;,&quot;/uploads/banner1.jpg&quot;]" />`
        : '<div class="u-w-75 u-h-42 u-r-6 u-bg-fg-5 u-flex u-items-center u-justify-center u-c-text-faint"><i class="fa-solid fa-image"></i></div>';

      const targetText = b.targetRoute ? `<code class="u-bg-fg-6 u-p-2-6 u-r-4 u-fs-11 u-c-text-soft" dir="ltr">${esc(b.targetRoute)}</code>` : '<span class="u-c-text-faint">-</span>';

      return `
        <tr>
          <td class="u-text-center">${imgMarkup}</td>
          <td class="u-bold u-c-text">${esc(b.title || 'بدون عنوان')}</td>
          <td class="u-text-center">${posLabel}</td>
          <td>${targetText}</td>
          <td class="u-text-center u-c-accent-text u-bold">${b.orderIndex ?? 0}</td>
          <td class="u-text-center">${statusBadge}</td>
          <td class="u-text-center">
            <div class="u-flex u-gap-6 u-justify-center">
              <button type="button" class="btn-icon u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-w-32 u-h-32 u-r-6 u-pointer" data-click="editBanner" data-click-args="${esc(JSON.stringify([String(b.id)]))}" title="ویرایش بنر">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="btn-icon u-bg-danger-15 u-c-danger-text u-bd-danger-30 u-w-32 u-h-32 u-r-6 u-pointer" data-click="deleteBanner" data-click-args="${esc(JSON.stringify([String(b.id)]))}" title="حذف بنر">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    console.error('Error loading banners:', e);
    NopaTable.error(tbody, 'ارتباط با سرور برقرار نشد');
  }
};

window.toggleBannerStatus = async function(id, currentActive) {
  const newActive = !currentActive;
  try {
    const formData = new FormData();
    formData.append('isActive', newActive);
    const res = await request(`/api/v1/admin/banners/${id}`, {
      method: 'PUT',
      body: formData
    });
    if (res.ok) {
      if (typeof showToastSuccess === 'function') {
        showToastSuccess(newActive ? 'بنر فعال شد' : 'بنر غیرفعال شد');
      }
      loadBannersTab();
    }
  } catch(e) {
    console.error('Error toggling banner status:', e);
  }
};

window.openCreateBannerModal = function() {
  const form = document.getElementById('banner-form');
  if (form) form.reset();
  const idEl = document.getElementById('banner-id');
  if (idEl) idEl.value = '';
  const titleModalEl = document.getElementById('banner-modal-title');
  if (titleModalEl) titleModalEl.innerHTML = '<i class="fa-solid fa-image u-c-accent-text"></i> بارگذاری و افزودن بنر جدید';
  const preview = document.getElementById('banner-image-preview');
  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
  
  const m = document.getElementById('banner-modal');
  if (m) {
    m.style.display = 'flex';
    m.classList.remove('hidden');
  }
};

window.closeBannerModal = function() {
  const m = document.getElementById('banner-modal');
  if (m) {
    m.style.display = 'none';
    m.classList.add('hidden');
  }
};

window.editBanner = async function(id) {
  try {
    let b = (window.cachedBannerList || []).find(x => x.id === id);
    if (!b) {
      const res = await request('/api/v1/admin/banners');
      const banners = await res.json();
      b = (Array.isArray(banners) ? banners : []).find(x => x.id === id);
    }
    if (!b) return;

    document.getElementById('banner-id').value = b.id || '';
    document.getElementById('banner-title').value = b.title || '';
    document.getElementById('banner-target').value = b.targetRoute || '';
    document.getElementById('banner-position').value = b.position || 'home_top';
    document.getElementById('banner-order').value = b.orderIndex ?? 0;
    document.getElementById('banner-active').checked = (b.isActive === true || b.isActive === 'true');

    const preview = document.getElementById('banner-image-preview');
    if (preview) {
      if (b.imageUrl) {
        preview.src = b.imageUrl;
        preview.style.display = 'block';
      } else {
        preview.src = '';
        preview.style.display = 'none';
      }
    }

    const titleModalEl = document.getElementById('banner-modal-title');
    if (titleModalEl) titleModalEl.innerHTML = '<i class="fa-solid fa-pen u-c-accent-text"></i> ویرایش و اصلاح بنر';

    const m = document.getElementById('banner-modal');
    if (m) {
      m.style.display = 'flex';
      m.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Error fetching banner for edit:', e);
  }
};

window.saveBannerItem = async function(e) {
  e.preventDefault();
  const id = document.getElementById('banner-id').value;
  const formData = new FormData();
  formData.append('title', document.getElementById('banner-title').value);
  formData.append('targetRoute', document.getElementById('banner-target').value);
  formData.append('position', document.getElementById('banner-position').value);
  formData.append('orderIndex', document.getElementById('banner-order').value);
  formData.append('isActive', document.getElementById('banner-active').checked);
  const fileInput = document.getElementById('banner-file');
  if (fileInput && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }
  
  const url = id ? `/api/v1/admin/banners/${id}` : '/api/v1/admin/banners';
  const method = id ? 'PUT' : 'POST';
  
  try {
    const res = await request(url, {
      method,
      body: formData
    });
    if (res.ok) {
      if (typeof showToastSuccess === 'function') {
        showToastSuccess(id ? 'بنر با موفقیت ویرایش شد' : 'بنر جدید با موفقیت بارگذاری شد');
      } else {
        showToast(id ? 'بنر با موفقیت ویرایش شد' : 'بنر جدید با موفقیت بارگذاری شد', 'success');
      }
      closeBannerModal();
      loadBannersTab();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'خطا در ثبت بنر', 'error');
    }
  } catch(e) {
    console.error('Network error saving banner:', e);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
};

window.deleteBanner = async function(id) {
  if (!(await NopaConfirm('آیا از حذف این بنر اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/banners/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      if (typeof showToastSuccess === 'function') {
        showToastSuccess('بنر با موفقیت حذف شد');
      }
      loadBannersTab();
    } else {
      showToast('خطا در حذف بنر', 'error');
    }
  } catch(e) {
    console.error('Error deleting banner:', e);
  }
};

window.cachedNewsList = [];

window.loadNewsTab = async function() {
  const tbody = document.querySelector('#news-tbody') || document.querySelector('#news-table tbody');
  if (tbody) {
    NopaTable.loading(tbody, 'در حال بارگذاری اخبار و اعلانات جارچی...');
  }

  try {
    const res = await request('/api/v1/admin/news');
    
    if (!res.ok) {
      NopaTable.error(tbody, 'خطا در دریافت اطلاعات اخبار از سرور');
      return;
    }

    const news = await res.json();
    window.cachedNewsList = Array.isArray(news) ? news : [];

    // Calculate stats
    const totalCount = window.cachedNewsList.length;
    const publishedCount = window.cachedNewsList.filter(n => n.isPublished).length;
    const draftCount = totalCount - publishedCount;

    const elTotal = document.getElementById('news-stat-total');
    const elPub = document.getElementById('news-stat-published');
    const elDraft = document.getElementById('news-stat-drafts');

    if (elTotal) elTotal.textContent = `${totalCount} خبر`;
    if (elPub) elPub.textContent = `${publishedCount} خبر فعال`;
    if (elDraft) elDraft.textContent = `${draftCount} پیش‌نویس`;

    window.filterNewsTable();
  } catch(e) {
    console.error('Error loading news:', e);
    NopaTable.error(tbody, 'ارتباط با سرور برقرار نشد');
  }
};

window.filterNewsTable = function() {
  const query = (document.getElementById('news-search-input')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('news-filter-category')?.value || 'all';
  const audienceFilter = document.getElementById('news-filter-audience')?.value || 'all';

  let filtered = window.cachedNewsList || [];

  if (query) {
    filtered = filtered.filter(n => 
      (n.title && n.title.toLowerCase().includes(query)) ||
      (n.subtitle && n.subtitle.toLowerCase().includes(query)) ||
      (n.body && n.body.toLowerCase().includes(query)) ||
      (n.reporter && n.reporter.toLowerCase().includes(query))
    );
  }

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(n => (n.category || '') === categoryFilter);
  }

  if (audienceFilter !== 'all') {
    filtered = filtered.filter(n => (n.targetAudience || 'ALL') === audienceFilter);
  }

  window.renderNewsTable(filtered);
};

window.renderNewsTable = function(newsList) {
  const tbody = document.querySelector('#news-tbody') || document.querySelector('#news-table tbody');
  if (!tbody) return;

  if (!newsList || newsList.length === 0) {
    NopaTable.empty(tbody, 'هیچ خبر یا اطلاعیه‌ای یافت نشد.', 'fa-solid fa-inbox');
    return;
  }

  const categoryColors = {
    'اطلاعیه مهم': { bg: 'rgb(var(--danger-rgb) / 0.15)', text: 'var(--danger-text)', border: 'rgb(var(--danger-rgb) / 0.3)' },
    'رویداد و مسابقه': { bg: 'rgb(var(--primary-rgb) / 0.15)', text: 'var(--primary-text)', border: 'rgb(var(--primary-rgb) / 0.3)' },
    'اخبار کاروان‌ها': { bg: 'rgb(var(--success-rgb) / 0.15)', text: 'var(--success-text)', border: 'rgb(var(--success-rgb) / 0.3)' },
    'آموزشی': { bg: 'rgb(var(--primary-rgb) / 0.15)', text: 'var(--primary-text)', border: 'rgb(var(--primary-rgb) / 0.3)' }
  };

  const audienceLabels = {
    'ALL': '<span class="badge u-bg-fg-8 u-c-text-soft u-bd-fg-10 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-users"></i> عمومی</span>',
    'STUDENTS': '<span class="badge u-bg-primary-15 u-c-primary-text u-bd-primary-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-user-graduate"></i> دانش‌آموزان</span>',
    'MENTORS': '<span class="badge u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-user-tie"></i> راهبران</span>'
  };

  tbody.innerHTML = newsList.map(n => {
    const catStyle = categoryColors[n.category] || { bg: 'rgb(var(--muted-rgb) / 0.15)', text: 'var(--text-soft)', border: 'rgb(var(--muted-rgb) / 0.3)' };
    const audienceBadge = audienceLabels[n.targetAudience] || audienceLabels['ALL'];
    const pDate = n.publishDate ? new Date(n.publishDate).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    
    const imageMarkup = n.imageUrl 
      ? `<img src="${esc(n.imageUrl)}" class="u-w-50 u-h-50 u-r-8 u-fit-cover u-bd-fg-10 u-shadow-0-2-6-shade-30" />`
      : `<div class="u-w-50 u-h-50 u-r-8 u-bg-fg-5 u-flex u-items-center u-justify-center u-c-text-faint u-bd-fg-8"><i class="fa-solid fa-image u-fs-18"></i></div>`;

    const statusBadge = n.isPublished
      ? `<span class="badge u-bg-success-15 u-c-success-text u-bd-success-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-check"></i> منتشرشده</span>`
      : `<span class="badge u-bg-accent-15 u-c-accent-text u-bd-accent-30 u-fs-11 u-p-3-8 u-r-6"><i class="fa-solid fa-clock"></i> پیش‌نویس</span>`;

    return `
      <tr>
        <td class="u-text-center">${imageMarkup}</td>
        <td>
          <div class="u-bold u-c-text u-fs-13 u-mb-3">${esc(n.title || 'بدون عنوان')}</div>
          ${n.subtitle ? `<div class="u-fs-11 u-c-text-muted u-lh-1_4">${esc(n.subtitle)}</div>` : ''}
        </td>
        <td class="u-text-center">
          <span class="badge u-fs-11 u-p-3-8 u-r-6 u-bold" style="background:${catStyle.bg}; color:${esc(catStyle.text)}; border:1px solid ${catStyle.border}">
            ${esc(n.category || 'عمومی')}
          </span>
        </td>
        <td>
          <div class="u-fs-12 u-c-text-soft u-flex u-items-center u-gap-5">
            <i class="fa-solid fa-user-pen u-c-primary-text u-fs-11"></i>
            <span>${esc(n.reporter || 'ستاد نپا')}</span>
          </div>
        </td>
        <td dir="ltr" class="u-text-right u-fs-11 u-c-text-muted">${pDate}</td>
        <td class="u-text-center">${audienceBadge}</td>
        <td class="u-text-center">${statusBadge}</td>
        <td class="u-text-center">
          <div class="u-flex u-justify-center u-gap-6">
            <button type="button" class="btn-action u-bg-primary-15 u-bd-primary-30 u-c-primary-text u-p-5-8 u-r-6 u-pointer" data-click="editNews" data-click-args="${esc(JSON.stringify([String(n.id)]))}" title="ویرایش خبر">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="btn-action u-bg-danger-15 u-bd-danger-30 u-c-danger-text u-p-5-8 u-r-6 u-pointer" data-click="deleteNews" data-click-args="${esc(JSON.stringify([String(n.id)]))}" title="حذف خبر">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.openCreateNewsModal = function() {
  const form = document.getElementById('news-form');
  if (form) form.reset();

  const idEl = document.getElementById('news-id');
  if (idEl) idEl.value = '';

  const subEl = document.getElementById('news-subtitle');
  if (subEl) subEl.value = '';

  const preview = document.getElementById('news-image-preview');
  if (preview) {
    preview.style.display = 'none';
    preview.src = '';
  }
  
  // Set default datetime to current time
  const now = new Date();
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const dateEl = document.getElementById('news-publish-date');
  if (dateEl) dateEl.value = iso;
  
  const titleEl = document.getElementById('news-modal-title');
  if (titleEl) {
    titleEl.innerHTML = '<i class="fa-solid fa-newspaper u-c-primary-text"></i> افزودن خبر جدید جارچی';
  }
  
  const m = document.getElementById('news-modal');
  if (m) {
    m.style.display = 'flex';
    m.classList.remove('hidden');
  }
};

window.closeNewsModal = function() {
  const m = document.getElementById('news-modal');
  if (m) m.style.display = 'none';
};

window.editNews = async function(id) {
  try {
    let n = (window.cachedNewsList || []).find(x => x.id === id);
    if (!n) {
      const res = await request('/api/v1/admin/news');
      const news = await res.json();
      n = news.find(x => x.id === id);
    }
    if (!n) return;

    document.getElementById('news-id').value = n.id;
    document.getElementById('news-title').value = n.title || '';
    document.getElementById('news-subtitle').value = n.subtitle || '';
    document.getElementById('news-body').value = n.body || '';
    document.getElementById('news-category').value = n.category || 'اطلاعیه مهم';
    document.getElementById('news-reporter').value = n.reporter || 'ستاد آموزش نپا';
    document.getElementById('news-target').value = n.targetAudience || 'ALL';

    if (n.publishDate) {
      const d = new Date(n.publishDate);
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('news-publish-date').value = iso;
    }

    const preview = document.getElementById('news-image-preview');
    if (n.imageUrl && preview) {
      preview.src = n.imageUrl;
      preview.style.display = 'block';
    } else if (preview) {
      preview.style.display = 'none';
    }

    const activeEl = document.getElementById('news-active');
    if (activeEl) activeEl.checked = n.isPublished !== false;

    const pushEl = document.getElementById('news-push');
    if (pushEl) pushEl.checked = false;

    const titleEl = document.getElementById('news-modal-title');
    if (titleEl) {
      titleEl.innerHTML = '<i class="fa-solid fa-pen u-c-primary-text"></i> ویرایش خبر جارچی';
    }

    const m = document.getElementById('news-modal');
    if (m) {
      m.style.display = 'flex';
      m.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Edit news error:', e);
  }
};

window.saveNewsArticle = async function(e) {
  e.preventDefault();
  const id = document.getElementById('news-id')?.value;
  const title = document.getElementById('news-title')?.value;
  const audience = document.getElementById('news-target')?.value || 'ALL';
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('subtitle', document.getElementById('news-subtitle')?.value || '');
  formData.append('body', document.getElementById('news-body')?.value || '');
  formData.append('category', document.getElementById('news-category')?.value || 'اطلاعیه مهم');
  formData.append('reporter', document.getElementById('news-reporter')?.value || 'ستاد نپا');
  formData.append('targetAudience', audience);
  
  const pDate = document.getElementById('news-publish-date')?.value;
  if (pDate) formData.append('publishDate', new Date(pDate).toISOString());
  formData.append('isPublished', document.getElementById('news-active')?.checked ? 'true' : 'false');
  
  const fileInput = document.getElementById('news-file');
  if (fileInput && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }
  
  const url = id ? `/api/v1/admin/news/${id}` : '/api/v1/admin/news';
  const method = id ? 'PUT' : 'POST';
  
  try {
    const res = await request(url, {
      method,
      body: formData
    });
    
    if (res.ok) {
      window.closeNewsModal();
      await window.loadNewsTab();
      showToastSuccess('خبر با موفقیت در تابلوی اعلانات جارچی ذخیره و منتشر شد!');
      
      if (document.getElementById('news-push')?.checked) {
        showToastSuccess('نوتیفیکیشن خبر برای مخاطبان هدف ارسال گردید.');
      }
    } else {
      const err = await res.json();
      showToast('خطا در ثبت خبر: ' + (err.error || 'خطای سرور'), 'error');
    }
  } catch(e) { 
    console.error('Save news error:', e);
    showToast('خطا در برقراری ارتباط با سرور', 'error'); 
  }
};

window.previewNewsImage = function(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('news-image-preview');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else if (preview) {
    preview.style.display = 'none';
  }
};

// showToastSuccess / showToastError / showToastInfo are defined in toast.js (shared bottom-left toast system)

window.deleteNews = async function(id) {
  if (!(await NopaConfirm('آیا از حذف این خبر از تابلوی اعلانات جارچی اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/news/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToastSuccess('خبر با موفقیت حذف شد.');
      await window.loadNewsTab();
    } else {
      const d = await res.json();
      showToast('خطا در حذف خبر: ' + (d.error || 'خطای سرور'), 'error');
    }
  } catch(e) { 
    console.error('Delete news error:', e);
    showToast('خطا در ارتباط با سرور', 'error');
  }
};
