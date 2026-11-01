// LMS quiz editor modal (quiz per video part).
// Split out of the former lms.js (Phase 7).

// ==================== QUIZ EDITOR MODAL ====================

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

  document.getElementById('quiz-opt-0').value = 'گزینه صحیح (پاسخ درست)';
  document.getElementById('quiz-opt-1').value = 'گزینه نادرست اول';
  document.getElementById('quiz-opt-2').value = 'گزینه نادرست دوم';
  document.getElementById('quiz-opt-3').value = 'گزینه نادرست سوم';
  document.getElementById('opt-radio-0').checked = true;

  document.getElementById('quiz-modal-title').innerHTML = '<i class="fa-solid fa-circle-question"></i> طراحی آزمونک جدید برای پارت';
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
  document.getElementById('quiz-opt-0').value = opts[0] || '';
  document.getElementById('quiz-opt-1').value = opts[1] || '';
  document.getElementById('quiz-opt-2').value = opts[2] || '';
  document.getElementById('quiz-opt-3').value = opts[3] || '';

  const radioEl = document.getElementById(`opt-radio-${correctIdx}`) || document.getElementById('opt-radio-0');
  if (radioEl) radioEl.checked = true;

  document.getElementById('quiz-modal-title').innerHTML = `<i class="fa-solid fa-circle-question"></i> ویرایش آزمونک: ${esc(foundQuiz.title || '')}`;
  modal.style.display = 'flex';
  modal.style.zIndex = 'var(--z-modal-nested)';
};

window.saveQuizFromModal = async function(e) {
  e.preventDefault();
  const id = document.getElementById('quiz-modal-id')?.value;
  const sessionId = document.getElementById('quiz-modal-session-id')?.value;
  const clipId = document.getElementById('quiz-modal-clip-id')?.value;

  const title = document.getElementById('quiz-modal-title-input')?.value;
  const rewardZarik = parseInt(document.getElementById('quiz-modal-zarik')?.value) || 10;

  const question = document.getElementById('quiz-modal-q-text')?.value;
  const opts = [
    document.getElementById('quiz-opt-0')?.value || '',
    document.getElementById('quiz-opt-1')?.value || '',
    document.getElementById('quiz-opt-2')?.value || '',
    document.getElementById('quiz-opt-3')?.value || ''
  ];
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
      if (sessionId) {
        const st = window.lmsStationsMasterList.find(s => 
          (s.categories || []).some(c => (c.sessions || []).some(sess => sess.id === sessionId))
        );
        if (st) window.openStationContentManagerModal(st.id);
      }
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
  if (!(await NopaConfirm('آیا از حذف این آزمونک اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/lms/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json'  }
    });
    if (res.ok) {
      showToast('آزمونک با موفقیت حذف شد', 'success');
      await window.fetchLiveLmsStations();
      document.getElementById('lms-quiz-editor-modal').style.display = 'none';
    }
  } catch (err) {
    console.error('Delete quiz error:', err);
  }
};
