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
    filterTitleSuffix = ' <span style="font-size:12px; color:var(--primary-text); font-weight:normal; background:rgb(var(--primary-rgb) / 0.2); padding:2px 8px; border-radius:10px; margin-right:6px;">(فقط کلاس‌های مهارتی)</span>';
  } else if (currentCatFilter === 'رسانه‌ای' || currentCatFilter === 'media') {
    filterTitleSuffix = ' <span style="font-size:12px; color:var(--primary-text); font-weight:normal; background:rgb(var(--primary-rgb) / 0.2); padding:2px 8px; border-radius:10px; margin-right:6px;">(فقط کلاس‌های رسانه‌ای)</span>';
  }

  const titleEl = document.getElementById('lms-content-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-film" style="color:var(--primary-text);"></i> مدیریت پارت‌ها، ویدیوها و آزمونک‌های ${simpleStationName}${filterTitleSuffix}`;
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
    <div style="background:rgb(var(--surface-rgb) / 0.95); border:1px solid rgb(var(--primary-rgb) / 0.35); border-radius:12px; padding:16px; margin-bottom:20px; box-shadow:0 4px 15px rgb(var(--shade-rgb) / 0.3);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.08); padding-bottom:8px;">
        <div style="font-size:14px; font-weight:bold; color:var(--primary-text); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-pen-to-square"></i> مشخصات، عنوان و محتوای ${simpleStationName}
        </div>
        <span class="badge" style="background:var(--primary); color:white; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:bold;">
          کد: MZ${stationIdx} (${simpleStationName})
        </span>
      </div>

      <div style="display:grid; grid-template-columns: 120px 1.8fr 1.2fr; gap:12px; margin-bottom:12px;">
        <div>
          <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px;"><i class="fa-solid fa-hashtag" style="color:var(--primary-text);"></i> شماره منزلگاه:</label>
          <input type="number" id="content-modal-st-order" class="input-ctrl" value="${stationIdx}" readonly style="background:var(--surface); border-color:var(--border-strong); color:var(--primary-text); font-weight:bold; cursor:not-allowed; text-align:center;" title="شماره منزلگاه یکتاست. برای جابجایی ترتیب از دکمه مرتب‌سازی منزلگاه‌ها استفاده فرمایید.">
        </div>
        <div>
          <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px;"><i class="fa-solid fa-graduation-cap" style="color:var(--primary-text);"></i> نام و عنوان منزلگاه:</label>
          <input type="text" id="content-modal-st-title" class="input-ctrl" value="${simpleStationName}" placeholder="عنوان منزلگاه..." style="background:var(--surface); border-color:var(--border-strong); font-weight:bold; color:var(--text);">
        </div>
        <div>
          <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px;"><i class="fa-solid fa-calendar-days" style="color:var(--primary-text);"></i> تاریخ انتشار تقویم:</label>
          <input type="date" id="content-modal-st-date" class="input-ctrl" value="${releaseDateStr}" style="background:var(--surface); color:var(--text); border-color:var(--border-strong);">
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 2.5fr; gap:12px; margin-bottom:12px;">
        <div>
          <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px;"><i class="fa-solid fa-hourglass-half" style="color:var(--primary-text);"></i> مدت اقامت در منزلگاه:</label>
          <input type="text" id="content-modal-st-duration" class="input-ctrl" value="${station.stayDuration || ''}" placeholder="مثال: ۲ هفته یا ۱۴ روز" style="background:var(--surface); border-color:var(--border-strong); color:var(--text);">
        </div>
        <div>
          <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px;"><i class="fa-solid fa-image" style="color:var(--primary-text);"></i> تصویر منزلگاه (در صفحه اول، آموزگاه و منزلگاه یکسان نمایش داده می‌شود):</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <img id="content-modal-st-icon-preview" src="${esc(station.iconUrl || '')}" alt="" style="width:44px; height:62px; object-fit:cover; border-radius:6px; border:1px solid var(--border-strong); background:var(--surface); ${station.iconUrl ? '' : 'visibility:hidden;'}" onerror="this.style.visibility = 'hidden'" onload="this.style.visibility = 'visible'">
            <input type="text" id="content-modal-st-icon" class="input-ctrl" value="${esc(station.iconUrl || '')}" placeholder="https://... یا /uploads/..." style="background:var(--surface); border-color:var(--border-strong); color:var(--text); direction:ltr; text-align:left; flex:1;" oninput="document.getElementById('content-modal-st-icon-preview').src = this.value">
            <label style="background:rgb(var(--primary-rgb) / 0.18); border:1px solid var(--primary); color:var(--primary-text); padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;" title="آپلود تصویر منزلگاه">
              <i class="fa-solid fa-cloud-arrow-up"></i> آپلود تصویر
              <input type="file" accept="image/*" style="display:none;" onchange="window.handleDirectFileUpload(this, 'content-modal-st-icon')">
            </label>
          </div>
        </div>
      </div>

      <!-- نگارستان منزلگاه -->
      <div style="background: rgb(var(--surface-rgb) / 0.7); border: 1px solid rgb(var(--primary-rgb) / 0.28); border-radius: 10px; padding: 12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-size:12.5px; font-weight:bold; color:var(--primary-text);"><i class="fa-solid fa-images"></i> نگارستان منزلگاه</div>
          <button type="button" onclick="window.addGalleryItemCard('content-modal-gallery-container')" style="background:linear-gradient(135deg,var(--primary),var(--primary-strong)); color:white; border:none; padding:5px 12px; border-radius:7px; font-size:11.5px; font-weight:bold; cursor:pointer;">
            <i class="fa-solid fa-plus"></i> افزودن تصویر به نگارستان
          </button>
        </div>
        <div id="content-modal-gallery-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px;"><i class="fa-solid fa-align-right" style="color:var(--primary-text);"></i> متن معرفی، داستان و سرفصل‌های کلی منزلگاه:</label>
        <textarea id="content-modal-st-desc" class="input-ctrl" rows="3" placeholder="توضیحات، داستان، اهداف و سرفصل‌های آموزشی این منزلگاه..." style="background:var(--surface); border-color:var(--border-strong);">${esc(station.description || '')}</textarea>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button type="button" onclick="window.saveStationBasicInfoFromContentModal('${station.id}')" style="background:linear-gradient(135deg, var(--primary), var(--primary-strong)); color:white; border:none; border-radius:8px; padding:8px 20px; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgb(var(--shade-rgb) / 0.3);">
          <i class="fa-solid fa-check"></i> ذخیره تغییرات نام و محتوای منزلگاه
        </button>
      </div>
    </div>
  `;

  if (categories.length === 0) {
    html += '<div style="text-align:center; color:var(--text-muted); padding:20px;">هیچ دسته‌بندی با این فیلتر برای این منزلگاه پیدا نشد.</div>';
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
      <div style="background:${bg}; border:1px solid ${color}44; border-radius:12px; padding:16px; margin-bottom:20px;">
        
        <!-- Editable Category Header & Controls -->
        <div style="margin:0 0 14px 0; background:rgb(var(--surface-rgb) / 0.85); border:1px solid ${color}55; border-radius:10px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:280px;">
            <span class="badge" style="background:${isSkill ? 'var(--primary)' : 'var(--primary-strong)'}; color:white; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:bold; white-space:nowrap;">
              ${isSkill ? 'دسته ۱ (مهارتی)' : 'دسته ۲ (رسانه‌ای)'}
            </span>
            <div style="flex:1; display:flex; align-items:center; gap:6px;">
              <label style="font-size:11px; color:var(--text-soft); white-space:nowrap;"><i class="fa-solid fa-pen" style="color:${color};"></i> عنوان دسته کلاس:</label>
              <input type="text" id="cat-title-${cat.id}" class="input-ctrl" value="${esc(cat.title || (isSkill ? 'کلاس‌های مهارتی' : 'کلاس‌های رسانه‌ای'))}" placeholder="عنوان دسته کلاس..." style="background:var(--surface); border-color:${color}66; color:var(--text); font-weight:bold; font-size:13px; padding:6px 12px;">
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; color:var(--text-soft); background:rgb(var(--shade-rgb) / 0.4); padding:5px 12px; border-radius:6px; border:1px solid rgb(var(--fg-rgb) / 0.06); font-weight:bold;">
              ${sessions.length} جلسه
            </span>
            <button type="button" onclick="window.saveCategoryTitle('${cat.id}', '${station.id}')" style="background:linear-gradient(135deg, ${color}, ${isSkill ? 'var(--primary)' : 'var(--primary-strong)'}); color:white; border:none; padding:6px 14px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgb(var(--shade-rgb) / 0.3);" title="ذخیره مستقیم عنوان این دسته">
              <i class="fa-solid fa-save"></i> ذخیره عنوان دسته
            </button>
          </div>
        </div>

        <!-- Quick Batch Instructor Allocation Tool for this entire Category -->
        <div style="background:rgb(var(--primary-rgb) / 0.08); border:1px dashed rgb(var(--primary-rgb) / 0.4); border-radius:8px; padding:10px 14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-chalkboard-user" style="color:var(--primary-text); font-size:18px;"></i>
            <div>
              <div style="font-weight:bold; color:var(--primary-text); font-size:12px;">تغییر و تخصیص یکجای استاد/مدرس برای تمام جلسات این دسته:</div>
              <div style="font-size:11px; color:var(--text-muted);">با یک کلیک، نام مدرس برای تمامی ${sessions.length} جلسه این دسته‌بندی به‌صورت یکپارچه به‌روزرسانی می‌شود.</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:11px; color:var(--text-soft);">انتخاب از بانک اساتید:</label>
            <select id="batch-instructor-cat-${cat.id}" class="input-ctrl" style="width:170px; padding:5px 8px; background:var(--surface); border-color:var(--primary); color:var(--text); font-size:12px; font-weight:bold;">
              ${(window.globalInstructorsList || []).map(i => `<option value="${esc(i.name)}">${esc(i.name)} (${esc(i.degree || 'مدرس')})</option>`).join('')}
              ${(!window.globalInstructorsList || window.globalInstructorsList.length === 0) ? `<option value="علیرضا خوش‌منظر">علیرضا خوش‌منظر</option><option value="پیراینه‌گر">پیراینه‌گر</option>` : ''}
            </select>
            <button type="button" onclick="window.applyBatchInstructorToCategory('${cat.id}', '${station.id}')" style="background:linear-gradient(135deg, var(--primary), var(--primary-strong)); color:white; font-weight:bold; border:none; padding:6px 14px; border-radius:6px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgb(var(--shade-rgb) / 0.3);">
              <i class="fa-solid fa-user-pen"></i> اعمال روی کل جلسات
            </button>
          </div>
        </div>

        <!-- Quick Batch Zarik Allocation Tool for this entire Category -->
        <div style="background:rgb(var(--accent-rgb) / 0.09); border:1px dashed rgb(var(--accent-rgb) / 0.4); border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-coins" style="color:var(--accent-text); font-size:18px;"></i>
            <div>
              <div style="font-weight:bold; color:var(--accent-text); font-size:12px;">تخصیص یکجای پاداش زریک برای تمام پارت‌ها و آزمونک‌های این دسته:</div>
              <div style="font-size:11px; color:var(--text-muted);">با یک کلیک، پاداش تمامی آزمونک‌های این دسته تعیین شده و پس از پاسخ صحیح به دانش‌آموز اعطا می‌گردد.</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:11px; color:var(--text-soft);">پاداش هر پارت:</label>
            <input type="number" id="batch-zarik-cat-${cat.id}" class="input-ctrl" value="15" min="1" max="1000" style="width:65px; padding:5px 6px; text-align:center; background:var(--surface); border-color:var(--accent); color:var(--accent-text); font-weight:bold; font-size:12px;">
            <button type="button" onclick="window.applyBatchZarikToCategory('${cat.id}', '${station.id}')" style="background:linear-gradient(135deg, var(--accent), var(--accent-strong)); color:black; font-weight:bold; border:none; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-bolt"></i> اعمال روی کل این دسته
            </button>
          </div>
        </div>
    `;

    if (sessions.length === 0) {
      html += '<div style="color:var(--text-soft); font-size:12px; padding:10px;">جلسه‌ای در این دسته ثبت نشده است.</div>';
    } else {
      sessions.forEach((sess, sIdx) => {
        const clips = (sess.videoClips || []).sort((a, b) => (Number(a.clipOrder) || 0) - (Number(b.clipOrder) || 0));
        const quizzes = sess.quizzes || [];

        const sessOrder = sess.orderIndex || (sIdx + 1);
        const curFallback = window.getCurriculumSessionDate ? window.getCurriculumSessionDate(stationIdx, !isSkill, sessOrder) : { date: '1405/07/02', time: isSkill ? '۱۶:۰۰ الی ۱۷:۳۰' : '۱۸:۰۰ الی ۱۹:۳۰' };
        const sessDate = sess.sessionDate || curFallback.date;
        const sessTime = sess.sessionTime || curFallback.time;

        html += `
          <div style="background:rgb(var(--surface-rgb) / 0.9); border:1px solid rgb(var(--fg-rgb) / 0.1); border-radius:12px; padding:14px; margin-bottom:16px; box-shadow:0 4px 12px rgb(var(--shade-rgb) / 0.25);">
            
            <!-- Session Top Header with Glowing Date Badge -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgb(var(--fg-rgb) / 0.08); padding-bottom:10px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge" style="background:${isSkill ? 'var(--primary)' : 'var(--primary-strong)'}; color:white; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:bold;">
                  جلسه ${sessOrder}
                </span>
                <span style="font-size:13px; font-weight:bold; color:var(--text);">
                  ${sess.title || `جلسه ${sessOrder}`}
                </span>
              </div>
              
              <!-- Prominent Date & Time Badge right next to the session -->
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="background:rgb(var(--accent-rgb) / 0.15); border:1px solid rgb(var(--accent-rgb) / 0.4); padding:4px 10px; border-radius:8px; font-size:12px; color:var(--accent-text); font-weight:bold; display:flex; align-items:center; gap:6px;">
                  <i class="fa-solid fa-calendar-day"></i>
                  <span>تاریخ کلاس:</span>
                  <span id="badge-sess-date-${sess.id}">${sessDate}</span>
                </div>
                <div style="background:rgb(var(--primary-rgb) / 0.15); border:1px solid rgb(var(--primary-rgb) / 0.4); padding:4px 10px; border-radius:8px; font-size:12px; color:var(--primary-text); font-weight:bold; display:flex; align-items:center; gap:6px;">
                  <i class="fa-solid fa-clock"></i>
                  <span>ساعت:</span>
                  <span id="badge-sess-time-${sess.id}">${sessTime}</span>
                </div>
                <span style="font-size:11px; color:var(--text-muted); background:rgb(var(--fg-rgb) / 0.05); padding:4px 8px; border-radius:6px;">
                  ${clips.length} پارت ویدیو | ${quizzes.length} آزمونک
                </span>
              </div>
            </div>

            <!-- Session Controls & Editable Fields Grid -->
            <div style="display:grid; grid-template-columns: 1.2fr 1fr 1fr 1fr auto; gap:10px; align-items:flex-end; margin-bottom:12px; background:rgb(var(--shade-rgb) / 0.3); padding:12px; border-radius:10px; border:1px solid rgb(var(--fg-rgb) / 0.05);">
              <div>
                <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:4px; font-weight:bold;">
                  <i class="fa-solid fa-book-open" style="color:${color};"></i> عنوان کلاس/جلسه:
                </label>
                <input type="text" id="sess-title-${sess.id}" class="input-ctrl" value="${sess.title || `جلسه ${sessOrder}`}" placeholder="عنوان جلسه..." style="font-size:12px; font-weight:bold; color:var(--text); background:var(--surface); padding:7px 10px; border-color:${color}55;">
              </div>

              <div>
                <label style="font-size:11px; color:var(--primary-text); display:block; margin-bottom:4px; font-weight:bold;">
                  <i class="fa-solid fa-chalkboard-user"></i> استاد / مدرس:
                </label>
                <select id="sess-instructor-${sess.id}" class="input-ctrl" style="font-size:12px; color:var(--primary-text); background:var(--surface); padding:7px 10px; font-weight:bold; border-color:rgb(var(--primary-rgb) / 0.4);">
                  ${(window.globalInstructorsList || []).map(i => `<option value="${esc(i.name)}" ${(sess.instructor && sess.instructor.includes(i.name)) ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
                  ${(!window.globalInstructorsList || window.globalInstructorsList.length === 0) ? `<option value="${sess.instructor || (isSkill ? 'پیراینه‌گر' : 'علیرضا خوش‌منظر')}">${sess.instructor || (isSkill ? 'پیراینه‌گر' : 'علیرضا خوش‌منظر')}</option>` : ''}
                </select>
              </div>

              <div>
                <label style="font-size:11px; color:var(--accent-text); display:block; margin-bottom:4px; font-weight:bold;">
                  <i class="fa-solid fa-calendar-day"></i> تاریخ برگزاری (شمسی):
                </label>
                <input type="text" id="sess-date-${sess.id}" class="input-ctrl" value="${sessDate}" placeholder="مثال: ۱۴۰۵/۰۷/۰۲" style="font-size:12px; color:var(--accent-text); background:var(--surface); padding:7px 10px; font-weight:bold; border-color:rgb(var(--accent-rgb) / 0.5); text-align:center;" oninput="const b = document.getElementById('badge-sess-date-${sess.id}'); if(b) b.innerText = this.value">
              </div>

              <div>
                <label style="font-size:11px; color:var(--primary-text); display:block; margin-bottom:4px; font-weight:bold;">
                  <i class="fa-solid fa-clock"></i> زمان و ساعت کلاس:
                </label>
                <input type="text" id="sess-time-${sess.id}" class="input-ctrl" value="${sessTime}" placeholder="مثال: ۱۸:۰۰ الی ۱۹:۳۰" style="font-size:12px; color:var(--primary-text); background:var(--surface); padding:7px 10px; font-weight:bold; border-color:rgb(var(--primary-rgb) / 0.5); text-align:center;" oninput="const b = document.getElementById('badge-sess-time-${sess.id}'); if(b) b.innerText = this.value">
              </div>

              <div style="display:flex; gap:6px;">
                <button type="button" style="background:linear-gradient(135deg, var(--success), var(--success-strong)); color:white; border:none; border-radius:6px; padding:8px 14px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:5px; box-shadow:0 2px 5px rgb(var(--shade-rgb) / 0.3); white-space:nowrap;" onclick="window.saveSessionDetails('${sess.id}', '${station.id}')" title="ذخیره مستقیم تغییرات این کلاس و تاریخ آن">
                  <i class="fa-solid fa-floppy-disk"></i> ذخیره تاریخ و مشخصات
                </button>
                <button type="button" style="background:var(--primary); color:white; border:none; border-radius:6px; padding:8px 12px; font-size:11px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:4px; white-space:nowrap;" onclick="window.addNewClipToSession('${sess.id}')" title="افزودن پارت ویدیویی جدید به این کلاس">
                  <i class="fa-solid fa-plus"></i> پارت جدید
                </button>
              </div>
            </div>

            <!-- Video Clips List & Link Editor with Order Adjustment -->
            <div style="margin-bottom:10px;">
              <div style="font-size:12px; color:var(--primary-text); font-weight:bold; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-film"></i> پارت‌های ویدیویی این جلسه (امکان جابجایی ترتیب با دکمه‌های بالا/پایین، ویرایش لینک و آزمونک):
              </div>
        `;

        if (clips.length === 0) {
          html += `
            <div style="color:var(--text-muted); font-size:12px; background:rgb(var(--shade-rgb) / 0.2); padding:10px; border-radius:6px; text-align:center;">
              پارتی برای این جلسه تعریف نشده است. 
              <button type="button" style="background:var(--primary); color:white; border:none; border-radius:4px; padding:4px 10px; font-size:11px; margin-right:8px; cursor:pointer;" onclick="window.addNewClipToSession('${sess.id}')">+ ایجاد اولین پارت</button>
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
              <div style="background:rgb(var(--surface-2-rgb) / 0.9); border:1px solid rgb(var(--fg-rgb) / 0.08); border-radius:8px; padding:12px; margin-bottom:10px;">
                <div style="display:grid; grid-template-columns: 85px 1.4fr 2fr auto; gap:10px; align-items:center; margin-bottom:8px;">
                  
                  <!-- Part Order with Up/Down Buttons -->
                  <div>
                    <label style="font-size:11px; color:var(--primary-text); display:block; margin-bottom:3px; font-weight:bold;">ترتیب پارت:</label>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <input type="number" id="clip-order-${clip.id}" min="1" max="50" class="input-ctrl" style="font-size:12px; padding:4px; text-align:center; background:var(--surface); font-weight:bold; color:var(--primary-text); width:45px;" value="${clip.clipOrder || (cIdx + 1)}">
                      <div style="display:flex; flex-direction:column; gap:2px;">
                        <button type="button" onclick="window.moveClipInSession('${sess.id}', ${cIdx}, ${cIdx - 1})" ${isFirstClip ? 'disabled' : ''} style="background:${isFirstClip ? 'rgb(var(--fg-rgb) / 0.03)' : 'var(--surface-2)'}; color:${isFirstClip ? 'var(--text-faint)' : 'var(--primary)'}; border:1px solid ${isFirstClip ? 'transparent' : 'rgb(var(--primary-rgb) / 0.3)'}; border-radius:3px; width:20px; height:15px; font-size:9px; cursor:${isFirstClip ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; justify-content:center;" title="حرکت به بالا">▲</button>
                        <button type="button" onclick="window.moveClipInSession('${sess.id}', ${cIdx}, ${cIdx + 1})" ${isLastClip ? 'disabled' : ''} style="background:${isLastClip ? 'rgb(var(--fg-rgb) / 0.03)' : 'var(--surface-2)'}; color:${isLastClip ? 'var(--text-faint)' : 'var(--primary)'}; border:1px solid ${isLastClip ? 'transparent' : 'rgb(var(--primary-rgb) / 0.3)'}; border-radius:3px; width:20px; height:15px; font-size:9px; cursor:${isLastClip ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; justify-content:center;" title="حرکت به پایین">▼</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style="font-size:11px; color:var(--text-soft); display:block; margin-bottom:3px;">عنوان پارت:</label>
                    <input type="text" id="clip-title-${clip.id}" class="input-ctrl" style="font-size:12px; padding:6px 10px; background:var(--surface);" value="${esc(clip.title || '')}" placeholder="عنوان پارت...">
                  </div>
                  <div>
                    <label style="font-size:11px; color:var(--primary-text); display:block; margin-bottom:3px;"><i class="fa-solid fa-video"></i> لینک ویدیو (آپارات یا URL مستقیم):</label>
                    <input type="text" id="clip-url-${clip.id}" class="input-ctrl" style="font-size:12px; padding:6px 10px; direction:ltr; background:var(--surface);" value="${esc(clip.videoUrl || '')}" placeholder="https://www.aparat.com/v/...">
                  </div>
                  <div>
                    <label style="font-size:11px; color:var(--primary-text); display:block; margin-bottom:3px;"><i class="fa-solid fa-image"></i> لینک کاور (پیش‌نمایش ویدیو در اپلیکیشن):</label>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <img id="clip-cover-preview-${clip.id}" src="${esc(clip.coverImageUrl || '')}" alt="" style="width:46px; height:30px; object-fit:cover; border-radius:4px; border:1px solid var(--border-strong); background:var(--surface); ${clip.coverImageUrl ? '' : 'visibility:hidden;'}" onerror="this.style.visibility = 'hidden'" onload="this.style.visibility = 'visible'">
                      <input type="text" id="clip-cover-${clip.id}" class="input-ctrl" style="font-size:12px; padding:6px 10px; direction:ltr; background:var(--surface); flex:1;" value="${esc(clip.coverImageUrl || '')}" placeholder="https://... یا /uploads/... (اختیاری)" oninput="document.getElementById('clip-cover-preview-${clip.id}').src = this.value">
                      <label style="background:rgb(var(--primary-rgb) / 0.18); border:1px solid var(--primary); color:var(--primary-text); padding:5px 9px; border-radius:6px; cursor:pointer; font-size:11px; white-space:nowrap;" title="آپلود تصویر کاور">
                        <i class="fa-solid fa-cloud-arrow-up"></i> آپلود
                        <input type="file" accept="image/*" style="display:none;" onchange="window.handleDirectFileUpload(this, 'clip-cover-${clip.id}')">
                      </label>
                    </div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:flex-end; padding-top:16px;">
                    <button type="button" style="background:var(--primary); color:white; border:none; border-radius:6px; padding:7px 12px; font-size:11px; cursor:pointer;" onclick="window.saveClipVideoUrl('${sess.id}', '${clip.id}')" title="ذخیره ترتیب، عنوان و لینک ویدیو">
                      <i class="fa-solid fa-save"></i> ذخیره
                    </button>
                    <button type="button" style="background:var(--success); color:white; border:none; border-radius:6px; padding:7px 12px; font-size:11px; cursor:pointer;" onclick="window.openQuizModalForClip('${sess.id}', '${clip.id}')" title="افزودن آزمونک برای این پارت">
                      <i class="fa-solid fa-circle-question"></i> + آزمونک
                    </button>
                    <button type="button" style="background:rgb(var(--danger-rgb) / 0.2); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.4); border-radius:6px; padding:7px 10px; font-size:11px; cursor:pointer;" onclick="window.deleteClipRecord('${clip.id}', '${sess.id}')" title="حذف این پارت">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>

                <!-- Section: Part Unlock / Schedule Settings (تنظیمات باز شدن پارت) -->
                <div style="background:rgb(var(--surface-rgb) / 0.7); border:1px solid rgb(var(--primary-rgb) / 0.25); border-radius:8px; padding:10px 14px; margin-top:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:rgb(var(--primary-rgb) / 0.15); display:flex; align-items:center; justify-content:center; color:var(--primary-text); font-size:15px; border:1px solid rgb(var(--primary-rgb) / 0.3);">
                      <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div>
                      <div style="font-size:12px; font-weight:bold; color:var(--primary-text); display:flex; align-items:center; gap:8px;">
                        <span>تنظیمات باز شدن پارت ${clip.clipOrder || (cIdx + 1)}:</span>
                        <span id="clip-status-badge-${clip.id}" class="badge"></span>
                      </div>
                      <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                        تعیین تاریخ و ساعت بازگشایی و در دسترس قرار گرفتن این پارت
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <!-- Date input -->
                    <div style="display:flex; align-items:center; gap:6px;">
                      <label style="font-size:11px; color:var(--accent-text); white-space:nowrap; font-weight:bold;">
                        <i class="fa-solid fa-calendar-day"></i> تاریخ باز شدن:
                      </label>
                      <input type="date" id="clip-unlock-date-${clip.id}" class="input-ctrl" value="${clipUnlockDate}" style="font-size:12px; padding:6px 10px; background:var(--surface); color:var(--accent-text); border-color:rgb(var(--accent-rgb) / 0.45); border-radius:6px; width:135px;" onchange="window.updateClipScheduleBadge('${clip.id}')" title="تاریخ باز شدن پارت">
                    </div>

                    <!-- Time input -->
                    <div style="display:flex; align-items:center; gap:6px;">
                      <label style="font-size:11px; color:var(--primary-text); white-space:nowrap; font-weight:bold;">
                        <i class="fa-regular fa-clock"></i> ساعت باز شدن:
                      </label>
                      <input type="time" id="clip-unlock-time-${clip.id}" class="input-ctrl" value="${clipUnlockTime || '00:00'}" style="font-size:12px; padding:6px 10px; background:var(--surface); color:var(--primary-text); border-color:rgb(var(--primary-rgb) / 0.45); border-radius:6px; width:100px;" onchange="window.updateClipScheduleBadge('${clip.id}')" title="ساعت باز شدن پارت">
                    </div>

                    <!-- Quick buttons -->
                    <div style="display:flex; gap:5px;">
                      <button type="button" onclick="window.setClipScheduleFromSession('${clip.id}', '${sess.id}')" style="background:rgb(var(--primary-rgb) / 0.15); border:1px solid rgb(var(--primary-rgb) / 0.4); color:var(--primary-text); border-radius:6px; padding:6px 10px; font-size:11px; cursor:pointer; font-weight:bold;" title="تنظیم خودکار تاریخ بر اساس تقویم جلسه">
                        <i class="fa-solid fa-calendar-check"></i> تاریخ جلسه
                      </button>
                      <button type="button" onclick="window.clearClipSchedule('${clip.id}')" style="background:rgb(var(--fg-rgb) / 0.05); border:1px solid rgb(var(--fg-rgb) / 0.15); color:var(--text-soft); border-radius:6px; padding:6px 10px; font-size:11px; cursor:pointer;" title="بدون محدودیت زمان‌بندی (همیشه باز)">
                        <i class="fa-solid fa-unlock"></i> همیشه باز
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Per-Part Quiz Inspector & Manager -->
                <div style="background:rgb(var(--surface-rgb) / 0.75); border-right:3px solid var(--accent); padding:10px 14px; margin-top:10px; border-radius:8px; border:1px solid rgb(var(--accent-rgb) / 0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-size:12px; color:var(--accent-text); font-weight:bold; display:flex; align-items:center; gap:6px;">
                      <i class="fa-solid fa-circle-question"></i> آزمونک‌های تستی انتهای پارت ${clip.clipOrder || (cIdx + 1)}:
                    </div>
                    <button type="button" style="background:var(--accent); color:black; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;" onclick="window.openQuizModalForClip('${sess.id}', '${clip.id}')">
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
                <div style="font-size:11px; color:var(--text-muted); background:rgb(var(--shade-rgb) / 0.2); padding:8px 12px; border-radius:6px;">
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
                  <div style="background:rgb(var(--surface-2-rgb) / 0.9); border:1px solid rgb(var(--accent-rgb) / 0.35); border-radius:8px; padding:12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="background:linear-gradient(135deg, var(--accent), var(--accent-strong)); color:black; font-weight:bold; padding:2px 8px; border-radius:5px; font-size:11px;">
                          آزمونک ${qIdx + 1}: ${esc(quiz.title || 'آزمونک پارت')}
                        </span>
                        <span style="background:rgb(var(--accent-rgb) / 0.15); color:var(--accent-text); border:1px solid rgb(var(--accent-rgb) / 0.4); font-size:11px; padding:2px 8px; border-radius:5px; font-weight:bold; display:inline-flex; align-items:center; gap:4px;">
                          <i class="fa-solid fa-coins" style="color:var(--accent-text);"></i> پاداش زریک: ${quiz.rewardZarik ?? 10} زریک
                        </span>
                      </div>
                      <div style="display:flex; gap:6px;">
                        <button type="button" style="background:var(--accent); color:black; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:4px;" onclick="window.editQuizRecord('${quiz.id}')" title="ویرایش سوال، گزینه‌ها و پاداش">
                          <i class="fa-solid fa-pen"></i> ویرایش سوال و گزینه‌ها
                        </button>
                        <button type="button" style="background:rgb(var(--danger-rgb) / 0.2); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.4); padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;" onclick="window.deleteQuizRecord('${quiz.id}')" title="حذف آزمونک">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    <div style="font-weight:bold; color:var(--text); font-size:12px; margin-bottom:8px; background:rgb(var(--surface-rgb) / 0.6); padding:8px 12px; border-radius:6px; border:1px solid rgb(var(--fg-rgb) / 0.06);">
                      <i class="fa-solid fa-question-circle" style="color:var(--primary-text);"></i> متن سوال: ${esc(questionText)}
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
                      ${opts.map((opt, oIdx) => `
                        <div style="background:${oIdx === correctIdx ? 'rgb(var(--success-rgb) / 0.15)' : 'rgb(var(--surface-rgb) / 0.5)'}; border:1px solid ${oIdx === correctIdx ? 'var(--success)' : 'rgb(var(--fg-rgb) / 0.06)'}; color:${oIdx === correctIdx ? 'var(--success-text)' : 'var(--border-strong)'}; padding:5px 8px; border-radius:6px; display:flex; align-items:center; gap:6px;">
                          <i class="fa-solid ${oIdx === correctIdx ? 'fa-circle-check' : 'fa-circle'}" style="font-size:12px;"></i>
                          <span><strong>گزینه ${oIdx + 1}:</strong> ${esc(opt || '-')}</span>
                          ${oIdx === correctIdx ? '<span style="color:var(--success-text); font-weight:bold; margin-right:auto; font-size:10px;">(پاسخ صحیح)</span>' : ''}
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
    badgeEl.innerHTML = '<span style="background:rgb(var(--success-rgb) / 0.15); color:var(--success-text); border:1px solid rgb(var(--success-rgb) / 0.35); padding:2px 8px; border-radius:5px; font-weight:bold; font-size:10.5px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-lock-open"></i> همیشه باز (دسترسی آزاد)</span>';
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
      badgeEl.innerHTML = `<span style="background:rgb(var(--accent-rgb) / 0.15); color:var(--accent-text); border:1px solid rgb(var(--accent-rgb) / 0.4); padding:2px 8px; border-radius:5px; font-weight:bold; font-size:10.5px; display:inline-flex; align-items:center; gap:4px;" title="تا تاریخ ${faDate} ساعت ${timeVal} قفل است"><i class="fa-solid fa-lock"></i> قفل تا: ${faDate} ساعت ${timeVal} (${remainText} مانده)</span>`;
    } else {
      const faDate = target.toLocaleDateString('fa-IR');
      badgeEl.innerHTML = `<span style="background:rgb(var(--primary-rgb) / 0.15); color:var(--primary-text); border:1px solid rgb(var(--primary-rgb) / 0.35); padding:2px 8px; border-radius:5px; font-weight:bold; font-size:10.5px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-lock-open"></i> تاریخ بازگشایی فرارسیده (${faDate})</span>`;
    }
  } catch (e) {
    badgeEl.innerHTML = '<span style="background:rgb(var(--danger-rgb) / 0.15); color:var(--danger-text); border:1px solid rgb(var(--danger-rgb) / 0.4); padding:2px 8px; border-radius:5px; font-size:10.5px;">فرمت تاریخ/ساعت نامعتبر</span>';
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
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
        <div><strong>نام منزلگاه:</strong> <span style="color:var(--primary-text); font-weight:bold;">${esc(stTitle)}</span></div>
        <div><strong>تاریخ انتشار:</strong> <span style="color:var(--accent-text); font-weight:bold;">${stDate || 'تعیین‌نشده'}</span></div>
        <div><strong>پارت‌های ویدیویی:</strong> <span style="color:var(--success-text); font-weight:bold;">${clipCount} پارت</span></div>
        <div><strong>وضعیت اعمال:</strong> <span style="color:var(--primary-text); font-weight:bold;">ذخیره‌سازی یکجا و آنی</span></div>
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
