// LMS station creator / editor modal: gallery, category blocks, save, direct file upload.
// Split out of the former lms.js (Phase 7).

// ==================== STATION CREATOR & EDIT MODAL (DYNAMIC ANIMATIONS & CATEGORIES) ====================

// ---- نگارستان منزلگاه: image gallery cards (shared by the creator modal and the content manager modal) ----
window.modalAnimationBlockCounter = 0;

window.addGalleryItemCard = function(containerId, data = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  window.modalAnimationBlockCounter++;
  const n = window.modalAnimationBlockCounter;
  const blockId = 'modal-anim-block-' + n;
  const inputId = 'modal-anim-url-input-' + n;
  const index = container.querySelectorAll('.modal-animation-card').length + 1;

  const title = data?.title || `تصویر ${index}`;
  const url = data?.url || data?.videoUrl || '';
  const desc = data?.description || '';
  const itemId = data?.id || `anim_${Date.now()}_${n}`;
  const isImage = !url || /\.(jpe?g|png|gif|webp|bmp|heic)(\?.*)?$/i.test(url);

  container.insertAdjacentHTML('beforeend', `
    <div id="${blockId}" class="modal-animation-card" data-anim-id="${esc(itemId)}" style="background: rgb(var(--surface-2-rgb) / 0.7); border: 1px solid rgb(var(--primary-rgb) / 0.28); border-radius: 10px; padding: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.06); padding-bottom:6px;">
        <span class="anim-badge" style="background:var(--primary); color:white; padding:2px 8px; border-radius:6px; font-weight:bold; font-size:11px;">تصویر ${index}</span>
        <button type="button" onclick="window.removeGalleryItemCard('${blockId}')" style="background:rgb(var(--danger-rgb) / 0.15); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.35); border-radius:6px; padding:3px 9px; font-size:11px; cursor:pointer;">
          <i class="fa-solid fa-trash"></i> حذف
        </button>
      </div>
      <div style="display:flex; gap:10px; align-items:flex-start;">
        ${isImage
          ? `<img class="modal-anim-preview" src="${esc(url)}" alt="" style="width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--border-strong); background:var(--surface); ${url ? '' : 'visibility:hidden;'}" onerror="this.style.visibility = 'hidden'" onload="this.style.visibility = 'visible'">`
          : `<div style="width:64px; height:64px; border-radius:8px; border:1px solid var(--border-strong); background:var(--surface); display:flex; align-items:center; justify-content:center; color:var(--primary-text);" title="ویدیو"><i class="fa-solid fa-film"></i></div>`}
        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <input type="text" class="modal-anim-title input-ctrl" value="${esc(title)}" placeholder="عنوان تصویر" style="background:var(--surface-2);">
          <div style="display:flex; gap:6px;">
            <input type="text" id="${inputId}" class="modal-anim-url input-ctrl" value="${esc(url)}" placeholder="https://... یا /uploads/..." style="background:var(--surface-2); direction:ltr; text-align:left; flex:1;" oninput="const p=this.closest('.modal-animation-card').querySelector('.modal-anim-preview'); if(p) p.src=this.value">
            <label style="background:rgb(var(--primary-rgb) / 0.18); border:1px solid var(--primary); color:var(--primary-text); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:11px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
              <i class="fa-solid fa-cloud-arrow-up"></i> آپلود تصویر
              <input type="file" accept="image/*" style="display:none;" onchange="window.handleDirectFileUpload(this, '${inputId}')">
            </label>
          </div>
          <div style="display:flex; gap:6px;">
            <input type="text" id="${inputId}-cover" class="modal-anim-cover input-ctrl" value="${esc(data?.coverImageUrl || '')}" placeholder="لینک کاور (فقط برای ویدیو، اختیاری)" style="background:var(--surface-2); direction:ltr; text-align:left; flex:1;">
            <label style="background:rgb(var(--primary-rgb) / 0.18); border:1px solid var(--primary); color:var(--primary-text); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:11px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
              <i class="fa-solid fa-cloud-arrow-up"></i> آپلود کاور
              <input type="file" accept="image/*" style="display:none;" onchange="window.handleDirectFileUpload(this, '${inputId}-cover')">
            </label>
          </div>
          <textarea class="modal-anim-desc input-ctrl" rows="1" placeholder="توضیح (اختیاری)" style="background:var(--surface-2);">${esc(desc)}</textarea>
        </div>
      </div>
    </div>`);
};

window.removeGalleryItemCard = async function(blockId) {
  const card = document.getElementById(blockId);
  if (!card) return;
  if (!(await NopaConfirm('این مورد از نگارستان حذف شود؟'))) return;
  const container = card.parentElement;
  card.remove();
  container.querySelectorAll('.modal-animation-card').forEach((c, i) => {
    const badge = c.querySelector('.anim-badge');
    if (badge) badge.textContent = `تصویر ${i + 1}`;
  });
};

// Entries already stored on the station (images, or videos added earlier) -> cards
window.fillGalleryFromStation = function(containerId, station) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  let list = [];
  if (Array.isArray(station.animations) && station.animations.length > 0) {
    list = station.animations;
  } else if (station.animationsJson) {
    try {
      const parsed = typeof station.animationsJson === 'string' ? JSON.parse(station.animationsJson) : station.animationsJson;
      if (Array.isArray(parsed)) list = parsed;
    } catch (_) {}
  }
  if (list.length === 0 && station.animationUrl) {
    list = [{ title: station.animationTitle || 'تصویر ۱', url: station.animationUrl }];
  }
  list.forEach(item => window.addGalleryItemCard(containerId, item));
};

window.collectGalleryItems = function(containerId) {
  const items = [];
  document.querySelectorAll(`#${containerId} .modal-animation-card`).forEach((card, idx) => {
    const url = card.querySelector('.modal-anim-url')?.value?.trim() || '';
    if (!url) return; // an entry without a picture is meaningless
    items.push({
      id: card.getAttribute('data-anim-id') || `anim_${idx + 1}`,
      title: card.querySelector('.modal-anim-title')?.value?.trim() || `تصویر ${idx + 1}`,
      url,
      videoUrl: url,
      coverImageUrl: card.querySelector('.modal-anim-cover')?.value?.trim() || '',
      description: card.querySelector('.modal-anim-desc')?.value?.trim() || '',
      orderIndex: items.length + 1
    });
  });
  return items;
};

// Kept for older callers
window.modalCategoryBlockCounter = 0;

window.addCategoryBlockToCreatorModal = function(catData = null) {
  const container = document.getElementById('lms-modal-categories-container');
  if (!container) return;

  window.modalCategoryBlockCounter++;
  const blockId = 'modal-cat-block-' + window.modalCategoryBlockCounter;
  
  const existingCards = container.querySelectorAll('.modal-category-card');
  const catIndex = existingCards.length + 1;
  const isSkillDefault = catIndex === 1;
  const isMediaDefault = catIndex === 2;

  const defaultTitle = catData?.title || (isSkillDefault ? 'کلاس‌های مهارتی' : (isMediaDefault ? 'کلاس‌های رسانه‌ای' : `دسته کلاس ${catIndex}`));
  const defaultInstructor = catData?.instructor || (catData?.sessions?.[0]?.instructor) || (isSkillDefault ? 'پیراینه‌گر' : (isMediaDefault ? 'علیرضا خوش‌منظر' : 'استاد نپا'));
  const defaultSessions = (catData?.sessions?.length) || catData?.sessionsCount || 2;
  const defaultParts = (catData?.sessions?.[0]?.videoClips?.length) || catData?.partsPerSession || 2;
  const defaultSchedule = catData?.schedule || (isSkillDefault ? 'شنبه و دوشنبه' : (isMediaDefault ? 'پنجشنبه و جمعه' : 'سه‌شنبه و چهارشنبه'));
  
  let defaultDateStr = '';
  if (catData?.releaseDate) {
    try { defaultDateStr = new Date(catData.releaseDate).toISOString().split('T')[0]; } catch(e) {}
  } else {
    defaultDateStr = new Date().toISOString().split('T')[0];
  }

  const color = catIndex % 2 === 1 ? 'var(--info-text)' : 'var(--primary-text)';
  const badgeBg = catIndex % 2 === 1 ? 'var(--info-strong)' : 'var(--primary-strong)';

  const cardHtml = `
    <div id="${blockId}" class="modal-category-card" data-cat-id="${catData?.id || ''}" style="background: rgb(var(--surface-2-rgb) / 0.7); border: 1px solid ${color}55; border-radius: 12px; padding: 14px; box-shadow: 0 4px 12px rgb(var(--shade-rgb) / 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgb(var(--fg-rgb) / 0.06); padding-bottom: 8px;">
        <h4 class="modal-cat-badge-title" style="margin: 0; color: ${color}; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
          <span class="badge" style="background: ${badgeBg}; color: var(--text); padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">دسته ${catIndex}</span>
          <i class="fa-solid fa-graduation-cap"></i> <span class="cat-label-display">${defaultTitle}</span>
        </h4>
        <button type="button" onclick="window.removeCategoryBlockFromCreatorModal('${blockId}')" style="background: rgb(var(--danger-rgb) / 0.15); color: var(--danger-text); border: 1px solid rgb(var(--danger-rgb) / 0.35); border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="حذف این دسته کلاس">
          <i class="fa-solid fa-trash"></i> حذف دسته
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1.8fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div class="form-group">
          <label style="font-size:11.5px; color:var(--text-soft);">عنوان دسته کلاس:</label>
          <input type="text" class="modal-cat-title input-ctrl" value="${defaultTitle}" placeholder="مثال: کلاس‌های مهارتی، کارگاه پادکست..." style="background: var(--surface-2);" oninput="this.closest('.modal-category-card').querySelector('.cat-label-display').textContent = this.value">
        </div>
        <div class="form-group inst-picker-wrapper" style="position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label style="font-size:11.5px; color:var(--text-soft);"><i class="fa-solid fa-chalkboard-user" style="color:var(--primary-text);"></i> استاد / اساتید دوره:</label>
            <a href="javascript:void(0)" onclick="window.openInstructorModalQuick('${blockId}')" style="font-size:10px; color:var(--primary-text); text-decoration:none; display:flex; align-items:center; gap:3px;" title="افزودن استاد جدید به بانک اساتید"><i class="fa-solid fa-plus-circle"></i> + استاد جدید</a>
          </div>
          <input type="text" class="modal-cat-instructor input-ctrl" value="${esc(defaultInstructor)}" readonly onclick="window.toggleInstructorDropdown('${blockId}', event)" style="display:none;">
          <div id="inst-picker-box-${blockId}" class="inst-picker-box" style="background: var(--surface-2); border: 1px solid rgb(var(--primary-rgb) / 0.35); border-radius: 6px; padding: 6px 10px; min-height: 38px; cursor: pointer; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;" onclick="window.toggleInstructorDropdown('${blockId}', event)">
            <!-- Selected badges rendered here -->
          </div>
          <div id="inst-dropdown-${blockId}" class="inst-dropdown-menu" style="display: none; position: absolute; top: 100%; right: 0; left: 0; z-index: var(--z-panel-raised); background: var(--surface); border: 1px solid rgb(var(--primary-rgb) / 0.45); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); padding: 8px; max-height: 220px; overflow-y: auto; margin-top: 4px;">
            <!-- Checklist from globalInstructorsList -->
          </div>
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:var(--text-soft);">تعداد جلسات:</label>
          <input type="number" class="modal-cat-sessions input-ctrl" value="${defaultSessions}" min="1" max="50" style="background: var(--surface-2);">
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:var(--primary-text); font-weight:bold;"><i class="fa-solid fa-film"></i> پارت هر جلسه:</label>
          <input type="number" class="modal-cat-parts input-ctrl" value="${defaultParts}" min="1" max="20" style="background: var(--surface-2); border-color: ${color};" title="تعداد پارت‌های ویدیویی در هر جلسه">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label style="font-size:11.5px; color:var(--text-soft);">زمان‌بندی برگزاری هفتگی:</label>
          <input type="text" class="modal-cat-schedule input-ctrl" value="${defaultSchedule}" placeholder="مثال: شنبه و دوشنبه" style="background: var(--surface-2);">
        </div>
        <div class="form-group">
          <label style="font-size:11.5px; color:var(--text-soft);"><i class="fa-solid fa-calendar-check"></i> تاریخ شروع این دسته:</label>
          <input type="date" class="modal-cat-date input-ctrl" value="${defaultDateStr}" style="color:var(--text); background: var(--surface-2);">
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', cardHtml);
  if (typeof window.renderSelectedInstructorBadges === 'function') {
    window.renderSelectedInstructorBadges(blockId);
  }
  window.reindexModalCategoryCards();
};

window.removeCategoryBlockFromCreatorModal = async function(blockId) {
  const card = document.getElementById(blockId);
  if (!card) return;

  if ((await NopaConfirm('آیا از حذف این دسته کلاس اطمینان دارید؟ جلسات مربوط به آن نیز حذف خواهند شد.'))) {
    card.remove();
    window.reindexModalCategoryCards();
  }
};

window.reindexModalCategoryCards = function() {
  const container = document.getElementById('lms-modal-categories-container');
  if (!container) return;

  const cards = container.querySelectorAll('.modal-category-card');
  cards.forEach((card, idx) => {
    const badge = card.querySelector('.badge');
    if (badge) badge.textContent = `دسته ${idx + 1}`;
  });
};

window.openCreateStationModal = function() {
  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['صفر', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const existingNumbers = (window.lmsStationsMasterList || []).map(x => Number(x.orderIndex ?? x.index)).filter(n => Number.isFinite(n));
  const nextIdx = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;
  const nextPersianName = PERSIAN_NUMS[nextIdx] ? `منزلگاه ${PERSIAN_NUMS[nextIdx]}` : `منزلگاه ${nextIdx}`;

  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-plus-circle"></i> ایجاد و تعریف ${nextPersianName}`;
  document.getElementById('modal-st-id').value = '';
  document.getElementById('modal-st-index').value = nextIdx;
  document.getElementById('modal-st-title').value = nextPersianName;
  document.getElementById('modal-st-release-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-st-duration').value = '۲ هفته';
  document.getElementById('modal-st-details').value = `سرفصل‌ها و اهداف آموزشی ${nextPersianName}`;

  // Reset the gallery (نگارستان) container
  const animContainer = document.getElementById("lms-modal-animations-container");
  if (animContainer) animContainer.innerHTML = "";

  // Reset categories container (empty by default, optional!)
  const catContainer = document.getElementById('lms-modal-categories-container');
  if (catContainer) catContainer.innerHTML = '';

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-drawer)';
};

window.openStationCreatorModal = window.openCreateStationModal;

window.editStationModal = function(stationId) {
  if (!window.lmsStationsMasterList || window.lmsStationsMasterList.length === 0) return;

  const station = window.lmsStationsMasterList.find(s => 
    s.id === stationId || 
    s.id == stationId || 
    ('MZ' + (s.orderIndex ?? s.index)) === stationId || 
    s.orderIndex == stationId
  );

  if (!station) return;

  const modal = document.getElementById('lms-station-creator-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['صفر', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const stIdx = station.orderIndex ?? 1;
  const simpleStationName = PERSIAN_NUMS[stIdx] ? `منزلگاه ${PERSIAN_NUMS[stIdx]}` : `منزلگاه ${stIdx}`;

  document.getElementById('station-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ویرایش مشخصات ${simpleStationName}`;
  document.getElementById('modal-st-id').value = station.id;
  document.getElementById('modal-st-index').value = stIdx;
  document.getElementById('modal-st-title').value = station.title || simpleStationName;
  
  let releaseDateStr = '';
  if (station.releaseDate) {
    try { releaseDateStr = new Date(station.releaseDate).toISOString().split('T')[0]; } catch(e) {}
  }
  document.getElementById('modal-st-release-date').value = releaseDateStr;
  document.getElementById('modal-st-duration').value = station.stayDuration || '';
  document.getElementById('modal-st-details').value = station.description || '';

  // Populate the gallery (نگارستان)
  window.fillGalleryFromStation("lms-modal-animations-container", station);

  // Populate categories dynamically (leave empty if none)
  const container = document.getElementById('lms-modal-categories-container');
  if (container) container.innerHTML = '';

  const categories = station.categories || [];
  if (categories.length > 0) {
    categories.forEach(cat => window.addCategoryBlockToCreatorModal(cat));
  }

  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-drawer)';
};

window.saveCompleteStation = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('modal-st-id')?.value;
  const parsedOrder = parseInt(document.getElementById('modal-st-index')?.value);
  const orderIndex = Number.isNaN(parsedOrder) || parsedOrder < 0 ? 1 : parsedOrder; // 0 is a valid station
  const title = document.getElementById('modal-st-title')?.value || 'منزلگاه';
  const releaseDate = document.getElementById('modal-st-release-date')?.value;
  const stayDuration = document.getElementById('modal-st-duration')?.value;
  const description = document.getElementById('modal-st-details')?.value || '';

  // Gather the gallery (نگارستان) items
  const animations = window.collectGalleryItems("lms-modal-animations-container");

  const primaryAnim = animations.length > 0 ? animations[0] : null;
  const animationTitle = primaryAnim ? primaryAnim.title : '';
  const animationUrl = primaryAnim ? primaryAnim.url : '';

  // Gather dynamic categories (optional!)
  const container = document.getElementById('lms-modal-categories-container');
  const categoryCards = container ? container.querySelectorAll('.modal-category-card') : [];

  const categories = [];
  categoryCards.forEach((card, idx) => {
    const catId = card.getAttribute('data-cat-id') || undefined;
    const catTitle = card.querySelector('.modal-cat-title')?.value?.trim() || `دسته ${idx + 1}`;
    const instructor = card.querySelector('.modal-cat-instructor')?.value?.trim() || 'استاد نپا';
    const sessionsCount = parseInt(card.querySelector('.modal-cat-sessions')?.value) || 2;
    const partsPerSession = parseInt(card.querySelector('.modal-cat-parts')?.value) || 2;
    const schedule = card.querySelector('.modal-cat-schedule')?.value?.trim() || '';
    const catDate = card.querySelector('.modal-cat-date')?.value || undefined;

    categories.push({
      id: catId,
      orderIndex: idx + 1,
      title: catTitle,
      instructor,
      sessionsCount,
      partsPerSession,
      schedule,
      releaseDate: catDate
    });
  });

  const payload = {
    id: id || undefined,
    orderIndex,
    title,
    releaseDate: releaseDate || undefined,
    stayDuration,
    animationTitle,
    animationUrl,
    animations,
    animationsJson: JSON.stringify(animations),
    description,
    categories
  };

  try {
    const res = await request('/api/v1/admin/stations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('مشخصات منزلگاه، نگارستان و دسته‌ها با موفقیت ذخیره شد.', 'success');
      document.getElementById('lms-station-creator-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
    } else {
      const d = await res.json();
      showToast('خطا در ذخیره‌سازی: ' + (d.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save station error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

window.handleDirectFileUpload = async function(inputElement, targetInputId) {
  if (!inputElement.files || inputElement.files.length === 0) return;
  const file = inputElement.files[0];
  const formData = new FormData();
  formData.append('file', file);
  
  const targetEl = document.getElementById(targetInputId);
  const origPlaceholder = targetEl ? targetEl.placeholder : '';
  if (targetEl) targetEl.placeholder = 'در حال آپلود فایل...';

  try {
    const res = await request('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok && (data.url || data.media?.url)) {
      const fileUrl = data.url || data.media.url;
      if (targetEl) {
        targetEl.value = fileUrl;
      }
      showToast('فایل با موفقیت آپلود شد و لینک در کادر قرار گرفت.', 'success');
    } else {
      showToast('خطا در آپلود: ' + (data.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Direct Upload Error:', err);
    showToast('خطا در ارتباط با سرور برای آپلود فایل', 'error');
  } finally {
    if (targetEl) targetEl.placeholder = origPlaceholder;
  }
};
