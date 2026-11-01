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
    <div id="${blockId}" class="modal-animation-card u-bg-surface-2-70 u-bd-primary-28 u-r-10 u-p-12" data-anim-id="${esc(itemId)}">
      <div class="u-flex u-justify-between u-items-center u-mb-8 u-bb-fg-6 u-pb-6">
        <span class="anim-badge u-bg-primary u-c-white u-p-2-8 u-r-6 u-bold u-fs-11">تصویر ${index}</span>
        <button type="button" data-click="removeGalleryItemCard" data-click-args="${esc(JSON.stringify([String(blockId)]))}" class="u-bg-danger-15 u-c-danger-text u-bd-danger-35 u-r-6 u-p-3-9 u-fs-11 u-pointer">
          <i class="fa-solid fa-trash"></i> حذف
        </button>
      </div>
      <div class="u-flex u-gap-10 u-items-start">
        ${isImage
          ? `<img class="modal-anim-preview u-w-64 u-h-64 u-fit-cover u-r-8 u-bd-border-strong u-bg-surface" src="${esc(url)}" alt="" style="${url ? '' : 'visibility:hidden;'}" data-error="NopaActions.setVisibility" data-error-args="[&quot;$this&quot;,&quot;hidden&quot;]" data-load="NopaActions.setVisibility" data-load-args="[&quot;$this&quot;,&quot;visible&quot;]">`
          : `<div class="u-w-64 u-h-64 u-r-8 u-bd-border-strong u-bg-surface u-flex u-items-center u-justify-center u-c-primary-text" title="ویدیو"><i class="fa-solid fa-film"></i></div>`}
        <div class="u-flex-1 u-flex u-col u-gap-8">
          <input type="text" class="modal-anim-title input-ctrl u-bg-surface-2" value="${esc(title)}" placeholder="عنوان تصویر">
          <div class="u-flex u-gap-6">
            <input type="text" id="${inputId}" class="modal-anim-url input-ctrl u-bg-surface-2 u-direction-ltr u-text-left u-flex-1" value="${esc(url)}" placeholder="https://... یا /uploads/..." data-input="NopaActions.previewSrcIn" data-input-args="[&quot;$this&quot;,&quot;.modal-animation-card&quot;,&quot;.modal-anim-preview&quot;]">
            <label class="u-bg-primary-18 u-bd-primary u-c-primary-text u-p-5-10 u-r-6 u-pointer u-fs-11 u-inline-flex u-items-center u-gap-4 u-nowrap">
              <i class="fa-solid fa-cloud-arrow-up"></i> آپلود تصویر
              <input type="file" accept="image/*" style="display:none;" data-change="handleDirectFileUpload" data-change-args="${esc(JSON.stringify(["$this", String(inputId)]))}">
            </label>
          </div>
          <div class="u-flex u-gap-6">
            <input type="text" id="${inputId}-cover" class="modal-anim-cover input-ctrl u-bg-surface-2 u-direction-ltr u-text-left u-flex-1" value="${esc(data?.coverImageUrl || '')}" placeholder="لینک کاور (فقط برای ویدیو، اختیاری)">
            <label class="u-bg-primary-18 u-bd-primary u-c-primary-text u-p-5-10 u-r-6 u-pointer u-fs-11 u-inline-flex u-items-center u-gap-4 u-nowrap">
              <i class="fa-solid fa-cloud-arrow-up"></i> آپلود کاور
              <input type="file" accept="image/*" style="display:none;" data-change="handleDirectFileUpload" data-change-args="${esc(JSON.stringify(["$this", (String(inputId) + "-cover")]))}">
            </label>
          </div>
          <textarea class="modal-anim-desc input-ctrl u-bg-surface-2" rows="1" placeholder="توضیح (اختیاری)">${esc(desc)}</textarea>
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
    <div id="${blockId}" class="modal-category-card u-bg-surface-2-70 u-r-12 u-p-14 u-shadow-0-4-12-shade-20" data-cat-id="${catData?.id || ''}" style="border: 1px solid ${color}55">
      <div class="u-flex u-justify-between u-items-center u-mb-10 u-bb-fg-6 u-pb-8">
        <h4 class="modal-cat-badge-title u-m-0 u-fs-13_5 u-flex u-items-center u-gap-8" style="color: ${color}">
          <span class="badge u-c-text u-p-3-8 u-r-6 u-bold u-fs-11" style="background: ${badgeBg}">دسته ${catIndex}</span>
          <i class="fa-solid fa-graduation-cap"></i> <span class="cat-label-display">${defaultTitle}</span>
        </h4>
        <button type="button" data-click="removeCategoryBlockFromCreatorModal" data-click-args="${esc(JSON.stringify([String(blockId)]))}" class="u-bg-danger-15 u-c-danger-text u-bd-danger-35 u-r-6 u-p-4-10 u-fs-11 u-pointer u-flex u-items-center u-gap-4" title="حذف این دسته کلاس">
          <i class="fa-solid fa-trash"></i> حذف دسته
        </button>
      </div>

      <div class="u-grid u-cols-2fr-1_8fr-1fr-1fr u-gap-10 u-mb-10">
        <div class="form-group">
          <label class="u-fs-11_5 u-c-text-soft">عنوان دسته کلاس:</label>
          <input type="text" class="modal-cat-title input-ctrl u-bg-surface-2" value="${defaultTitle}" placeholder="مثال: کلاس‌های مهارتی، کارگاه پادکست..." data-input="NopaActions.setTextIn" data-input-args="[&quot;$this&quot;,&quot;.modal-category-card&quot;,&quot;.cat-label-display&quot;]">
        </div>
        <div class="form-group inst-picker-wrapper u-relative">
          <div class="u-flex u-justify-between u-items-center u-mb-4">
            <label class="u-fs-11_5 u-c-text-soft"><i class="fa-solid fa-chalkboard-user u-c-primary-text"></i> استاد / اساتید دوره:</label>
            <a href="javascript:void(0)" data-click="openInstructorModalQuick" data-click-args="${esc(JSON.stringify([String(blockId)]))}" class="u-fs-10 u-c-primary-text u-no-underline u-flex u-items-center u-gap-3" title="افزودن استاد جدید به بانک اساتید"><i class="fa-solid fa-plus-circle"></i> + استاد جدید</a>
          </div>
          <input type="text" class="modal-cat-instructor input-ctrl" value="${esc(defaultInstructor)}" readonly data-click="toggleInstructorDropdown" data-click-args="${esc(JSON.stringify([String(blockId), "$event"]))}" style="display:none;">
          <div id="inst-picker-box-${blockId}" class="inst-picker-box u-bg-surface-2 u-bd-primary-35 u-r-6 u-p-6-10 u-minh-38 u-pointer u-flex u-wrap u-gap-4 u-items-center" data-click="toggleInstructorDropdown" data-click-args="${esc(JSON.stringify([String(blockId), "$event"]))}">
            <!-- Selected badges rendered here -->
          </div>
          <div id="inst-dropdown-${blockId}" class="inst-dropdown-menu u-absolute u-top-100p u-right-0 u-left-0 u-z-z-panel-raised u-bg-surface u-bd-primary-45 u-r-8 u-p-8 u-maxh-220 u-scroll-y u-mt-4" style="display: none; box-shadow: 0 10px 30px rgba(0,0,0,0.7)">
            <!-- Checklist from globalInstructorsList -->
          </div>
        </div>
        <div class="form-group">
          <label class="u-fs-11_5 u-c-text-soft">تعداد جلسات:</label>
          <input type="number" class="modal-cat-sessions input-ctrl u-bg-surface-2" value="${defaultSessions}" min="1" max="50">
        </div>
        <div class="form-group">
          <label class="u-fs-11_5 u-c-primary-text u-bold"><i class="fa-solid fa-film"></i> پارت هر جلسه:</label>
          <input type="number" class="modal-cat-parts input-ctrl u-bg-surface-2" value="${defaultParts}" min="1" max="20" style="border-color: ${color}" title="تعداد پارت‌های ویدیویی در هر جلسه">
        </div>
      </div>

      <div class="u-grid u-cols-2 u-gap-10">
        <div class="form-group">
          <label class="u-fs-11_5 u-c-text-soft">زمان‌بندی برگزاری هفتگی:</label>
          <input type="text" class="modal-cat-schedule input-ctrl u-bg-surface-2" value="${defaultSchedule}" placeholder="مثال: شنبه و دوشنبه">
        </div>
        <div class="form-group">
          <label class="u-fs-11_5 u-c-text-soft"><i class="fa-solid fa-calendar-check"></i> تاریخ شروع این دسته:</label>
          <input type="date" class="modal-cat-date input-ctrl u-c-text u-bg-surface-2" value="${defaultDateStr}">
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
