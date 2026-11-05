// Legacy LMS builder helpers (categories / classes / clips / quizzes UI) used by older station flows.
// Split out of the former app.js (Phase 7). Classic script: shares globals with the other modules;
// load order is set in index.html.

// ===============================
// MODULE D: LMS CONTENT LOGIC
// ===============================

// Load Hierarchy Data for Selects

async function loadLmsData() {
  try {
    let response;
    try {
      response = await request('/api/v1/admin/lms/stations');
    } catch(e) {
      response = await request('/api/v1/stations');
    }
    const data = await response.json();
    const stations = data.stations || data.data || (Array.isArray(data) ? data : []);
    window.lmsStations = stations;
    
    const tbody = document.querySelector('#stations-table tbody');
    if(tbody) {
      tbody.innerHTML = stations.map(s => `
  <tr class="u-bb-fg-5 u-text-right u-c-text">
    <td class="u-p-12">${s.orderIndex ?? s.order ?? 1}</td>
    <td class="u-p-12 u-bold">${esc(s.title || s.name || 'منزلگاه')}</td>
    <td class="u-p-12 u-c-text-muted">${s.releaseDate ? s.releaseDate.split('T')[0] : 'آزاد'}</td>
    <td class="u-p-12 u-c-text-muted">${esc(s.description || '-')}</td>
    <td class="u-p-12 u-text-center">
      <button data-click="editLmsStation" data-click-args="${esc(JSON.stringify([String(s.id)]))}" class="u-bg-info-strong u-c-white u-bd-none u-p-4-10 u-r-6 u-pointer">ویرایش</button>
      <button data-click="deleteLmsStation" data-click-args="${esc(JSON.stringify([String(s.id)]))}" class="u-bg-danger u-c-white u-bd-none u-p-4-10 u-r-6 u-pointer u-mr-4">حذف</button>
    </td>
  </tr>
`).join('');
    }
  } catch(e) { console.error(e); }
}

function cancelLmsBuilder() {
  document.getElementById('lms-builder-card').style.display = 'none';
}

function addCategoryUI(catData = null) {
  const container = document.getElementById('builder-categories-container');
  const catId = catData && catData.id ? catData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const catTitle = catData ? catData.title : '';
  const catOrder = catData ? catData.orderIndex : container.children.length;
  
  const catDiv = document.createElement('div');
  catDiv.className = 'builder-category-item';
  catDiv.dataset.id = catId;
  catDiv.style.cssText = 'background: rgb(var(--fg-rgb) / 0.03); border: 1px solid rgb(var(--fg-rgb) / 0.05); border-radius: 10px; padding: 15px; position: relative;';
  catDiv.innerHTML = `
    <div class="u-flex u-gap-10 u-items-center u-mb-10 u-wrap">
      <span class="u-bold u-fs-sm u-c-pink-text">دسته کلاس:</span>
      <input type="text" class="input-ctrl cat-title-input u-flex-2 u-minw-150 u-h-32 u-fs-xs" value="${esc(catTitle)}" required placeholder="عنوان دسته (مانند: پودمان اول)">
      <input type="number" class="input-ctrl cat-order-input u-w-70 u-h-32 u-fs-xs" value="${catOrder}" required placeholder="ترتیب">
      <button type="button" class="btn-primary u-bg-success u-p-4-10 u-fs-2xs u-h-32" data-click="addClassUI" data-click-args="[{&quot;$closest&quot;:&quot;.builder-category-item&quot;}]"><i class="fa-solid fa-plus"></i> افزودن کلاس</button>
      <button type="button" class="page-btn btn-danger u-p-4-10 u-fs-2xs u-h-32 u-mr-auto" data-click="NopaActions.removeClosest" data-click-args="[&quot;$this&quot;,&quot;.builder-category-item&quot;]"><i class="fa-solid fa-trash"></i> حذف دسته</button>
    </div>
    <div class="category-classes-container u-flex u-col u-gap-15 u-mt-16 u-pr-16 u-br-2-dashed-fg-10">
      <!-- Classes populated here -->
    </div>
  `;
  container.appendChild(catDiv);
  
  if (catData && catData.sessions) {
    catData.sessions.forEach(sess => {
      addClassUI(catDiv, sess);
    });
  }
}

function addClassUI(catEl, classData = null) {
  const container = catEl.querySelector('.category-classes-container');
  const classId = classData && classData.id ? classData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const classTitle = classData ? classData.title : '';
  const classDesc = classData ? (classData.description || '') : '';
  const classInstructor = classData ? (classData.instructor || '') : '';
  const minWatch = classData ? (classData.minWatchThreshold || 70) : 70;
  const minPass = classData ? (classData.minPassScore || 0) : 0;
  const maxZarik = classData ? (classData.maxZarikReward || 0) : 0;
  const classOrder = classData ? classData.orderIndex : container.children.length;
  
  const classDiv = document.createElement('div');
  classDiv.className = 'builder-class-item';
  classDiv.dataset.id = classId;
  classDiv.style.cssText = 'background: rgb(var(--fg-rgb) / 0.02); border: 1px solid rgb(var(--fg-rgb) / 0.03); border-radius: 8px; padding: 12px;';
  classDiv.innerHTML = `
    <div class="u-grid u-cols-fit-130 u-gap-10 u-mb-10">
      <div class="form-group u-col-span-span-2">
        <label class="u-fs-2xs u-c-primary-text">عنوان کلاس / درس</label>
        <input type="text" class="input-ctrl class-title-input u-h-30 u-fs-2xs" value="${esc(classTitle)}" required>
      </div>
      <div class="form-group u-col-span-span-2">
        <label class="u-fs-2xs u-c-primary-text">خلاصه/توضیح کلاس (سرفصل‌ها)</label>
        <input type="text" class="input-ctrl class-desc-input u-h-30 u-fs-2xs" value="${esc(classDesc)}" placeholder="مثال: ۱. معرفی دوره - ۲. قوانین">
      </div>
      <div class="form-group u-col-span-span-2">
        <label class="u-fs-2xs u-c-primary-text">نام استاد</label>
        <input type="text" class="input-ctrl class-instructor-input u-h-30 u-fs-2xs" value="${esc(classInstructor)}" placeholder="نام و نام خانوادگی">
      </div>
      <div class="form-group">
        <label class="u-fs-2xs u-c-primary-text">حداقل درصد تماشا</label>
        <input type="number" class="input-ctrl class-watch-input u-h-30 u-fs-2xs" value="${minWatch}" required>
      </div>
      <div class="form-group">
        <label class="u-fs-2xs u-c-primary-text">ترتیب کلاس</label>
        <input type="number" class="input-ctrl class-order-input u-h-30 u-fs-2xs" value="${classOrder}" required>
      </div>
    </div>
    <div class="u-flex u-gap-8 u-mb-10">
      <button type="button" class="btn-primary u-bg-accent u-p-4-8 u-fs-2xs" data-click="addClipUI" data-click-args="[{&quot;$closest&quot;:&quot;.builder-class-item&quot;}]"><i class="fa-solid fa-video"></i> + پارت/کلیپ ویدیو</button>
      <button type="button" class="btn-primary u-p-4-8 u-fs-2xs u-bg-pink" data-click="addQuizUI" data-click-args="[{&quot;$closest&quot;:&quot;.builder-class-item&quot;}]"><i class="fa-solid fa-circle-question"></i> + آزمون ارزیابی</button>
      <button type="button" class="page-btn btn-danger u-p-4-8 u-fs-2xs u-mr-auto" data-click="NopaActions.removeClosest" data-click-args="[&quot;$this&quot;,&quot;.builder-class-item&quot;]"><i class="fa-solid fa-trash"></i> حذف کلاس</button>
    </div>
    
    <!-- Video parts container -->
    <div class="class-clips-container u-flex u-col u-gap-8 u-m-10-10-0-0 u-pl-10 u-bl-2-solid-accent-20">
      <!-- Video parts clips populated here -->
    </div>
    
    <!-- Quiz container -->
    <div class="class-quiz-container u-mt-10">
      <!-- Quiz populated here -->
    </div>
  `;
  container.appendChild(classDiv);
  
  if (classData) {
    if (classData.videoClips) {
      classData.videoClips.forEach(clip => {
        addClipUI(classDiv, clip);
      });
    }
    if (classData.quiz) {
      addQuizUI(classDiv, classData.quiz);
    }
  }
}

// Reads the real length of the clip's video (metadata only) and writes it, in seconds, into the duration field.
window.detectClipDuration = function(urlInput) {
  const url = (urlInput.value || '').trim();
  const durInput = urlInput.closest('.builder-clip-item')?.querySelector('.clip-duration-input');
  if (!url || !durInput) return;
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) durInput.value = Math.round(video.duration);
    video.removeAttribute('src');
  };
  video.onerror = () => {};
  video.src = url;
};

window.uploadClipMediaDirect = async function(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assetType', 'course_video');
  
  const parent = input.parentElement;
  const statusEl = parent.querySelector('.clip-upload-status');
  const urlInput = input.closest('.builder-clip-item').querySelector('.clip-url-input');
  
  statusEl.innerText = 'در حال آپلود...';
  statusEl.style.color = 'var(--success-text)';
  
  try {
    const res = await request('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.url) {
      urlInput.value = data.url;
      statusEl.innerText = 'آپلود موفق!';
      window.detectClipDuration(urlInput);
    } else {
      statusEl.innerText = 'خطا در آپلود';
      statusEl.style.color = 'red';
    }
  } catch(e) {
    console.error(e);
    statusEl.innerText = 'خطا در آپلود';
    statusEl.style.color = 'red';
  }
}

function addClipUI(classEl, clipData = null) {
  const container = classEl.querySelector('.class-clips-container');
  const clipId = clipData && clipData.id ? clipData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const clipTitle = clipData ? clipData.title : '';
  const clipUrl = clipData ? clipData.videoUrl : '';
  const clipDur = clipData ? (clipData.duration || 0) : 0;
  const clipOrder = clipData ? clipData.clipOrder : container.children.length;
  
  const clipDiv = document.createElement('div');
  clipDiv.className = 'builder-clip-item';
  clipDiv.dataset.id = clipId;
  clipDiv.style.cssText = 'background: rgb(var(--accent-rgb) / 0.03); border: 1px solid rgb(var(--accent-rgb) / 0.08); border-radius: 6px; padding: 10px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;';
  clipDiv.innerHTML = `
    <span class="u-fs-2xs u-c-accent-text u-bold">پارت/کلیپ:</span>
    <input type="text" class="input-ctrl clip-title-input u-flex-1 u-minw-100 u-h-28 u-fs-2xs" value="${esc(clipTitle)}" required placeholder="عنوان پارت">
    <input type="text" class="input-ctrl clip-url-input u-flex-2 u-minw-150 u-h-28 u-fs-2xs" value="${esc(clipUrl)}" required placeholder="آدرس مستقیم ویدیو" data-change="detectClipDuration" data-change-args="[&quot;$this&quot;]">
    <input type="number" class="input-ctrl clip-duration-input u-w-75 u-h-28 u-fs-2xs" value="${clipDur}" required placeholder="مدت (ثانیه) - خودکار از ویدیو">
    <input type="number" class="input-ctrl clip-order-input u-w-50 u-h-28 u-fs-2xs" value="${clipOrder}" required placeholder="ترتیب">
    <div class="u-flex u-items-center u-gap-6">
      <input type="file" data-change="uploadClipMediaDirect" data-change-args="[&quot;$this&quot;]" class="input-ctrl u-w-130 u-h-28 u-fs-2xs u-p-2" accept="video/*">
      <small class="clip-upload-status u-fs-2xs u-c-success-text"></small>
    </div>
    <button type="button" class="page-btn btn-danger u-p-2-6 u-fs-2xs u-mr-auto" data-click="NopaActions.removeClosest" data-click-args="[&quot;$this&quot;,&quot;.builder-clip-item&quot;]"><i class="fa-solid fa-times"></i> حذف پارت</button>
  `;
  container.appendChild(clipDiv);
}

function addQuizUI(classEl, quizData = null) {
  const container = classEl.querySelector('.class-quiz-container');
  // Check if quiz already exists
  if (container.children.length > 0) return;
  
  const quizId = quizData && quizData.id ? quizData.id : 'new_' + Math.random().toString(36).substring(2, 9);
  const quizTitle = quizData ? quizData.title : 'آزمون پایان کلاس';
  const rewardZarik = quizData ? (quizData.rewardZarik || 0) : 10;
  let qJson = [];
  if (quizData && quizData.questionsJson) {
    try {
      qJson = typeof quizData.questionsJson === 'string' ? JSON.parse(quizData.questionsJson) : quizData.questionsJson;
    } catch(e) { console.error('questionsJson parse error', e); }
  }
  const quizType = quizData ? (quizData.type || 'MULTIPLE_CHOICE') : 'MULTIPLE_CHOICE';

  const quizDiv = document.createElement('div');
  quizDiv.className = 'builder-quiz-item';
  quizDiv.dataset.id = quizId;
  quizDiv.style.cssText = 'background: rgba(224,64,251,0.03); border: 1px solid rgba(224,64,251,0.08); border-radius: 6px; padding: 10px;';
  quizDiv.innerHTML = `
    <div class="u-flex u-gap-10 u-items-center u-mb-8">
      <span class="u-fs-2xs u-bold u-c-pink-text">آزمون ارزیابی:</span>
      <input type="text" class="input-ctrl quiz-title-input u-flex-2 u-h-28 u-fs-2xs" value="${esc(quizTitle)}" required placeholder="عنوان آزمون">
      <select class="select-ctrl quiz-type-input u-w-100 u-h-28 u-fs-2xs">
        <option value="MULTIPLE_CHOICE" ${quizType === 'MULTIPLE_CHOICE' ? 'selected' : ''}>تستی (۴ گزینه‌ای)</option>
        <option value="TEXT" ${quizType === 'TEXT' ? 'selected' : ''}>تشریحی (متنی)</option>
        <option value="FILE" ${quizType === 'FILE' ? 'selected' : ''}>ارسال فایل</option>
      </select>
      <input type="number" class="input-ctrl quiz-zarik-input u-w-85 u-h-28 u-fs-2xs" value="${rewardZarik}" required placeholder="پاداش زریک">
      <button type="button" class="btn-primary u-p-2-8 u-fs-2xs u-bg-pink" data-click="addQuizQuestionUI" data-click-args="[{&quot;$closest&quot;:&quot;.builder-quiz-item&quot;}]"><i class="fa-solid fa-plus"></i> افزودن سوال/فیلد</button>
      <button type="button" class="page-btn btn-danger u-p-2-8 u-fs-2xs u-mr-auto" data-click="NopaActions.removeClosest" data-click-args="[&quot;$this&quot;,&quot;.builder-quiz-item&quot;]"><i class="fa-solid fa-times"></i> حذف آزمون</button>
    </div>
    
    <div class="quiz-questions-container u-flex u-col u-gap-8 u-mt-8 u-pr-10 u-br-dashed-pink-20">
      <!-- Questions list -->
    </div>
  `;
  container.appendChild(quizDiv);
  
  if (qJson.length > 0) {
    qJson.forEach(q => {
      addQuizQuestionUI(quizDiv, q);
    });
  } else {
    // Add one empty question by default
    addQuizQuestionUI(quizDiv);
  }
}

function addQuizQuestionUI(quizEl, qData = null) {
  const container = quizEl.querySelector('.quiz-questions-container');
  const qText = qData ? qData.q : '';
  const options = qData && qData.options ? qData.options : ['', '', '', ''];
  const correctIdx = qData ? (qData.correct || 0) : 0;
  
  const qDiv = document.createElement('div');
  qDiv.className = 'builder-question-item';
  qDiv.style.cssText = 'background: rgb(var(--fg-rgb) / 0.01); border: 1px solid rgb(var(--fg-rgb) / 0.02); border-radius: 5px; padding: 8px;';
  qDiv.innerHTML = `
    <div class="u-flex u-gap-8 u-mb-6 u-items-center">
      <span class="u-fs-2xs u-c-text-soft">صورت سوال:</span>
      <input type="text" class="input-ctrl question-text-input u-flex-1 u-h-26 u-fs-2xs" value="${qText}" required placeholder="متن سوال ارزیابی را وارد کنید">
      <button title="حذف" aria-label="حذف" type="button" class="page-btn btn-danger u-p-1-6 u-fs-2xs" data-click="NopaActions.removeClosest" data-click-args="[&quot;$this&quot;,&quot;.builder-question-item&quot;]"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div class="u-grid u-cols-2 u-gap-8 u-pr-16">
      <div class="u-flex u-items-center u-gap-6">
        <input type="radio" name="correct_radio_${Math.random()}" class="correct-option-radio" value="0" ${correctIdx === 0 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input u-h-24 u-fs-2xs" value="${esc(options[0] || '')}" required placeholder="گزینه ۱">
      </div>
      <div class="u-flex u-items-center u-gap-6">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="1" ${correctIdx === 1 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input u-h-24 u-fs-2xs" value="${esc(options[1] || '')}" required placeholder="گزینه ۲">
      </div>
      <div class="u-flex u-items-center u-gap-6">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="2" ${correctIdx === 2 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input u-h-24 u-fs-2xs" value="${esc(options[2] || '')}" required placeholder="گزینه ۳">
      </div>
      <div class="u-flex u-items-center u-gap-6">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="3" ${correctIdx === 3 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input u-h-24 u-fs-2xs" value="${esc(options[3] || '')}" required placeholder="گزینه ۴">
      </div>
    </div>
  `;
  
  // Set shared radio name per question
  const radioName = 'correct_radio_' + Math.random().toString(36).substring(2, 9);
  qDiv.querySelectorAll('.correct-option-radio').forEach(r => r.name = radioName);
  
  container.appendChild(qDiv);
}

function editLmsStation(stationId) {
  const station = window.lmsStations.find(s => s.id === stationId);
  if (!station) return;
  
  document.getElementById('lms-station-id').value = station.id;
  document.getElementById('lms-station-title').value = station.title;
  document.getElementById('lms-station-order').value = station.orderIndex;
  document.getElementById('lms-station-release-date').value = station.releaseDate ? station.releaseDate.substring(0, 10) : '';
  document.getElementById('lms-station-release-time').value = station.releaseTime || '';
  document.getElementById('lms-station-desc').value = station.description || '';
  document.getElementById('lms-station-icon').value = station.iconUrl || '';
  
  const container = document.getElementById('builder-categories-container');
  container.innerHTML = '';
  
  document.getElementById('lms-builder-title').innerText = `ویرایش منزلگاه: ${esc(station.title)}`;
  document.getElementById('lms-builder-card').style.display = 'block';
  
  if (station.categories) {
    station.categories.forEach(cat => {
      addCategoryUI(cat);
    });
  }
  
  document.getElementById('lms-builder-card').scrollIntoView({ behavior: NopaMotion.scrollBehavior() });
}

async function deleteLmsStation(stationId) {
  const row = NopaUndo.lastRow();
  if (!(await NopaConfirm('آیا از حذف این منزلگاه و تمام پارت‌های ویدیو و آزمون‌های آن مطمئن هستید؟'))) return;
  cancelLmsBuilder();
  // The row goes at once; deleted on the server only if not undone within 10s
  NopaUndo.later({
    message: 'منزلگاه حذف شد.',
    hide: () => NopaUndo.hideEl(row),
    commit: () => request(`/api/v1/admin/lms/stations/${stationId}`, { method: 'DELETE' }),
    done: () => loadLmsData(),
  });
}

// ----------------------------------------------------
// VIDEO CLIP UPLOAD & SUBMIT
// ----------------------------------------------------
