// LMS quiz editor modal (quiz per video part).
// Split out of the former lms.js (Phase 7).

// ==================== QUIZ EDITOR MODAL ====================

// Options: 2 to 8 rows, dragged by their grip (sortable "quiz-option" in station-dnd.js), added and removed here
const QUIZ_OPT_MIN = 2;
const QUIZ_OPT_MAX = 8;
const QUIZ_OPT_NAMES = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم'];

function quizOptionRow(text, checked) {
  return `
    <label class="lse-option">
      <span class="chl-opt-grip lse-grip" title="برای جابجایی بکشید" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
      <input type="radio" name="quiz-correct-opt" value="0" ${checked ? 'checked' : ''}>
      <span class="chl-opt-num"></span>
      <input type="text" class="input-ctrl quiz-opt-text" value="${esc(text)}" required>
      <button type="button" class="lsv-round lsv-round-sm lsv-round-danger chl-opt-del" title="حذف گزینه"><i class="fa-solid fa-xmark"></i></button>
    </label>`;
}

window.quizRenumberOptions = function() {
  const rows = Array.from(document.querySelectorAll('#quiz-opts .lse-option'));
  rows.forEach((row, i) => {
    const radio = row.querySelector('input[type="radio"]');
    radio.value = String(i);
    radio.setAttribute('aria-label', `گزینه‌ی ${i + 1} پاسخ درست است`);
    row.querySelector('.chl-opt-num').textContent = lmsFaDigits(i + 1);
    const input = row.querySelector('.quiz-opt-text');
    input.setAttribute('aria-label', `متن گزینه‌ی ${i + 1}`);
    input.placeholder = `گزینه ${QUIZ_OPT_NAMES[i] || lmsFaDigits(i + 1)}`;
    row.querySelector('.chl-opt-del').disabled = rows.length <= QUIZ_OPT_MIN;
  });
  if (rows.length && !rows.some(r => r.querySelector('input[type="radio"]').checked)) rows[0].querySelector('input[type="radio"]').checked = true;
  const add = document.getElementById('quiz-opt-add');
  if (add) add.disabled = rows.length >= QUIZ_OPT_MAX;
};

function quizSetOptions(texts, correctIdx) {
  const box = document.getElementById('quiz-opts');
  if (!box) return;
  const list = texts.slice(0, QUIZ_OPT_MAX);
  while (list.length < QUIZ_OPT_MIN) list.push('');
  box.innerHTML = list.map((t, i) => quizOptionRow(t, i === Number(correctIdx))).join('');
  window.quizRenumberOptions();
}

(function bindQuizOptions() {
  const bind = () => {
    const box = document.getElementById('quiz-opts');
    const add = document.getElementById('quiz-opt-add');
    if (!box || !add || box.dataset.bound) return;
    box.dataset.bound = '1';
    add.addEventListener('click', () => {
      if (box.querySelectorAll('.lse-option').length >= QUIZ_OPT_MAX) return;
      box.insertAdjacentHTML('beforeend', quizOptionRow('', false));
      window.quizRenumberOptions();
      box.lastElementChild.querySelector('.quiz-opt-text').focus();
    });
    box.addEventListener('click', e => {
      const del = e.target.closest('.chl-opt-del');
      if (!del) return;
      e.preventDefault();
      if (box.querySelectorAll('.lse-option').length <= QUIZ_OPT_MIN) return;
      del.closest('.lse-option').remove();
      window.quizRenumberOptions();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();

window.openQuizModalForClip = function(sessionId, clipId) {
  const modal = document.getElementById('lms-quiz-editor-modal');
  if (!modal) return;

  document.getElementById('lms-quiz-form').reset();
  document.getElementById('quiz-modal-id').value = '';
  document.getElementById('quiz-modal-session-id').value = sessionId;
  document.getElementById('quiz-modal-clip-id').value = clipId;

  document.getElementById('quiz-modal-title-input').value = 'آزمونک پارت ویدیو';
  document.getElementById('quiz-modal-zarik').value = 10;
  document.getElementById('quiz-modal-q-text').value = 'مفهوم اصلی مطرح‌شده در این پارت کدام است؟';

  quizSetOptions(['گزینه صحیح (پاسخ درست)', 'گزینه نادرست اول', 'گزینه نادرست دوم', 'گزینه نادرست سوم'], 0);

  document.getElementById('quiz-modal-title').textContent = 'آزمونک جدید برای پارت';
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal-nested)';
};

window.editQuizRecord = async function(quizId) {
  let foundQuiz = null;
  let foundSession = null;

  // 1. Search in master list across sessions and clips
  window.lmsStationsMasterList.forEach(st => {
    (st.categories || []).forEach(cat => {
      (cat.sessions || []).forEach(sess => {
        (sess.quizzes || []).forEach(q => {
          if (q.id === quizId) { foundQuiz = q; foundSession = sess; }
        });
        (sess.videoClips || []).forEach(clip => {
          (clip.quizzes || []).forEach(q => {
            if (q.id === quizId) { foundQuiz = q; foundSession = sess; }
          });
        });
      });
    });
  });

  // 2. Fallback fetch from API if not found
  if (!foundQuiz) {
    try {
      const res = await request(`/api/v1/admin/lms/quizzes`);
      const allQ = await res.json();
      if (Array.isArray(allQ)) {
        foundQuiz = allQ.find(q => q.id === quizId);
      }
    } catch(e) {}
  }

  if (!foundQuiz) {
    showToast('آزمونک مورد نظر یافت نشد.', 'error');
    return;
  }

  const modal = document.getElementById('lms-quiz-editor-modal');
  if (!modal) return;

  document.getElementById('quiz-modal-id').value = foundQuiz.id;
  document.getElementById('quiz-modal-session-id').value = foundQuiz.sessionId || (foundSession ? foundSession.id : '');
  document.getElementById('quiz-modal-clip-id').value = foundQuiz.clipId || '';

  document.getElementById('quiz-modal-title-input').value = foundQuiz.title || 'آزمونک پارت';
  document.getElementById('quiz-modal-zarik').value = (foundQuiz.rewardZarik !== undefined && foundQuiz.rewardZarik !== null) ? foundQuiz.rewardZarik : 10;

  let qText = 'سوال پارت';
  let opts = ['گزینه اول', 'گزینه دوم', 'گزینه سوم', 'گزینه چهارم'];
  let correctIdx = 0;

  if (foundQuiz.questionsJson) {
    try {
      const parsed = typeof foundQuiz.questionsJson === 'string' ? JSON.parse(foundQuiz.questionsJson) : foundQuiz.questionsJson;
      if (Array.isArray(parsed) && parsed[0]) {
        qText = parsed[0].question || qText;
        if (Array.isArray(parsed[0].options)) opts = parsed[0].options;
        correctIdx = parsed[0].correctIndex ?? 0;
      }
    } catch (e) {
      console.error('Quiz parse error:', e);
    }
  }

  document.getElementById('quiz-modal-q-text').value = qText;
  quizSetOptions(opts, correctIdx);

  document.getElementById('quiz-modal-title').textContent = `ویرایش آزمونک: ${foundQuiz.title || ''}`;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal-nested)';
};

window.saveQuizFromModal = async function(e) {
  e.preventDefault();
  const id = document.getElementById('quiz-modal-id')?.value;
  const sessionId = document.getElementById('quiz-modal-session-id')?.value;
  const clipId = document.getElementById('quiz-modal-clip-id')?.value;

  const title = document.getElementById('quiz-modal-title-input')?.value;
  const rawZarik = parseInt(document.getElementById('quiz-modal-zarik')?.value, 10);
  const rewardZarik = Number.isFinite(rawZarik) && rawZarik >= 0 ? rawZarik : 10; // 0 is a valid reward

  const question = document.getElementById('quiz-modal-q-text')?.value;
  const opts = Array.from(document.querySelectorAll('#quiz-opts .quiz-opt-text')).map(i => i.value);
  const correctIndex = parseInt(document.querySelector('input[name="quiz-correct-opt"]:checked')?.value) || 0;

  const questionsJson = JSON.stringify([
    {
      question,
      options: opts,
      correctIndex
    }
  ]);

  const payload = {
    id: id || undefined,
    sessionId,
    clipId: clipId || undefined,
    title,
    rewardZarik,
    questionsJson
  };

  try {
    const res = await request('/api/v1/admin/lms/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'  },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('آزمونک (متن سوال، گزینه‌ها، پاسخ صحیح و پاداش زریک) با موفقیت در دیتابیس ذخیره شد', 'success');
      document.getElementById('lms-quiz-editor-modal').style.display = 'none';
      await window.fetchLiveLmsStations();
      // only this quiz changes; shown at once even if the list was read before the change landed
      if (id) lmsEachQuiz(q => { if (String(q.id) === String(id)) q.rewardZarik = rewardZarik; });
      // the station editor redraws with its unsaved draft kept (js/features/lms/station-editor.js)
      if (typeof window.lmsEditorRefresh === 'function') window.lmsEditorRefresh();
    } else {
      const data = await res.json();
      showToast('خطا در ذخیره‌سازی آزمونک: ' + (data.error || 'خطای ناشناخته'), 'error');
    }
  } catch (err) {
    console.error('Save quiz error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.deleteQuizRecord = async function(quizId) {
  const row = NopaUndo.lastRow('.lse-quiz');
  if (!(await NopaConfirm('آیا از حذف این آزمونک اطمینان دارید؟'))) return;
  const modal = document.getElementById('lms-quiz-editor-modal');
  if (modal) modal.style.display = 'none';
  // Gone from the part at once; deleted on the server only if not undone within 10s
  NopaUndo.later({
    message: 'آزمونک حذف شد.',
    hide: () => NopaUndo.hideEl(row),
    commit: () => request(`/api/v1/admin/lms/quizzes/${quizId}`, { method: 'DELETE' }),
    done: async () => {
      await window.fetchLiveLmsStations();
      if (typeof window.lmsEditorRefresh === 'function') window.lmsEditorRefresh();
    },
  });
};

// Calls fn for every quiz in the loaded station list (session quizzes and part quizzes)
function lmsEachQuiz(fn) {
  (window.lmsStationsMasterList || []).forEach(st => (st.categories || []).forEach(c => (c.sessions || []).forEach(s => {
    (s.quizzes || []).forEach(fn);
    (s.videoClips || []).forEach(clip => (clip.quizzes || []).forEach(fn));
  })));
}
