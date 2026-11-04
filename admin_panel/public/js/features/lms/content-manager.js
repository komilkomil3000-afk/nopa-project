// LMS content actions that change a station's structure on the server right away: add / delete class categories,
// sessions and video parts, the per-category batch tools (instructor, zarik) and file upload.
// Field edits (titles, dates, links, descriptions...) are not saved here: the station editor keeps them as a draft
// and saves them all with one button (js/features/lms/station-editor.js). After each action the station list is
// reloaded and the editor redrawn; its unsaved draft survives the redraw.

async function lmsReloadContentModal(stationId, select) {
  await window.fetchLiveLmsStations();
  if (typeof window.lmsEditorRefresh === 'function') window.lmsEditorRefresh(stationId, select);
}

async function lmsErrorText(res) {
  try { const d = await res.json(); return d.error || 'خطای سرور'; } catch (_) { return 'خطای سرور'; }
}

async function lmsResponseData(res) {
  try { const d = await res.json(); return d && (d.data || d); } catch (_) { return null; }
}

function lmsFindStation(stationId) {
  return (window.lmsStationsMasterList || []).find(s => String(s.id) === String(stationId));
}

function lmsFindSession(sessionId) {
  for (const st of window.lmsStationsMasterList || []) {
    for (const c of st.categories || []) {
      const s = (c.sessions || []).find(x => String(x.id) === String(sessionId));
      if (s) return { station: st, category: c, session: s };
    }
  }
  return null;
}

// ==================== CLASS CATEGORIES (= CLASS TABS IN THE APP) ====================
// The app shows one class tab per category of the station, under the category's title and in this order.

// title: given by the caller, else read from the "new category" field of the editor
window.addNewCategoryToStation = async function(stationId, title) {
  const input = document.getElementById(`new-cat-title-${stationId}`);
  title = String(title ?? input?.value ?? '').trim();
  if (!title) {
    showToast('لطفاً عنوان دسته کلاس جدید را وارد نمایید.', 'error');
    input?.focus();
    return null;
  }
  const ordered = window.lmsOrderedCategories(lmsFindStation(stationId));
  const nextOrder = ordered.reduce((m, c) => Math.max(m, Number(c.orderIndex) || 0), 0) + 1;
  try {
    const res = await request('/api/v1/admin/lms/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId, title, orderIndex: nextOrder })
    });
    if (!res.ok) {
      showToast('خطا در افزودن دسته: ' + (await lmsErrorText(res)), 'error');
      return null;
    }
    const created = await lmsResponseData(res);
    showToast(`دسته «${title}» اضافه شد و در اپلیکیشن به‌عنوان تب ${ordered.length + 1} صفحه کلاس‌ها نمایش داده می‌شود.`, 'success');
    await lmsReloadContentModal(stationId, created?.id ? `cat:${created.id}` : null);
    return created?.id || null;
  } catch (err) {
    console.error('Add category error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
    return null;
  }
};

window.deleteCategoryRecord = async function(categoryId, stationId) {
  const cat = window.lmsOrderedCategories(lmsFindStation(stationId)).find(c => String(c.id) === String(categoryId));
  const count = cat ? (cat.sessions || []).filter(s => !s.isDeleted).length : 0;
  const ok = await NopaConfirm(`آیا از حذف دسته «${cat?.title || ''}» اطمینان دارید؟ ${count} جلسه این دسته به همراه پارت‌ها و آزمونک‌هایشان حذف می‌شوند و تب آن از صفحه کلاس‌های اپلیکیشن برداشته می‌شود.`);
  if (!ok) return;
  try {
    const res = await request(`/api/v1/admin/lms/classes/${categoryId}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('خطا در حذف دسته: ' + (await lmsErrorText(res)), 'error');
      return;
    }
    showToast('دسته کلاس حذف شد.', 'success');
    await lmsReloadContentModal(stationId);
  } catch (err) {
    console.error('Delete category error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

// ==================== SESSIONS ====================

// Resolves to the new session's id (or null)
window.addNewSessionToCategory = async function(categoryId, stationId) {
  const cat = window.lmsOrderedCategories(lmsFindStation(stationId)).find(c => String(c.id) === String(categoryId));
  const sessions = cat ? (cat.sessions || []).filter(s => !s.isDeleted) : [];
  const nextOrder = sessions.reduce((m, s) => Math.max(m, Number(s.orderIndex) || 0), 0) + 1;
  const instructor = sessions.length ? (sessions[sessions.length - 1].instructor || '') : '';
  try {
    const res = await request('/api/v1/admin/lms/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, title: `جلسه ${nextOrder}`, instructor, orderIndex: nextOrder })
    });
    if (!res.ok) {
      showToast('خطا در افزودن جلسه: ' + (await lmsErrorText(res)), 'error');
      return null;
    }
    const created = await lmsResponseData(res);
    showToast(`جلسه ${nextOrder} به دسته «${cat?.title || ''}» اضافه شد.`, 'success');
    await lmsReloadContentModal(stationId, created?.id ? `sess:${created.id}` : null);
    return created?.id || null;
  } catch (err) {
    console.error('Add session error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
    return null;
  }
};

window.deleteSessionRecord = async function(sessionId, stationId) {
  if (!(await NopaConfirm('آیا از حذف این جلسه به همراه همه پارت‌ها و آزمونک‌های آن اطمینان دارید؟'))) return;
  try {
    const res = await request(`/api/v1/admin/lms/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('خطا در حذف جلسه: ' + (await lmsErrorText(res)), 'error');
      return;
    }
    showToast('جلسه حذف شد.', 'success');
    await lmsReloadContentModal(stationId);
  } catch (err) {
    console.error('Delete session error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

// ==================== VIDEO PARTS ====================

// A new part goes to the end of the session as "پارت N"; its title, link and schedule are then edited in place
window.addNewClipToSession = async function(sessionId) {
  const found = lmsFindSession(sessionId);
  const clips = (found && found.session.videoClips) || [];
  const nextOrder = clips.reduce((m, c) => Math.max(m, Number(c.clipOrder) || 0), 0) + 1;
  try {
    const res = await request('/api/v1/admin/lms/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, title: `پارت ${clips.length + 1}`, videoUrl: '', clipOrder: nextOrder })
    });
    if (!res.ok) {
      showToast('خطا در ایجاد پارت جدید: ' + (await lmsErrorText(res)), 'error');
      return;
    }
    await lmsReloadContentModal(found?.station.id, `sess:${sessionId}`);
  } catch (err) {
    console.error('Add clip error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.deleteClipRecord = async function(clipId, sessionId) {
  if (!(await NopaConfirm('آیا از حذف این پارت ویدیو و تمام آزمونک‌های متصل به آن اطمینان دارید؟'))) return;
  const found = lmsFindSession(sessionId);
  try {
    const res = await request(`/api/v1/admin/lms/clips/${clipId}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('خطا در حذف پارت: ' + (await lmsErrorText(res)), 'error');
      return;
    }
    showToast('پارت حذف شد.', 'success');
    await lmsReloadContentModal(found?.station.id, `sess:${sessionId}`);
  } catch (err) {
    console.error('Delete clip error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

// ==================== BATCH TOOLS OF A CATEGORY ====================

// Every quiz of a category (session quizzes and part quizzes; the same quiz can appear in both lists)
function lmsCategoryQuizzes(categoryId) {
  const out = [];
  for (const st of window.lmsStationsMasterList || []) {
    for (const c of st.categories || []) {
      if (String(c.id) !== String(categoryId)) continue;
      (c.sessions || []).forEach(s => {
        (s.quizzes || []).forEach(q => out.push(q));
        (s.videoClips || []).forEach(clip => (clip.quizzes || []).forEach(q => out.push(q)));
      });
    }
  }
  return out;
}
window.lmsCategoryQuizzes = lmsCategoryQuizzes;

window.applyBatchZarikToCategory = async function(categoryId, stationId) {
  const amount = parseInt(document.getElementById(`batch-zarik-cat-${categoryId}`)?.value, 10);
  if (isNaN(amount) || amount < 0) {
    showToast('لطفاً یک عدد معتبر برای پاداش زریک وارد نمایید.', 'error');
    return;
  }
  if (!(await NopaConfirm(`پاداش ${amount} زریک برای همه آزمونک‌های این دسته ثبت شود؟`))) return;
  try {
    const res = await request(`/api/v1/admin/lms/categories/${categoryId}/batch-zarik`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardZarik: amount })
    });
    if (!res.ok) {
      showToast('خطا در اعمال پاداش گروهی زریک: ' + (await lmsErrorText(res)), 'error');
      return;
    }
    const data = await lmsResponseData(res);
    showToast((data && data.message) || 'پاداش زریک روی همه آزمونک‌های این دسته اعمال شد.', 'success');
    await window.fetchLiveLmsStations();
    // The new amount is shown at once on every quiz of the category (and in each quiz's modal) even if the
    // station list that just came back was read before the change landed
    lmsCategoryQuizzes(categoryId).forEach(q => { q.rewardZarik = amount; });
    if (typeof window.lmsEditorRefresh === 'function') window.lmsEditorRefresh(stationId, `cat:${categoryId}`);
  } catch (err) {
    console.error('Batch zarik error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

window.applyBatchInstructorToCategory = async function(categoryId, stationId) {
  const instructor = (document.getElementById(`batch-instructor-cat-${categoryId}`)?.value || '').trim();
  if (!instructor) {
    showToast('لطفاً یک استاد را انتخاب نمایید.', 'error');
    return;
  }
  if (!(await NopaConfirm(`استاد همه جلسات این دسته «${instructor}» شود؟`))) return;
  try {
    const res = await request(`/api/v1/admin/lms/categories/${categoryId}/batch-instructor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructor })
    });
    if (!res.ok) {
      showToast('خطا در تخصیص یکجای استاد: ' + (await lmsErrorText(res)), 'error');
      return;
    }
    const data = await lmsResponseData(res);
    // unsaved instructor edits of these sessions would hide the new value
    if (typeof window.lmsEditorDropSessionEdits === 'function') window.lmsEditorDropSessionEdits(categoryId, 'instructor');
    showToast((data && data.message) || 'استاد همه جلسات این دسته به‌روزرسانی شد.', 'success');
    await lmsReloadContentModal(stationId, `cat:${categoryId}`);
  } catch (err) {
    console.error('Batch instructor error:', err);
    showToast('ارتباط با سرور برقرار نشد', 'error');
  }
};

// ==================== FILE UPLOAD ====================

// Uploads the chosen file and puts its link into the field targetInputId (an "input" event lets drafts and
// previews see the new value)
window.handleDirectFileUpload = async function(inputElement, targetInputId) {
  if (!inputElement.files || inputElement.files.length === 0) return;
  const formData = new FormData();
  formData.append('file', inputElement.files[0]);

  const targetEl = document.getElementById(targetInputId);
  const origPlaceholder = targetEl ? targetEl.placeholder : '';
  if (targetEl) targetEl.placeholder = 'در حال آپلود فایل...';

  try {
    const res = await request('/api/v1/media/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok && (data.url || data.media?.url)) {
      if (targetEl) {
        targetEl.value = data.url || data.media.url;
        targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showToast('فایل آپلود شد و لینک آن در کادر قرار گرفت.', 'success');
    } else {
      showToast('خطا در آپلود: ' + (data.error || 'خطای سرور'), 'error');
    }
  } catch (err) {
    console.error('Direct Upload Error:', err);
    showToast('خطا در ارتباط با سرور برای آپلود فایل', 'error');
  } finally {
    if (targetEl) targetEl.placeholder = origPlaceholder;
    inputElement.value = '';
  }
};
