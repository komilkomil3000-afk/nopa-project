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
  <tr style="border-bottom: 1px solid rgb(var(--fg-rgb) / 0.05); text-align: right; color: var(--text);">
    <td style="padding: 12px;">${s.orderIndex ?? s.order ?? 1}</td>
    <td style="padding: 12px; font-weight: bold;">${esc(s.title || s.name || 'منزلگاه')}</td>
    <td style="padding: 12px; color: var(--text-muted);">${s.releaseDate ? s.releaseDate.split('T')[0] : 'آزاد'}</td>
    <td style="padding: 12px; color: var(--text-muted);">${esc(s.description || '-')}</td>
    <td style="padding: 12px; text-align: center;">
      <button onclick="editLmsStation('${s.id}')" style="background:var(--info-strong); color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer;">ویرایش</button>
      <button onclick="deleteLmsStation('${s.id}')" style="background:var(--danger); color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; margin-right:4px;">حذف</button>
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
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
      <span style="color: #EC4899; font-weight: bold; font-size: 13px;">دسته کلاس:</span>
      <input type="text" class="input-ctrl cat-title-input" value="${esc(catTitle)}" required placeholder="عنوان دسته (مانند: پودمان اول)" style="flex: 2; min-width: 150px; height: 32px; font-size: 12px;">
      <input type="number" class="input-ctrl cat-order-input" value="${catOrder}" required placeholder="ترتیب" style="width: 70px; height: 32px; font-size: 12px;">
      <button type="button" class="btn-primary" style="background: var(--success); padding: 4px 10px; font-size: 11px; height: 32px;" onclick="addClassUI(this.closest('.builder-category-item'))"><i class="fa-solid fa-plus"></i> افزودن کلاس</button>
      <button type="button" class="page-btn btn-danger" style="padding: 4px 10px; font-size: 11px; height: 32px; margin-right: auto;" onclick="this.closest('.builder-category-item').remove()"><i class="fa-solid fa-trash"></i> حذف دسته</button>
    </div>
    <div class="category-classes-container" style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px; padding-right: 15px; border-right: 2px dashed rgb(var(--fg-rgb) / 0.1);">
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
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 10px;">
      <div class="form-group" style="grid-column: span 2;">
        <label style="font-size: 10px; color: var(--primary-text);">عنوان کلاس / درس</label>
        <input type="text" class="input-ctrl class-title-input" value="${esc(classTitle)}" required style="height: 30px; font-size: 11px;">
      </div>
      <div class="form-group" style="grid-column: span 2;">
        <label style="font-size: 10px; color: var(--primary-text);">خلاصه/توضیح کلاس (سرفصل‌ها)</label>
        <input type="text" class="input-ctrl class-desc-input" value="${esc(classDesc)}" style="height: 30px; font-size: 11px;" placeholder="مثال: ۱. معرفی دوره - ۲. قوانین">
      </div>
      <div class="form-group" style="grid-column: span 2;">
        <label style="font-size: 10px; color: var(--primary-text);">نام استاد</label>
        <input type="text" class="input-ctrl class-instructor-input" value="${esc(classInstructor)}" style="height: 30px; font-size: 11px;" placeholder="نام و نام خانوادگی">
      </div>
      <div class="form-group">
        <label style="font-size: 10px; color: var(--primary-text);">حداقل درصد تماشا</label>
        <input type="number" class="input-ctrl class-watch-input" value="${minWatch}" required style="height: 30px; font-size: 11px;">
      </div>
      <div class="form-group">
        <label style="font-size: 10px; color: var(--primary-text);">ترتیب کلاس</label>
        <input type="number" class="input-ctrl class-order-input" value="${classOrder}" required style="height: 30px; font-size: 11px;">
      </div>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
      <button type="button" class="btn-primary" style="background:var(--accent); padding: 3px 8px; font-size: 10px;" onclick="addClipUI(this.closest('.builder-class-item'))"><i class="fa-solid fa-video"></i> + پارت/کلیپ ویدیو</button>
      <button type="button" class="btn-primary" style="background:#e040fb; padding: 3px 8px; font-size: 10px;" onclick="addQuizUI(this.closest('.builder-class-item'))"><i class="fa-solid fa-circle-question"></i> + آزمون ارزیابی</button>
      <button type="button" class="page-btn btn-danger" style="padding: 3px 8px; font-size: 10px; margin-right: auto;" onclick="this.closest('.builder-class-item').remove()"><i class="fa-solid fa-trash"></i> حذف کلاس</button>
    </div>
    
    <!-- Video parts container -->
    <div class="class-clips-container" style="display: flex; flex-direction: column; gap: 8px; margin: 10px 10px 0 0; padding-left: 10px; border-left: 2px solid rgb(var(--accent-rgb) / 0.2);">
      <!-- Video parts clips populated here -->
    </div>
    
    <!-- Quiz container -->
    <div class="class-quiz-container" style="margin-top: 10px;">
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
    <span style="font-size: 10px; color: var(--accent-text); font-weight: bold;">پارت/کلیپ:</span>
    <input type="text" class="input-ctrl clip-title-input" value="${esc(clipTitle)}" required placeholder="عنوان پارت" style="flex:1; min-width:100px; height:28px; font-size:11px;">
    <input type="text" class="input-ctrl clip-url-input" value="${esc(clipUrl)}" required placeholder="آدرس مستقیم ویدیو" onchange="window.detectClipDuration(this)" style="flex:2; min-width:150px; height:28px; font-size:11px;">
    <input type="number" class="input-ctrl clip-duration-input" value="${clipDur}" required placeholder="مدت (ثانیه) - خودکار از ویدیو" style="width:75px; height:28px; font-size:11px;">
    <input type="number" class="input-ctrl clip-order-input" value="${clipOrder}" required placeholder="ترتیب" style="width:50px; height:28px; font-size:11px;">
    <div style="display: flex; align-items: center; gap: 5px;">
      <input type="file" onchange="uploadClipMediaDirect(this)" class="input-ctrl" accept="video/*" style="width: 130px; height: 28px; font-size: 9px; padding: 2px;">
      <small class="clip-upload-status" style="font-size: 9px; color: var(--success-text);"></small>
    </div>
    <button type="button" class="page-btn btn-danger" style="padding: 2px 6px; font-size: 10px; margin-right: auto;" onclick="this.closest('.builder-clip-item').remove()"><i class="fa-solid fa-times"></i> حذف پارت</button>
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
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 11px; color: #e040fb; font-weight: bold;">آزمون ارزیابی:</span>
      <input type="text" class="input-ctrl quiz-title-input" value="${esc(quizTitle)}" required placeholder="عنوان آزمون" style="flex:2; height:28px; font-size:11px;">
      <select class="select-ctrl quiz-type-input" style="width:100px; height:28px; font-size:11px;">
        <option value="MULTIPLE_CHOICE" ${quizType === 'MULTIPLE_CHOICE' ? 'selected' : ''}>تستی (۴ گزینه‌ای)</option>
        <option value="TEXT" ${quizType === 'TEXT' ? 'selected' : ''}>تشریحی (متنی)</option>
        <option value="FILE" ${quizType === 'FILE' ? 'selected' : ''}>ارسال فایل</option>
      </select>
      <input type="number" class="input-ctrl quiz-zarik-input" value="${rewardZarik}" required placeholder="پاداش زریک" style="width:85px; height:28px; font-size:11px;">
      <button type="button" class="btn-primary" style="background:#e040fb; padding:2px 8px; font-size:9px;" onclick="addQuizQuestionUI(this.closest('.builder-quiz-item'))"><i class="fa-solid fa-plus"></i> افزودن سوال/فیلد</button>
      <button type="button" class="page-btn btn-danger" style="padding:2px 8px; font-size:9px; margin-right: auto;" onclick="this.closest('.builder-quiz-item').remove()"><i class="fa-solid fa-times"></i> حذف آزمون</button>
    </div>
    
    <div class="quiz-questions-container" style="display:flex; flex-direction:column; gap:8px; margin-top:8px; padding-right: 10px; border-right: 2px dashed rgba(224,64,251,0.2);">
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
    <div style="display: flex; gap: 8px; margin-bottom: 5px; align-items: center;">
      <span style="font-size: 10px; color: var(--text-soft);">صورت سوال:</span>
      <input type="text" class="input-ctrl question-text-input" value="${qText}" required placeholder="متن سوال ارزیابی را وارد کنید" style="flex:1; height:26px; font-size:10px;">
      <button type="button" class="page-btn btn-danger" style="padding:1px 5px; font-size:9px;" onclick="this.closest('.builder-question-item').remove()"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-right: 15px;">
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="correct_radio_${Math.random()}" class="correct-option-radio" value="0" ${correctIdx === 0 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${esc(options[0] || '')}" required placeholder="گزینه ۱" style="height:24px; font-size:10px;">
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="1" ${correctIdx === 1 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${esc(options[1] || '')}" required placeholder="گزینه ۲" style="height:24px; font-size:10px;">
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="2" ${correctIdx === 2 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${esc(options[2] || '')}" required placeholder="گزینه ۳" style="height:24px; font-size:10px;">
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        <input type="radio" name="${Math.random()}" class="correct-option-radio" value="3" ${correctIdx === 3 ? 'checked' : ''}>
        <input type="text" class="input-ctrl option-input" value="${esc(options[3] || '')}" required placeholder="گزینه ۴" style="height:24px; font-size:10px;">
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
  
  document.getElementById('lms-builder-card').scrollIntoView({ behavior: 'smooth' });
}

async function deleteLmsStation(stationId) {
  if ((await NopaConfirm('آیا از حذف این منزلگاه و تمام پارت‌های ویدیو و آزمون‌های آن مطمئن هستید؟ این عملیات غیرقابل بازگشت است.'))) {
    try {
      const res = await request(`/api/v1/admin/lms/stations/${stationId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('منزلگاه با موفقیت حذف شد', 'success');
        loadLmsData();
        cancelLmsBuilder();
      } else {
        showToast('خطا در حذف منزلگاه', 'error');
      }
    } catch(e) {
      console.error(e);
      showToast('خطا در ارتباط با سرور', 'error');
    }
  }
}

// ----------------------------------------------------
// VIDEO CLIP UPLOAD & SUBMIT
// ----------------------------------------------------
