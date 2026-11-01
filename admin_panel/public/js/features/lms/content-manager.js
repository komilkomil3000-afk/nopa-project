// LMS content manager modal: station info, sessions, video parts (clips), schedules, batch zarik / instructor, final save.
// Split out of the former lms.js (Phase 7).

// ==================== CONTENT MANAGER MODAL (VIDEO LINKS & QUIZZES PER PART) ====================

window.openStationContentManagerModal = function(stationId, filterCat) {
  if (!window.lmsStationsMasterList || window.lmsStationsMasterList.length === 0) return;

  const currentCatFilter = filterCat || document.getElementById('lms-filter-category')?.value || 'all';

  // Flexible Station Finder
  let station = window.lmsStationsMasterList.find(s => 
    s.id === stationId || 
    s.id == stationId || 
    ('MZ' + (s.orderIndex ?? s.index)) === stationId || 
    s.orderIndex == stationId
  );

  if (!station) {
    const idxNum = parseInt(String(stationId).replace(/\D/g, ''));
    if (idxNum && idxNum > 0 && idxNum <= window.lmsStationsMasterList.length) {
      station = window.lmsStationsMasterList[idxNum - 1];
    } else {
      station = window.lmsStationsMasterList[0];
    }
  }

  if (!station) return;

  window.currentActiveContentStationId = station.id;

  const modal = document.getElementById('lms-content-manager-modal');
  if (!modal) return;

  const PERSIAN_NUMS = ['صفر', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const stationIdx = station.orderIndex ?? 1;
  const simpleStationName = PERSIAN_NUMS[stationIdx] ? `منزلگاه ${PERSIAN_NUMS[stationIdx]}` : `منزلگاه ${stationIdx}`;

  let filterTitleSuffix = '';
  if (currentCatFilter === 'مهارتی' || currentCatFilter === 'skill') {
    filterTitleSuffix = ' <span class="u-fs-12 u-c-primary-text u-fw-normal u-bg-primary-20 u-p-2-8 u-r-10 u-mr-6">(فقط کلاس‌های مهارتی)</span>';
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    filterTitleSuffix = ' <span class="u-fs-12 u-c-primary-text u-fw-normal u-bg-primary-20 u-p-2-8 u-r-10 u-mr-6">(فقط کلاس‌های رسانه‌ای)</span>';
  }

  const titleEl = document.getElementById('lms-content-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-film u-c-primary-text"></i> مدیریت پارت‌ها، ویدیوها و آزمونک‌های ${simpleStationName}${filterTitleSuffix}`;
  }

  const container = document.getElementById('lms-content-modal-body');
  if (!container) return;

  if (!window.getCurriculumSessionDate) {
    window.getCurriculumSessionDate = function(stNum, isMedia, sessNum) {
      const key = `${stNum}_${isMedia ? 'media' : 'skill'}_${sessNum}`;
      const map = {
        '1_media_1': { date: '1405/07/02', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '1_media_2': { date: '1405/07/03', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '1_skill_1': { date: '1405/07/05', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '1_skill_2': { date: '1405/07/07', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_skill_1': { date: '1405/07/06', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_skill_2': { date: '1405/07/08', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_media_1': { date: '1405/07/09', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_media_2': { date: '1405/07/10', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_skill_3': { date: '1405/07/13', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_skill_4': { date: '1405/07/15', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_media_3': { date: '1405/07/16', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_media_4': { date: '1405/07/17', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_skill_5': { date: '1405/07/20', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_skill_6': { date: '1405/07/22', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_media_5': { date: '1405/07/23', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_media_6': { date: '1405/07/24', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_skill_7': { date: '1405/07/27', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_skill_8': { date: '1405/07/29', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '2_media_7': { date: '1405/07/30', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '2_media_8': { date: '1405/07/31', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '3_skill_1': { date: '1405/08/03', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '3_skill_2': { date: '1405/08/05', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '3_media_1': { date: '1405/08/06', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '3_media_2': { date: '1405/08/07', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '3_skill_3': { date: '1405/08/10', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '3_skill_4': { date: '1405/08/12', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '3_media_3': { date: '1405/08/13', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '3_media_4': { date: '1405/08/14', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '3_skill_5': { date: '1405/08/17', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '3_skill_6': { date: '1405/08/19', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '3_media_5': { date: '1405/08/20', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '3_media_6': { date: '1405/08/21', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '4_skill_1': { date: '1405/09/01', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '4_skill_2': { date: '1405/09/03', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '4_media_1': { date: '1405/09/04', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '4_media_2': { date: '1405/09/05', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '4_skill_3': { date: '1405/09/08', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '4_skill_4': { date: '1405/09/10', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '4_media_3': { date: '1405/09/11', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '4_media_4': { date: '1405/09/12', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '5_skill_1': { date: '1405/09/15', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '5_skill_2': { date: '1405/09/16', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '5_skill_3': { date: '1405/09/17', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '5_media_1': { date: '1405/09/18', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '5_media_2': { date: '1405/09/19', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '5_skill_4': { date: '1405/09/22', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '5_media_3': { date: '1405/09/22', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '5_media_4': { date: '1405/09/23', time: '۱۸:۰۰ الی ۱۹:۳۰' },
        '5_skill_5': { date: '1405/09/24', time: '۱۶:۰۰ الی ۱۷:۳۰' },
        '5_media_5': { date: '1405/09/24', time: '۱۸:۰۰ الی ۱۹:۳۰' }
      };
      return map[key] || { date: '1405/07/02', time: isMedia ? '۱۸:۰۰ الی ۱۹:۳۰' : '۱۶:۰۰ الی ۱۷:۳۰' };
    };
  }

  let releaseDateStr = '';
  if (station.releaseDate) {
    try {
      releaseDateStr = new Date(station.releaseDate).toISOString().split('T')[0];
    } catch (e) {}
  }

  window.lmsInitialModalState = {
    title: simpleStationName,
    date: releaseDateStr,
    desc: station.description || ''
  };

  let categories = station.categories || [];

  // Filter categories according to selected category filter
  if (currentCatFilter === 'مهارتی' || currentCatFilter === 'skill') {
    categories = categories.filter(c => c.orderIndex === 1 || (c.title && c.title.includes('مهارت')));
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    categories = categories.filter(c => c.orderIndex === 2 || (c.title && c.title.includes('رسانه')));
  }

  // --- SECTION 1: STATION BASIC INFO & CONTENT EDITOR CARD ---
  let html = `
    <div class="u-bg-surface-95 u-bd-primary-35 u-r-12 u-p-16 u-mb-20 u-shadow-0-4-15-shade-30">
      <div class="u-flex u-justify-between u-items-center u-mb-12 u-bb-fg-8 u-pb-8">
        <div class="u-fs-14 u-bold u-c-primary-text u-flex u-items-center u-gap-8">
          <i class="fa-solid fa-pen-to-square"></i> مشخصات، عنوان و محتوای ${simpleStationName}
        </div>
        <span class="badge u-bg-primary u-c-white u-p-4-12 u-r-6 u-fs-12 u-bold">
          کد: MZ${stationIdx} (${simpleStationName})
        </span>
      </div>

      <div class="u-grid u-cols-120-1_8fr-1_2fr u-gap-12 u-mb-12">
        <div>
          <label class="u-fs-11 u-c-text-soft u-block u-mb-4"><i class="fa-solid fa-hashtag u-c-primary-text"></i> شماره منزلگاه:</label>
          <input type="number" id="content-modal-st-order" class="input-ctrl u-bg-surface u-bdc-border-strong u-c-primary-text u-bold u-cursor-not-allowed u-text-center" value="${stationIdx}" readonly title="شماره منزلگاه یکتاست. برای جابجایی ترتیب از دکمه مرتب‌سازی منزلگاه‌ها استفاده فرمایید.">
        </div>
        <div>
          <label class="u-fs-11 u-c-text-soft u-block u-mb-4"><i class="fa-solid fa-graduation-cap u-c-primary-text"></i> نام و عنوان منزلگاه:</label>
          <input type="text" id="content-modal-st-title" class="input-ctrl u-bg-surface u-bdc-border-strong u-bold u-c-text" value="${simpleStationName}" placeholder="عنوان منزلگاه...">
        </div>
        <div>
          <label class="u-fs-11 u-c-text-soft u-block u-mb-4"><i class="fa-solid fa-calendar-days u-c-primary-text"></i> تاریخ انتشار تقویم:</label>
          <input type="date" id="content-modal-st-date" class="input-ctrl u-bg-surface u-c-text u-bdc-border-strong" value="${releaseDateStr}">
        </div>
      </div>

      <div class="u-grid u-cols-1fr-2_5fr u-gap-12 u-mb-12">
        <div>
          <label class="u-fs-11 u-c-text-soft u-block u-mb-4"><i class="fa-solid fa-hourglass-half u-c-primary-text"></i> مدت اقامت در منزلگاه:</label>
          <input type="text" id="content-modal-st-duration" class="input-ctrl u-bg-surface u-bdc-border-strong u-c-text" value="${station.stayDuration || ''}" placeholder="مثال: ۲ هفته یا ۱۴ روز">
        </div>
        <div>
          <label class="u-fs-11 u-c-text-soft u-block u-mb-4"><i class="fa-solid fa-image u-c-primary-text"></i> تصویر منزلگاه (در صفحه اول، آموزگاه و منزلگاه یکسان نمایش داده می‌شود):</label>
          <div class="u-flex u-gap-6 u-items-center">
            <img id="content-modal-st-icon-preview" src="${esc(station.iconUrl || '')}" alt="" class="u-w-44 u-h-62 u-fit-cover u-r-6 u-bd-border-strong u-bg-surface" style="${station.iconUrl ? '' : 'visibility:hidden;'}" data-error="NopaActions.setVisibility" data-error-args="[&quot;$this&quot;,&quot;hidden&quot;]" data-load="NopaActions.setVisibility" data-load-args="[&quot;$this&quot;,&quot;visible&quot;]">
            <input type="text" id="content-modal-st-icon" class="input-ctrl u-bg-surface u-bdc-border-strong u-c-text u-direction-ltr u-text-left u-flex-1" value="${esc(station.iconUrl || '')}" placeholder="https://... یا /uploads/..." data-input="NopaActions.previewSrc" data-input-args="[&quot;content-modal-st-icon-preview&quot;,&quot;$value&quot;]">
            <label class="u-bg-primary-18 u-bd-primary u-c-primary-text u-p-6-10 u-r-6 u-pointer u-fs-11 u-inline-flex u-items-center u-gap-4 u-nowrap" title="آپلود تصویر منزلگاه">
              <i class="fa-solid fa-cloud-arrow-up"></i> آپلود تصویر
              <input type="file" accept="image/*" style="display:none;" data-change="handleDirectFileUpload" data-change-args="[&quot;$this&quot;,&quot;content-modal-st-icon&quot;]">
            </label>
          </div>
        </div>
      </div>

      <!-- نگارستان منزلگاه -->
      <div class="u-bg-surface-70 u-bd-primary-28 u-r-10 u-p-12 u-mb-12">
        <div class="u-flex u-justify-between u-items-center u-mb-10">
          <div class="u-fs-12_5 u-bold u-c-primary-text"><i class="fa-solid fa-images"></i> نگارستان منزلگاه</div>
          <button type="button" data-click="addGalleryItemCard" data-click-args="[&quot;content-modal-gallery-container&quot;]" class="u-bg-grad-primary u-c-white u-bd-none u-p-5-12 u-r-7 u-fs-11_5 u-bold u-pointer">
            <i class="fa-solid fa-plus"></i> افزودن تصویر به نگارستان
          </button>
        </div>
        <div id="content-modal-gallery-container" class="u-flex u-col u-gap-10"></div>
      </div>

      <div class="u-mb-12">
        <label class="u-fs-11 u-c-text-soft u-block u-mb-4"><i class="fa-solid fa-align-right u-c-primary-text"></i> متن معرفی، داستان و سرفصل‌های کلی منزلگاه:</label>
        <textarea id="content-modal-st-desc" class="input-ctrl u-bg-surface u-bdc-border-strong" rows="3" placeholder="توضیحات، داستان، اهداف و سرفصل‌های آموزشی این منزلگاه...">${esc(station.description || '')}</textarea>
      </div>

      <div class="u-flex u-justify-end">
        <button type="button" data-click="saveStationBasicInfoFromContentModal" data-click-args="${esc(JSON.stringify([String(station.id)]))}" class="u-bg-grad-primary u-c-white u-bd-none u-r-8 u-p-8-20 u-fs-12 u-bold u-pointer u-flex u-items-center u-gap-6 u-shadow-0-2-6-shade-30">
          <i class="fa-solid fa-check"></i> ذخیره تغییرات نام و محتوای منزلگاه
        </button>
      </div>
    </div>
  `;

  if (categories.length === 0) {
    html += '<div class="u-text-center u-c-text-muted u-p-20">هیچ دسته‌بندی با این فیلتر برای این منزلگاه پیدا نشد.</div>';
    container.innerHTML = html;
    window.fillGalleryFromStation('content-modal-gallery-container', station);
    modal.style.display = 'flex';
    modal.style.zIndex = 'var(--z-modal)';
    return;
  }

  // --- SECTION 2: CATEGORIES, SESSIONS, VIDEO CLIPS (WITH REORDER) & QUIZZES ---
  categories.forEach(cat => {
    const isSkill = cat.orderIndex === 1 || (cat.title && cat.title.includes('مهارت'));
    const color = isSkill ? 'var(--info-text)' : 'var(--primary-text)';
    const bg = isSkill ? 'rgb(var(--info-rgb) / 0.12)' : 'rgb(var(--primary-rgb) / 0.12)';
    const sessions = cat.sessions || [];

    html += `
      <div class="u-r-12 u-p-16 u-mb-20" style="background:${bg}; border:1px solid ${color}44">
        
        <!-- Editable Category Header & Controls -->
        <div class="u-m-0-0-14-0 u-bg-surface-85 u-r-10 u-p-12-14 u-flex u-items-center u-justify-between u-wrap u-gap-12" style="border:1px solid ${color}55">
          <div class="u-flex u-items-center u-gap-10 u-flex-1 u-minw-280">
            <span class="badge u-c-white u-p-5-10 u-r-6 u-fs-12 u-bold u-nowrap" style="background:${isSkill ? 'var(--primary)' : 'var(--primary-strong)'}">
              ${isSkill ? 'دسته ۱ (مهارتی)' : 'دسته ۲ (رسانه‌ای)'}
            </span>
            <div class="u-flex-1 u-flex u-items-center u-gap-6">
              <label class="u-fs-11 u-c-text-soft u-nowrap"><i class="fa-solid fa-pen" style="color:${color};"></i> عنوان دسته کلاس:</label>
              <input type="text" id="cat-title-${cat.id}" class="input-ctrl u-bg-surface u-c-text u-bold u-fs-13 u-p-6-12" value="${esc(cat.title || (isSkill ? 'کلاس‌های مهارتی' : 'کلاس‌های رسانه‌ای'))}" placeholder="عنوان دسته کلاس..." style="border-color:${color}66">
            </div>
          </div>
          
          <div class="u-flex u-items-center u-gap-8">
            <span class="u-fs-12 u-c-text-soft u-bg-shade-40 u-p-5-12 u-r-6 u-bd-fg-6 u-bold">
              ${sessions.length} جلسه
            </span>
            <button type="button" data-click="saveCategoryTitle" data-click-args="${esc(JSON.stringify([String(cat.id), String(station.id)]))}" class="u-c-white u-bd-none u-p-6-14 u-r-6 u-fs-11 u-bold u-pointer u-flex u-items-center u-gap-6 u-shadow-0-2-6-shade-30" style="background:linear-gradient(135deg, ${color}, ${isSkill ? 'var(--primary)' : 'var(--primary-strong)'})" title="ذخیره مستقیم عنوان این دسته">
              <i class="fa-solid fa-save"></i> ذخیره عنوان دسته
            </button>
          </div>
        </div>

        <!-- Quick Batch Instructor Allocation Tool for this entire Category -->
        <div class="u-bg-primary-8 u-bd-1-dashed-primary-40 u-r-8 u-p-10-14 u-mb-12 u-flex u-justify-between u-items-center u-wrap u-gap-10">
          <div class="u-flex u-items-center u-gap-8">
            <i class="fa-solid fa-chalkboard-user u-c-primary-text u-fs-18"></i>
            <div>
              <div class="u-bold u-c-primary-text u-fs-12">تغییر و تخصیص یکجای استاد/مدرس برای تمام جلسات این دسته:</div>
              <div class="u-fs-11 u-c-text-muted">با یک کلیک، نام مدرس برای تمامی ${sessions.length} جلسه این دسته‌بندی به‌صورت یکپارچه به‌روزرسانی می‌شود.</div>
            </div>
          </div>
          <div class="u-flex u-items-center u-gap-8">
            <label class="u-fs-11 u-c-text-soft">انتخاب از بانک اساتید:</label>
            <select id="batch-instructor-cat-${cat.id}" class="input-ctrl u-w-170 u-p-5-8 u-bg-surface u-bdc-primary u-c-text u-fs-12 u-bold">
              ${(window.globalInstructorsList || []).map(i => `<option value="${esc(i.name)}">${esc(i.name)} (${esc(i.degree || 'مدرس')})</option>`).join('')}
              ${(!window.globalInstructorsList || window.globalInstructorsList.length === 0) ? `<option value="علیرضا خوش‌منظر">علیرضا خوش‌منظر</option><option value="پیراینه‌گر">پیراینه‌گر</option>` : ''}
            </select>
            <button type="button" data-click="applyBatchInstructorToCategory" data-click-args="${esc(JSON.stringify([String(cat.id), String(station.id)]))}" class="u-bg-grad-primary u-c-white u-bold u-bd-none u-p-6-14 u-r-6 u-fs-11 u-pointer u-flex u-items-center u-gap-6 u-shadow-0-2-6-shade-30">
              <i class="fa-solid fa-user-pen"></i> اعمال روی کل جلسات
            </button>
          </div>
        </div>

        <!-- Quick Batch Zarik Allocation Tool for this entire Category -->
        <div class="u-bg-accent-9 u-bd-1-dashed-accent-40 u-r-8 u-p-10-14 u-mb-14 u-flex u-justify-between u-items-center u-wrap u-gap-10">
          <div class="u-flex u-items-center u-gap-8">
            <i class="fa-solid fa-coins u-c-accent-text u-fs-18"></i>
            <div>
              <div class="u-bold u-c-accent-text u-fs-12">تخصیص یکجای پاداش زریک برای تمام پارت‌ها و آزمونک‌های این دسته:</div>
              <div class="u-fs-11 u-c-text-muted">با یک کلیک، پاداش تمامی آزمونک‌های این دسته تعیین شده و پس از پاسخ صحیح به دانش‌آموز اعطا می‌گردد.</div>
            </div>
          </div>
          <div class="u-flex u-items-center u-gap-8">
            <label class="u-fs-11 u-c-text-soft">پاداش هر پارت:</label>
            <input type="number" id="batch-zarik-cat-${cat.id}" class="input-ctrl u-w-65 u-p-5-6 u-text-center u-bg-surface u-bdc-accent u-c-accent-text u-bold u-fs-12" value="15" min="1" max="1000">
            <button type="button" data-click="applyBatchZarikToCategory" data-click-args="${esc(JSON.stringify([String(cat.id), String(station.id)]))}" class="u-bg-grad-accent u-c-black u-bold u-bd-none u-p-6-12 u-r-6 u-fs-11 u-pointer u-flex u-items-center u-gap-6">
              <i class="fa-solid fa-bolt"></i> اعمال روی کل این دسته
            </button>
          </div>
        </div>
    `;

    if (sessions.length === 0) {
      html += '<div class="u-c-text-soft u-fs-12 u-p-10">جلسه‌ای در این دسته ثبت نشده است.</div>';
    } else {
      sessions.forEach((sess, sIdx) => {
        const clips = (sess.videoClips || []).sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0));
        const quizzes = sess.quizzes || [];

        const sessOrder = sess.orderIndex || (sIdx + 1);
        const curFallback = window.getCurriculumSessionDate ? window.getCurriculumSessionDate(stationIdx, !isSkill, sessOrder) : { date: '1405/07/02', time: isSkill ? '۱۶:۰۰ الی ۱۷:۳۰' : '۱۸:۰۰ الی ۱۹:۳۰' };
        const sessDate = sess.sessionDate || curFallback.date;
        const sessTime = sess.sessionTime || curFallback.time;

        html += `
          <div class="u-bg-surface-90 u-bd-fg-10 u-r-12 u-p-14 u-mb-16 u-shadow-0-4-12-shade-25">
            
            <!-- Session Top Header with Glowing Date Badge -->
            <div class="u-flex u-justify-between u-items-center u-mb-12 u-bb-fg-8 u-pb-10 u-wrap u-gap-10">
              <div class="u-flex u-items-center u-gap-8">
                <span class="badge u-c-white u-p-4-10 u-r-6 u-fs-11 u-bold" style="background:${isSkill ? 'var(--primary)' : 'var(--primary-strong)'}">
                  جلسه ${sessOrder}
                </span>
                <span class="u-fs-13 u-bold u-c-text">
                  ${sess.title || `جلسه ${sessOrder}`}
                </span>
              </div>
              
              <!-- Prominent Date & Time Badge right next to the session -->
              <div class="u-flex u-items-center u-gap-8 u-wrap">
                <div class="u-bg-accent-15 u-bd-accent-40 u-p-4-10 u-r-8 u-fs-12 u-c-accent-text u-bold u-flex u-items-center u-gap-6">
                  <i class="fa-solid fa-calendar-day"></i>
                  <span>تاریخ کلاس:</span>
                  <span id="badge-sess-date-${sess.id}">${sessDate}</span>
                </div>
                <div class="u-bg-primary-15 u-bd-primary-40 u-p-4-10 u-r-8 u-fs-12 u-c-primary-text u-bold u-flex u-items-center u-gap-6">
                  <i class="fa-solid fa-clock"></i>
                  <span>ساعت:</span>
                  <span id="badge-sess-time-${sess.id}">${sessTime}</span>
                </div>
                <span class="u-fs-11 u-c-text-muted u-bg-fg-5 u-p-4-8 u-r-6">
                  ${clips.length} پارت ویدیو | ${quizzes.length} آزمونک
                </span>
              </div>
            </div>

            <!-- Session Controls & Editable Fields Grid -->
            <div class="u-grid u-cols-1_2fr-1fr-1fr-1fr-auto u-gap-10 u-items-end u-mb-12 u-bg-shade-30 u-p-12 u-r-10 u-bd-fg-5">
              <div>
                <label class="u-fs-11 u-c-text-soft u-block u-mb-4 u-bold">
                  <i class="fa-solid fa-book-open" style="color:${color};"></i> عنوان کلاس/جلسه:
                </label>
                <input type="text" id="sess-title-${sess.id}" class="input-ctrl u-fs-12 u-bold u-c-text u-bg-surface u-p-7-10" value="${sess.title || `جلسه ${sessOrder}`}" placeholder="عنوان جلسه..." style="border-color:${color}55">
              </div>

              <div>
                <label class="u-fs-11 u-c-primary-text u-block u-mb-4 u-bold">
                  <i class="fa-solid fa-chalkboard-user"></i> استاد / مدرس:
                </label>
                <select id="sess-instructor-${sess.id}" class="input-ctrl u-fs-12 u-c-primary-text u-bg-surface u-p-7-10 u-bold u-bdc-primary-40">
                  ${(window.globalInstructorsList || []).map(i => `<option value="${esc(i.name)}" ${(sess.instructor && sess.instructor.includes(i.name)) ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
                  ${(!window.globalInstructorsList || window.globalInstructorsList.length === 0) ? `<option value="${sess.instructor || (isSkill ? 'پیراینه‌گر' : 'علیرضا خوش‌منظر')}">${sess.instructor || (isSkill ? 'پیراینه‌گر' : 'علیرضا خوش‌منظر')}</option>` : ''}
                </select>
              </div>

              <div>
                <label class="u-fs-11 u-c-accent-text u-block u-mb-4 u-bold">
                  <i class="fa-solid fa-calendar-day"></i> تاریخ برگزاری (شمسی):
                </label>
                <input type="text" id="sess-date-${sess.id}" class="input-ctrl u-fs-12 u-c-accent-text u-bg-surface u-p-7-10 u-bold u-bdc-accent-50 u-text-center" value="${sessDate}" placeholder="مثال: ۱۴۰۵/۰۷/۰۲" data-input="NopaActions.setTextById" data-input-args="${esc(JSON.stringify(['badge-sess-date-' + sess.id, '$value']))}">
              </div>

              <div>
                <label class="u-fs-11 u-c-primary-text u-block u-mb-4 u-bold">
                  <i class="fa-solid fa-clock"></i> زمان و ساعت کلاس:
                </label>
                <input type="text" id="sess-time-${sess.id}" class="input-ctrl u-fs-12 u-c-primary-text u-bg-surface u-p-7-10 u-bold u-bdc-primary-50 u-text-center" value="${sessTime}" placeholder="مثال: ۱۸:۰۰ الی ۱۹:۳۰" data-input="NopaActions.setTextById" data-input-args="${esc(JSON.stringify(['badge-sess-time-' + sess.id, '$value']))}">
              </div>

              <div class="u-flex u-gap-6">
                <button type="button" class="u-bg-grad-success u-c-white u-bd-none u-r-6 u-p-8-14 u-fs-11 u-bold u-pointer u-flex u-items-center u-gap-5 u-shadow-0-2-5-shade-30 u-nowrap" data-click="saveSessionDetails" data-click-args="${esc(JSON.stringify([String(sess.id), String(station.id)]))}" title="ذخیره مستقیم تغییرات این کلاس و تاریخ آن">
                  <i class="fa-solid fa-floppy-disk"></i> ذخیره تاریخ و مشخصات
                </button>
                <button type="button" class="u-bg-primary u-c-white u-bd-none u-r-6 u-p-8-12 u-fs-11 u-pointer u-bold u-flex u-items-center u-gap-4 u-nowrap" data-click="addNewClipToSession" data-click-args="${esc(JSON.stringify([String(sess.id)]))}" title="افزودن پارت ویدیویی جدید به این کلاس">
                  <i class="fa-solid fa-plus"></i> پارت جدید
                </button>
              </div>
            </div>

            <!-- Video Clips List & Link Editor with Order Adjustment -->
            <div class="u-mb-10">
              <div class="u-fs-12 u-c-primary-text u-bold u-mb-8 u-flex u-items-center u-gap-6">
                <i class="fa-solid fa-film"></i> پارت‌های ویدیویی این جلسه (امکان جابجایی ترتیب با دکمه‌های بالا/پایین، ویرایش لینک و آزمونک):
              </div>
        `;

        if (clips.length === 0) {
          html += `
            <div class="u-c-text-muted u-fs-12 u-bg-shade-20 u-p-10 u-r-6 u-text-center">
              پارتی برای این جلسه تعریف نشده است. 
              <button type="button" class="u-bg-primary u-c-white u-bd-none u-r-4 u-p-4-10 u-fs-11 u-mr-8 u-pointer" data-click="addNewClipToSession" data-click-args="${esc(JSON.stringify([String(sess.id)]))}">+ ایجاد اولین پارت</button>
            </div>`;
        } else {
          clips.forEach((clip, cIdx) => {
            const isFirstClip = cIdx === 0;
            const isLastClip = cIdx === clips.length - 1;

            let clipUnlockDate = clip.unlockDate || '';
            let clipUnlockTime = clip.unlockTime || '';
            if (!clipUnlockDate && clip.scheduledUnlockTime) {
              try {
                const dt = new Date(clip.scheduledUnlockTime);
                clipUnlockDate = dt.toISOString().split('T')[0];
                clipUnlockTime = dt.toTimeString().substring(0, 5);
              } catch (_) {}
            }

            html += `
              <div class="u-bg-surface-2-90 u-bd-fg-8 u-r-8 u-p-12 u-mb-10">
                <div class="u-grid u-cols-85-1_4fr-2fr-auto u-gap-10 u-items-center u-mb-8">
                  
                  <!-- Part Order with Up/Down Buttons -->
                  <div>
                    <label class="u-fs-11 u-c-primary-text u-block u-mb-3 u-bold">ترتیب پارت:</label>
                    <div class="u-flex u-items-center u-gap-4">
                      <input type="number" id="clip-order-${clip.id}" min="1" max="50" class="input-ctrl u-fs-12 u-p-4 u-text-center u-bg-surface u-bold u-c-primary-text u-w-45" value="${clip.clipOrder || (cIdx + 1)}">
                      <div class="u-flex u-col u-gap-2">
                        <button type="button" data-click="moveClipInSession" data-click-args="${esc(JSON.stringify([String(sess.id), (cIdx), (cIdx - 1)]))}" ${isFirstClip ? 'disabled' : ''} class="u-r-3 u-w-20 u-h-15 u-fs-9 u-flex u-items-center u-justify-center" style="background:${isFirstClip ? 'rgb(var(--fg-rgb) / 0.03)' : 'var(--surface-2)'}; color:${isFirstClip ? 'var(--text-faint)' : 'var(--primary)'}; border:1px solid ${isFirstClip ? 'transparent' : 'rgb(var(--primary-rgb) / 0.3)'}; cursor:${isFirstClip ? 'not-allowed' : 'pointer'}" title="حرکت به بالا">▲</button>
                        <button type="button" data-click="moveClipInSession" data-click-args="${esc(JSON.stringify([String(sess.id), (cIdx), (cIdx + 1)]))}" ${isLastClip ? 'disabled' : ''} class="u-r-3 u-w-20 u-h-15 u-fs-9 u-flex u-items-center u-justify-center" style="background:${isLastClip ? 'rgb(var(--fg-rgb) / 0.03)' : 'var(--surface-2)'}; color:${isLastClip ? 'var(--text-faint)' : 'var(--primary)'}; border:1px solid ${isLastClip ? 'transparent' : 'rgb(var(--primary-rgb) / 0.3)'}; cursor:${isLastClip ? 'not-allowed' : 'pointer'}" title="حرکت به پایین">▼</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="u-fs-11 u-c-text-soft u-block u-mb-3">عنوان پارت:</label>
                    <input type="text" id="clip-title-${clip.id}" class="input-ctrl u-fs-12 u-p-6-10 u-bg-surface" value="${esc(clip.title || '')}" placeholder="عنوان پارت...">
                  </div>
                  <div>
                    <label class="u-fs-11 u-c-primary-text u-block u-mb-3"><i class="fa-solid fa-video"></i> لینک ویدیو (آپارات یا URL مستقیم):</label>
                    <input type="text" id="clip-url-${clip.id}" class="input-ctrl u-fs-12 u-p-6-10 u-direction-ltr u-bg-surface" value="${esc(clip.videoUrl || '')}" placeholder="https://www.aparat.com/v/...">
                  </div>
                  <div>
                    <label class="u-fs-11 u-c-primary-text u-block u-mb-3"><i class="fa-solid fa-image"></i> لینک کاور (پیش‌نمایش ویدیو در اپلیکیشن):</label>
                    <div class="u-flex u-gap-6 u-items-center">
                      <img id="clip-cover-preview-${clip.id}" src="${esc(clip.coverImageUrl || '')}" alt="" class="u-w-46 u-h-30 u-fit-cover u-r-4 u-bd-border-strong u-bg-surface" style="${clip.coverImageUrl ? '' : 'visibility:hidden;'}" data-error="NopaActions.setVisibility" data-error-args="[&quot;$this&quot;,&quot;hidden&quot;]" data-load="NopaActions.setVisibility" data-load-args="[&quot;$this&quot;,&quot;visible&quot;]">
                      <input type="text" id="clip-cover-${clip.id}" class="input-ctrl u-fs-12 u-p-6-10 u-direction-ltr u-bg-surface u-flex-1" value="${esc(clip.coverImageUrl || '')}" placeholder="https://... یا /uploads/... (اختیاری)" data-input="NopaActions.previewSrc" data-input-args="${esc(JSON.stringify(['clip-cover-preview-' + clip.id, '$value']))}">
                      <label class="u-bg-primary-18 u-bd-primary u-c-primary-text u-p-5-9 u-r-6 u-pointer u-fs-11 u-nowrap" title="آپلود تصویر کاور">
                        <i class="fa-solid fa-cloud-arrow-up"></i> آپلود
                        <input type="file" accept="image/*" style="display:none;" data-change="handleDirectFileUpload" data-change-args="${esc(JSON.stringify(["$this", ("clip-cover-" + String(clip.id))]))}">
                      </label>
                    </div>
                  </div>
                  <div class="u-flex u-gap-6 u-items-end u-pt-16">
                    <button type="button" class="u-bg-primary u-c-white u-bd-none u-r-6 u-p-7-12 u-fs-11 u-pointer" data-click="saveClipVideoUrl" data-click-args="${esc(JSON.stringify([String(sess.id), String(clip.id)]))}" title="ذخیره ترتیب، عنوان و لینک ویدیو">
                      <i class="fa-solid fa-save"></i> ذخیره
                    </button>
                    <button type="button" class="u-bg-success u-c-white u-bd-none u-r-6 u-p-7-12 u-fs-11 u-pointer" data-click="openQuizModalForClip" data-click-args="${esc(JSON.stringify([String(sess.id), String(clip.id)]))}" title="افزودن آزمونک برای این پارت">
                      <i class="fa-solid fa-circle-question"></i> + آزمونک
                    </button>
                    <button type="button" class="u-bg-danger-20 u-c-danger-text u-bd-danger-40 u-r-6 u-p-7-10 u-fs-11 u-pointer" data-click="deleteClipRecord" data-click-args="${esc(JSON.stringify([String(clip.id), String(sess.id)]))}" title="حذف این پارت">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>

                <!-- Section: Part Unlock / Schedule Settings (تنظیمات باز شدن پارت) -->
                <div class="u-bg-surface-70 u-bd-primary-25 u-r-8 u-p-10-14 u-mt-8 u-mb-10 u-flex u-justify-between u-items-center u-wrap u-gap-12">
                  <div class="u-flex u-items-center u-gap-10">
                    <div class="u-w-34 u-h-34 u-r-8 u-bg-primary-15 u-flex u-items-center u-justify-center u-c-primary-text u-fs-15 u-bd-primary-30">
                      <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div>
                      <div class="u-fs-12 u-bold u-c-primary-text u-flex u-items-center u-gap-8">
                        <span>تنظیمات باز شدن پارت ${clip.clipOrder || (cIdx + 1)}:</span>
                        <span id="clip-status-badge-${clip.id}" class="badge"></span>
                      </div>
                      <div class="u-fs-11 u-c-text-muted u-mt-2">
                        تعیین تاریخ و ساعت بازگشایی و در دسترس قرار گرفتن این پارت
                      </div>
                    </div>
                  </div>

                  <div class="u-flex u-items-center u-gap-10 u-wrap">
                    <!-- Date input -->
                    <div class="u-flex u-items-center u-gap-6">
                      <label class="u-fs-11 u-c-accent-text u-nowrap u-bold">
                        <i class="fa-solid fa-calendar-day"></i> تاریخ باز شدن:
                      </label>
                      <input type="date" id="clip-unlock-date-${clip.id}" class="input-ctrl u-fs-12 u-p-6-10 u-bg-surface u-c-accent-text u-bdc-accent-45 u-r-6 u-w-135" value="${clipUnlockDate}" data-change="updateClipScheduleBadge" data-change-args="${esc(JSON.stringify([String(clip.id)]))}" title="تاریخ باز شدن پارت">
                    </div>

                    <!-- Time input -->
                    <div class="u-flex u-items-center u-gap-6">
                      <label class="u-fs-11 u-c-primary-text u-nowrap u-bold">
                        <i class="fa-regular fa-clock"></i> ساعت باز شدن:
                      </label>
                      <input type="time" id="clip-unlock-time-${clip.id}" class="input-ctrl u-fs-12 u-p-6-10 u-bg-surface u-c-primary-text u-bdc-primary-45 u-r-6 u-w-100" value="${clipUnlockTime || '00:00'}" data-change="updateClipScheduleBadge" data-change-args="${esc(JSON.stringify([String(clip.id)]))}" title="ساعت باز شدن پارت">
                    </div>

                    <!-- Quick buttons -->
                    <div class="u-flex u-gap-5">
                      <button type="button" data-click="setClipScheduleFromSession" data-click-args="${esc(JSON.stringify([String(clip.id), String(sess.id)]))}" class="u-bg-primary-15 u-bd-primary-40 u-c-primary-text u-r-6 u-p-6-10 u-fs-11 u-pointer u-bold" title="تنظیم خودکار تاریخ بر اساس تقویم جلسه">
                        <i class="fa-solid fa-calendar-check"></i> تاریخ جلسه
                      </button>
                      <button type="button" data-click="clearClipSchedule" data-click-args="${esc(JSON.stringify([String(clip.id)]))}" class="u-bg-fg-5 u-bd-fg-15 u-c-text-soft u-r-6 u-p-6-10 u-fs-11 u-pointer" title="بدون محدودیت زمان‌بندی (همیشه باز)">
                        <i class="fa-solid fa-unlock"></i> همیشه باز
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Per-Part Quiz Inspector & Manager -->
                <div class="u-bg-surface-75 u-br-3-solid-accent u-p-10-14 u-mt-10 u-r-8 u-bd-accent-20">
                  <div class="u-flex u-justify-between u-items-center u-mb-8">
                    <div class="u-fs-12 u-c-accent-text u-bold u-flex u-items-center u-gap-6">
                      <i class="fa-solid fa-circle-question"></i> آزمونک‌های تستی انتهای پارت ${clip.clipOrder || (cIdx + 1)}:
                    </div>
                    <button type="button" class="u-bg-accent u-c-black u-bd-none u-p-4-10 u-r-6 u-fs-11 u-bold u-pointer u-flex u-items-center u-gap-4" data-click="openQuizModalForClip" data-click-args="${esc(JSON.stringify([String(sess.id), String(clip.id)]))}">
                      <i class="fa-solid fa-plus"></i> + طراحی آزمونک جدید برای این پارت
                    </button>
                  </div>
            `;

            const allSessionQuizzes = sess.quizzes || [];
            const clipQuizzes = (clip.quizzes && clip.quizzes.length > 0)
              ? clip.quizzes
              : allSessionQuizzes.filter(q => q.clipId === clip.id || (!q.clipId && q.orderIndex === (clip.clipOrder || cIdx + 1)));

            if (clipQuizzes.length === 0) {
              html += `
                <div class="u-fs-11 u-c-text-muted u-bg-shade-20 u-p-8-12 u-r-6">
                  هنوز آزمونکی برای پایان این پارت ثبت نشده است. با زدن دکمه «+ طراحی آزمونک جدید» می‌توانید سوال، گزینه‌ها و پاداش زریک این پارت را تنظیم نمایید.
                </div>`;
            } else {
              clipQuizzes.forEach((quiz, qIdx) => {
                let questionText = 'متن سوال آزمونک';
                let opts = ['گزینه اول', 'گزینه دوم', 'گزینه سوم', 'گزینه چهارم'];
                let correctIdx = 0;

                if (quiz.questionsJson) {
                  try {
                    const parsed = typeof quiz.questionsJson === 'string' ? JSON.parse(quiz.questionsJson) : quiz.questionsJson;
                    if (Array.isArray(parsed) && parsed[0]) {
                      questionText = parsed[0].question || questionText;
                      if (Array.isArray(parsed[0].options)) opts = parsed[0].options;
                      correctIdx = parsed[0].correctIndex ?? 0;
                    }
                  } catch (e) {
                    console.error('Quiz parse error:', e);
                  }
                }

                html += `
                  <div class="u-bg-surface-2-90 u-bd-accent-35 u-r-8 u-p-12 u-mb-8">
                    <div class="u-flex u-justify-between u-items-center u-mb-8">
                      <div class="u-flex u-items-center u-gap-8 u-wrap">
                        <span class="u-bg-grad-accent u-c-black u-bold u-p-2-8 u-r-5 u-fs-11">
                          آزمونک ${qIdx + 1}: ${esc(quiz.title || 'آزمونک پارت')}
                        </span>
                        <span class="u-bg-accent-15 u-c-accent-text u-bd-accent-40 u-fs-11 u-p-2-8 u-r-5 u-bold u-inline-flex u-items-center u-gap-4">
                          <i class="fa-solid fa-coins u-c-accent-text"></i> پاداش زریک: ${quiz.rewardZarik ?? 10} زریک
                        </span>
                      </div>
                      <div class="u-flex u-gap-6">
                        <button type="button" class="u-bg-accent u-c-black u-bd-none u-p-4-10 u-r-6 u-fs-11 u-pointer u-bold u-flex u-items-center u-gap-4" data-click="editQuizRecord" data-click-args="${esc(JSON.stringify([String(quiz.id)]))}" title="ویرایش سوال، گزینه‌ها و پاداش">
                          <i class="fa-solid fa-pen"></i> ویرایش سوال و گزینه‌ها
                        </button>
                        <button type="button" class="u-bg-danger-20 u-c-danger-text u-bd-danger-40 u-p-4-8 u-r-6 u-fs-11 u-pointer" data-click="deleteQuizRecord" data-click-args="${esc(JSON.stringify([String(quiz.id)]))}" title="حذف آزمونک">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    <div class="u-bold u-c-text u-fs-12 u-mb-8 u-bg-surface-60 u-p-8-12 u-r-6 u-bd-fg-6">
                      <i class="fa-solid fa-question-circle u-c-primary-text"></i> متن سوال: ${esc(questionText)}
                    </div>

                    <div class="u-grid u-cols-2 u-gap-6 u-fs-11">
                      ${opts.map((opt, oIdx) => `
                        <div class="u-p-5-8 u-r-6 u-flex u-items-center u-gap-6" style="background:${oIdx === correctIdx ? 'rgb(var(--success-rgb) / 0.15)' : 'rgb(var(--surface-rgb) / 0.5)'}; border:1px solid ${oIdx === correctIdx ? 'var(--success)' : 'rgb(var(--fg-rgb) / 0.06)'}; color:${oIdx === correctIdx ? 'var(--success-text)' : 'var(--border-strong)'}">
                          <i class="fa-solid ${oIdx === correctIdx ? 'fa-circle-check' : 'fa-circle'} u-fs-12"></i>
                          <span><strong>گزینه ${oIdx + 1}:</strong> ${esc(opt || '-')}</span>
                          ${oIdx === correctIdx ? '<span class="u-c-success-text u-bold u-mr-auto u-fs-10">(پاسخ صحیح)</span>' : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `;
              });
            }

            html += `
                </div>
              </div>
            `;
          });
        }

        html += `</div>`;
      });
    }

    html += `</div>`;
  });

  container.innerHTML = html;
  window.fillGalleryFromStation('content-modal-gallery-container', station);
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal)';

  // Initialize schedule status badges for all clips
  setTimeout(() => {
    document.querySelectorAll('[id^="clip-unlock-date-"]').forEach(inp => {
      const cId = inp.id.replace('clip-unlock-date-', '');
      if (typeof window.updateClipScheduleBadge === 'function') {
        window.updateClipScheduleBadge(cId);
      }
    });
  }, 40);
};

window.saveStationBasicInfoFromContentModal = async function(stationId) {
  const title = document.getElementById('content-modal-st-title')?.value;
  const description = document.getElementById('content-modal-st-desc')?.value;
  const releaseDate = document.getElementById('content-modal-st-date')?.value;
  const stayDuration = document.getElementById('content-modal-st-duration')?.value;
  const iconUrl = document.getElementById('content-modal-st-icon')?.value?.trim() || '';
  const animations = window.collectGalleryItems('content-modal-gallery-container');
  const animationTitle = animations.length ? animations[0].title : '';
  const animationUrl = animations.length ? animations[0].url : '';

  try {
    const res = await request(`/api/v1/admin/lms/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json'  },
      body: JSON.stringify({ id: stationId, title, description, releaseDate, stayDuration, iconUrl, animationTitle, animationUrl, animations })
    });
    if (res.ok) {
      showToast('مشخصات و محتوای کلی منزلگاه با موفقیت ذخیره شد', 'success');
      await window.fetchLiveLmsStations();
      window.openStationContentManagerModal(stationId);
    } else {
      const data = await res.json();
      showToast('خطا در ذخیره مشخصات: ' + (data.error || 'خطای ناشناخته'), 'error');
    }
  } catch (err) {
    console.error('Save Station Basic Info Error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.moveClipInSession = async function(sessionId, fromIdx, toIdx) {
  let foundSession = null;
  let foundStation = null;
  window.lmsStationsMasterList.forEach(st => {
    (st.categories || []).forEach(cat => {
      (cat.sessions || []).forEach(sess => {
        if (sess.id === sessionId) {
          foundSession = sess;
          foundStation = st;
        }
      });
    });
  });

  if (!foundSession || !foundSession.videoClips || toIdx < 0 || toIdx >= foundSession.videoClips.length) return;

  const clips = [...foundSession.videoClips].sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0));
  const moved = clips.splice(fromIdx, 1)[0];
  clips.splice(toIdx, 0, moved);

  const clipIds = clips.map(c => c.id);

  try {
    const res = await request(`/api/v1/admin/lms/sessions/${sessionId}/clips/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'  },
      body: JSON.stringify({ clipIds })
    });
    if (res.ok) {
      await window.fetchLiveLmsStations();
      if (foundStation) window.openStationContentManagerModal(foundStation.id);
    } else {
      showToast('خطا در تغییر ترتیب پارت‌ها', 'error');
    }
  } catch (err) {
    console.error('Reorder clips error:', err);
  }
};

window.addNewClipToSession = async function(sessionId) {
  const title = prompt('عنوان پارت جدید را وارد نمایید:', 'پارت جدید');
  if (!title) return;

  try {
    const res = await request('/api/v1/admin/lms/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'  },
      body: JSON.stringify({ sessionId, title, videoUrl: '', clipOrder: 99 })
    });
    if (res.ok) {
      await window.fetchLiveLmsStations();
      const st = window.lmsStationsMasterList.find(s => 
        (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
      );
      if (st) window.openStationContentManagerModal(st.id);
    } else {
      showToast('خطا در ایجاد پارت جدید', 'error');
    }
  } catch (err) {
    console.error('Add clip error:', err);
  }
};

window.deleteClipRecord = async function(clipId, sessionId) {
  if (!(await NopaConfirm('آیا از حذف این پارت ویدیو و تمام آزمونک‌های متصل به آن اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/lms/clips/${clipId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json'  }
    });
    if (res.ok) {
      await window.fetchLiveLmsStations();
      const st = window.lmsStationsMasterList.find(s => 
        (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
      );
      if (st) window.openStationContentManagerModal(st.id);
    } else {
      showToast('خطا در حذف پارت', 'error');
    }
  } catch (err) {
    console.error('Delete clip error:', err);
  }
};

window.updateClipScheduleBadge = function(clipId) {
  const dateInp = document.getElementById(`clip-unlock-date-${clipId}`);
  const timeInp = document.getElementById(`clip-unlock-time-${clipId}`);
  const badgeEl = document.getElementById(`clip-status-badge-${clipId}`);
  if (!badgeEl) return;

  const dateVal = dateInp ? dateInp.value.trim() : '';
  const timeVal = (timeInp && timeInp.value.trim()) ? timeInp.value.trim() : '00:00';

  if (!dateVal) {
    badgeEl.innerHTML = '<span class="u-bg-success-15 u-c-success-text u-bd-success-35 u-p-2-8 u-r-5 u-bold u-fs-10_5 u-inline-flex u-items-center u-gap-4"><i class="fa-solid fa-lock-open"></i> همیشه باز (دسترسی آزاد)</span>';
    return;
  }

  try {
    const target = new Date(`${dateVal}T${timeVal}`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      const remHours = diffHours % 24;
      let remainText = diffDays > 0 ? `${diffDays} روز و ${remHours} ساعت` : `${diffHours} ساعت`;
      if (diffHours === 0) {
        const remMins = Math.floor(diffMs / (1000 * 60));
        remainText = `${remMins} دقیقه`;
      }
      
      const faDate = target.toLocaleDateString('fa-IR');
      badgeEl.innerHTML = `<span class="u-bg-accent-15 u-c-accent-text u-bd-accent-40 u-p-2-8 u-r-5 u-bold u-fs-10_5 u-inline-flex u-items-center u-gap-4" title="تا تاریخ ${faDate} ساعت ${timeVal} قفل است"><i class="fa-solid fa-lock"></i> قفل تا: ${faDate} ساعت ${timeVal} (${remainText} مانده)</span>`;
    } else {
      const faDate = target.toLocaleDateString('fa-IR');
      badgeEl.innerHTML = `<span class="u-bg-primary-15 u-c-primary-text u-bd-primary-35 u-p-2-8 u-r-5 u-bold u-fs-10_5 u-inline-flex u-items-center u-gap-4"><i class="fa-solid fa-lock-open"></i> تاریخ بازگشایی فرارسیده (${faDate})</span>`;
    }
  } catch (e) {
    badgeEl.innerHTML = '<span class="u-bg-danger-15 u-c-danger-text u-bd-danger-40 u-p-2-8 u-r-5 u-fs-10_5">فرمت تاریخ/ساعت نامعتبر</span>';
  }
};

window.clearClipSchedule = function(clipId) {
  const dateInp = document.getElementById(`clip-unlock-date-${clipId}`);
  const timeInp = document.getElementById(`clip-unlock-time-${clipId}`);
  if (dateInp) dateInp.value = '';
  if (timeInp) timeInp.value = '';
  window.updateClipScheduleBadge(clipId);
};

window.setClipScheduleFromSession = function(clipId, sessId) {
  const stDate = document.getElementById('content-modal-st-date')?.value;
  const dateInp = document.getElementById(`clip-unlock-date-${clipId}`);
  const timeInp = document.getElementById(`clip-unlock-time-${clipId}`);
  
  if (dateInp) {
    if (stDate) {
      dateInp.value = stDate;
    } else {
      dateInp.value = new Date().toISOString().split('T')[0];
    }
  }
  if (timeInp && !timeInp.value) {
    timeInp.value = '18:00';
  }
  window.updateClipScheduleBadge(clipId);
};

window.saveClipVideoUrl = async function(sessionId, clipId) {
  const title = document.getElementById(`clip-title-${clipId}`)?.value;
  const videoUrl = document.getElementById(`clip-url-${clipId}`)?.value;
  const coverImageUrl = document.getElementById(`clip-cover-${clipId}`)?.value?.trim() || '';
  const clipOrder = parseInt(document.getElementById(`clip-order-${clipId}`)?.value) || undefined;
  const unlockDate = document.getElementById(`clip-unlock-date-${clipId}`)?.value || '';
  const unlockTime = document.getElementById(`clip-unlock-time-${clipId}`)?.value || '';

  const payload = {
    clipId: clipId,
    sessionId: sessionId,
    title: title || 'پارت ویدیو',
    videoUrl: videoUrl || '',
    coverImageUrl,
    clipOrder: clipOrder,
    unlockDate: unlockDate,
    unlockTime: unlockTime
  };

  try {
    const res = await request('/api/v1/admin/lms/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'  },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('ترتیب، عنوان، زمان‌بندی باز شدن و مشخصات پارت با موفقیت ذخیره شد', 'success');
      await window.fetchLiveLmsStations();
      const st = window.lmsStationsMasterList.find(s => 
        (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
      );
      if (st) window.openStationContentManagerModal(st.id);
    } else {
      showToast('خطا در ذخیره‌سازی مشخصات پارت', 'error');
    }
  } catch (err) {
    console.error('Save clip error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.saveCategoryTitle = async function(categoryId, stationId) {
  const title = document.getElementById(`cat-title-${categoryId}`)?.value;
  if (!title) {
    showToast('لطفاً عنوان دسته کلاس را وارد نمایید.', 'error');
    return;
  }

  try {
    const res = await request('/api/v1/admin/lms/classes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ id: categoryId, title })
    });

    if (res.ok) {
      showToast('عنوان دسته کلاس با موفقیت ذخیره شد.', 'success');
      await window.fetchLiveLmsStations();
    } else {
      const d = await res.json();
      showToast('خطا در ذخیره‌سازی: ' + (d.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save category title error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

window.cancelLmsContentManagerModal = async function() {
  const modal = document.getElementById('lms-content-manager-modal');
  if (!modal) return;

  const curTitle = document.getElementById('content-modal-st-title')?.value || '';
  const curDate = document.getElementById('content-modal-st-date')?.value || '';
  const curDesc = document.getElementById('content-modal-st-desc')?.value || '';

  const isDirty = window.lmsInitialModalState && (
    curTitle !== window.lmsInitialModalState.title ||
    curDate !== window.lmsInitialModalState.date ||
    curDesc !== window.lmsInitialModalState.desc
  );

  if (isDirty) {
    if (!(await NopaConfirm('تغییراتی در مشخصات منزلگاه یا پارت‌ها داده‌اید که هنوز ثبت نهایی نشده‌اند. آیا از انصراف و بستن پنجره اطمینان دارید؟'))) {
      return;
    }
  }

  modal.style.display = 'none';
};

window.openFinalLmsSaveConfirmationModal = function() {
  const stationId = window.currentActiveContentStationId;
  if (!stationId) {
    showToast('شناسه منزلگاه یافت نشد.', 'error');
    return;
  }

  const station = window.lmsStationsMasterList.find(s => s.id === stationId);
  const stTitle = document.getElementById('content-modal-st-title')?.value || station?.title || 'منزلگاه';
  const stDate = document.getElementById('content-modal-st-date')?.value || '';
  
  // Count clips currently in modal
  const clipOrderInputs = document.querySelectorAll('input[id^="clip-order-"]');
  const clipCount = clipOrderInputs.length;

  const summaryEl = document.getElementById('lms-confirm-summary-list');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="u-grid u-cols-2 u-gap-8 u-mt-6">
        <div><strong>نام منزلگاه:</strong> <span class="u-c-primary-text u-bold">${esc(stTitle)}</span></div>
        <div><strong>تاریخ انتشار:</strong> <span class="u-c-accent-text u-bold">${stDate || 'تعیین‌نشده'}</span></div>
        <div><strong>پارت‌های ویدیویی:</strong> <span class="u-c-success-text u-bold">${clipCount} پارت</span></div>
        <div><strong>وضعیت اعمال:</strong> <span class="u-c-primary-text u-bold">ذخیره‌سازی یکجا و آنی</span></div>
      </div>
    `;
  }

  const confirmModal = document.getElementById('lms-final-confirm-modal');
  if (confirmModal) {
    confirmModal.style.display = 'flex';
    confirmModal.style.zIndex = 'var(--z-modal-confirm)';
  }
};

window.executeFinalLmsSave = async function() {
  const stationId = window.currentActiveContentStationId;
  if (!stationId) return;

  const confirmBtn = document.getElementById('btn-confirm-save-lms-final');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> در حال ذخیره‌سازی نهایی...';
  }

  try {
    const stationTitle = document.getElementById('content-modal-st-title')?.value;
    const releaseDate = document.getElementById('content-modal-st-date')?.value;
    const stationDescription = document.getElementById('content-modal-st-desc')?.value;

    // Collect all category modifications
    const categoriesPayload = [];
    const catTitleInputs = document.querySelectorAll('input[id^="cat-title-"]');
    catTitleInputs.forEach(input => {
      const catId = input.id.replace('cat-title-', '');
      const title = input.value || '';
      categoriesPayload.push({
        id: catId,
        title
      });
    });

    // Collect all clip modifications
    const clipsPayload = [];
    const clipOrderInputs = document.querySelectorAll('input[id^="clip-order-"]');
    clipOrderInputs.forEach(input => {
      const clipId = input.id.replace('clip-order-', '');
      const clipOrder = parseInt(input.value) || 1;
      const title = document.getElementById(`clip-title-${clipId}`)?.value || '';
      const videoUrl = document.getElementById(`clip-url-${clipId}`)?.value || '';
      const coverImageUrl = document.getElementById(`clip-cover-${clipId}`)?.value?.trim() || '';
      const unlockDate = document.getElementById(`clip-unlock-date-${clipId}`)?.value || '';
      const unlockTime = document.getElementById(`clip-unlock-time-${clipId}`)?.value || '';
      clipsPayload.push({
        id: clipId,
        title,
        videoUrl,
        coverImageUrl,
        clipOrder,
        unlockDate,
        unlockTime
      });
    });

    // Collect all session modifications (title, instructor, sessionDate & sessionTime)
    const sessionsPayload = [];
    const sessTitleInputs = document.querySelectorAll('input[id^="sess-title-"]');
    sessTitleInputs.forEach(input => {
      const sessId = input.id.replace('sess-title-', '');
      const title = input.value || '';
      const instructor = document.getElementById(`sess-instructor-${sessId}`)?.value || '';
      const sessionDate = document.getElementById(`sess-date-${sessId}`)?.value?.trim() || '';
      const sessionTime = document.getElementById(`sess-time-${sessId}`)?.value?.trim() || '';
      sessionsPayload.push({
        id: sessId,
        title,
        instructor,
        sessionDate,
        sessionTime
      });
    });

    const payload = {
      stationTitle,
      releaseDate: releaseDate || undefined,
      stationDescription,
      categories: categoriesPayload,
      sessions: sessionsPayload,
      clips: clipsPayload
    };

    const res = await request(`/api/v1/admin/lms/stations/${stationId}/batch-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      document.getElementById('lms-final-confirm-modal').style.display = 'none';
      document.getElementById('lms-content-manager-modal').style.display = 'none';

      showToast('کلیه تغییرات منزلگاه، دسته‌های کلاس و پارت‌های ویدیو با موفقیت ثبت نهایی و در پایگاه‌داده ذخیره شد.', 'success');
      await window.fetchLiveLmsStations();
    } else {
      const d = await res.json();
      showToast('خطا در ثبت نهایی: ' + (d.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Final LMS save error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> تایید نهایی و ذخیره در دیتابیس';
    }
  }
};

window.applyBatchZarikToCategory = async function(categoryId, stationId) {
  const inputEl = document.getElementById(`batch-zarik-cat-${categoryId}`);
  const amount = parseInt(inputEl ? inputEl.value : 15);
  if (isNaN(amount) || amount < 0) {
    showToast('لطفاً یک عدد معتبر برای پاداش زریک وارد نمایید.', 'error');
    return;
  }

  if (!(await NopaConfirm(`آیا مطمئنید که می‌خواهید پاداش ${amount} زریک را برای تمام پارت‌ها و آزمونک‌های این دسته اعمال کنید؟`))) {
    return;
  }

  try {
    const res = await request(`/api/v1/admin/lms/categories/${categoryId}/batch-zarik`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ rewardZarik: amount })
    });

    if (res.ok) {
      const data = await res.json();
      showToast(data.message || 'پاداش زریک با موفقیت روی تمام پارت‌ها اعمال شد', 'success');
      await window.fetchLiveLmsStations();
      if (stationId) {
        window.openStationContentManagerModal(stationId);
      }
    } else {
      const data = await res.json();
      showToast('خطا در اعمال پاداش گروهی زریک: ' + (data.error || 'خطای ناشناخته'), 'error');
    }
  } catch (err) {
    console.error('Batch zarik error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.saveSessionDetails = async function(sessionId, stationId) {
  const title = document.getElementById(`sess-title-${sessionId}`)?.value || '';
  const instructor = document.getElementById(`sess-instructor-${sessionId}`)?.value || '';
  const sessionDate = document.getElementById(`sess-date-${sessionId}`)?.value?.trim() || '';
  const sessionTime = document.getElementById(`sess-time-${sessionId}`)?.value?.trim() || '';

  if (!title) {
    showToast('لطفاً عنوان جلسه را وارد نمایید', 'error');
    return;
  }

  try {
    const res = await request(`/api/v1/admin/lms/sessions/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ id: sessionId, title, instructor, sessionDate, sessionTime })
    });

    if (res.ok) {
      showToast(`مشخصات، نام مدرس و تاریخ جلسه (${sessionDate || 'تعیین‌نشده'}) با موفقیت در پایگاه‌داده ذخیره شد و در تقویم اپلیکیشن به‌روزرسانی گردید.`, 'success');
      await window.fetchLiveLmsStations();
      if (stationId) {
        window.openStationContentManagerModal(stationId);
      }
    } else {
      const data = await res.json();
      showToast('خطا در ذخیره مشخصات جلسه: ' + (data.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Save session error:', err);
    showToast('ارتباط با سرور برقرار نشد: ' + err.message, 'error');
  }
};

window.applyBatchInstructorToCategory = async function(categoryId, stationId) {
  const inputEl = document.getElementById(`batch-instructor-cat-${categoryId}`);
  const instructor = inputEl ? inputEl.value.trim() : '';

  if (!instructor) {
    showToast('لطفاً نام استاد یا مدرس جدید را وارد نمایید.', 'error');
    return;
  }

  if (!(await NopaConfirm(`آیا از تغییر نام استاد تمام جلسات این دسته‌بندی به «${instructor}» اطمینان دارید؟`))) {
    return;
  }

  try {
    const res = await request(`/api/v1/admin/lms/categories/${categoryId}/batch-instructor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        
      },
      body: JSON.stringify({ instructor })
    });

    if (res.ok) {
      const data = await res.json();
      showToast(`${data.message || 'نام مدرس برای تمامی جلسات با موفقیت به‌روزرسانی شد.'}`, 'success');
      await window.fetchLiveLmsStations();
      if (stationId) {
        window.openStationContentManagerModal(stationId);
      }
    } else {
      const data = await res.json();
      showToast('خطا در تخصیص یکجای استاد: ' + (data.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Batch instructor error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};
