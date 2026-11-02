// LMS stations directory: live station list, stats and the overview search.
// Split out of the former lms.js (Phase 7).

// LMS Stations Management & Directory Logic with Robust Station Finder & Modal Trigger
window.lmsStationsMasterList = [];

// A station's class categories are free text and there can be any number of them. Nothing here classifies a
// category by keywords in its title ("مهارت" / "رسانه"): a category is its position (orderIndex, ties broken by
// creation time) and is shown under its own title. The app uses the same rule, so its class tabs match this list.
window.lmsOrderedCategories = function(station) {
  return (station && station.categories ? station.categories : [])
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const oa = Number(a.c.orderIndex) || 0;
      const ob = Number(b.c.orderIndex) || 0;
      if (oa !== ob) return oa - ob;
      const ta = a.c.createdAt ? new Date(a.c.createdAt).getTime() : 0;
      const tb = b.c.createdAt ? new Date(b.c.createdAt).getTime() : 0;
      return ta !== tb ? ta - tb : a.i - b.i;
    })
    .map(x => x.c);
};

// Category filter value -> category position (0-based), or -1 for "all". Old values (مهارتی / رسانه‌ای) still work.
window.lmsCategoryFilterIndex = function(value) {
  if (!value || value === 'all') return -1;
  const m = String(value).match(/^cat:(\d+)$/);
  if (m) return Number(m[1]);
  if (value === 'مهارتی' || value === 'skill') return 0;
  if (value === 'رسانه‌ای' || value === 'media') return 1;
  return -1;
};

window.lmsCategoryColor = function(index) {
  return ['var(--info-text)', 'var(--primary-text)', 'var(--accent-text)', 'var(--success-text)'][index % 4];
};

window.fetchLiveLmsStations = async function() {
  if (!document.getElementById('lms-bento-stations')) return;
  // shimmer on the bento tiles while the first load runs (js/features/lms/station-view.js)
  const firstLoad = !window.lmsStationsMasterList.length;
  if (firstLoad && typeof window.lmsSetStationsLoading === 'function') window.lmsSetStationsLoading(true);

  try {
    let res = await request('/api/v1/lms/stations');
    if (!res.ok) {
      res = await request('/api/v1/admin/lms/stations');
    }

    if (res.ok) {
      const data = await res.json();
      window.lmsStationsMasterList = Array.isArray(data) ? data : (data.stations || data.data || []);
    } else {
      console.warn('Could not fetch live stations');
    }
  } catch (err) {
    console.error('Fetch live stations error:', err);
  }

  // Calculate stats dynamically from REAL database station, session, part & quiz counts
  const totalStations = window.lmsStationsMasterList.length;
  let totalSessions = 0;
  let totalParts = 0;
  const uniqueQuizIds = new Set();

  window.lmsStationsMasterList.forEach(st => {
    const cats = st.categories || [];
    cats.forEach(c => {
      const sessList = c.sessions || [];
      totalSessions += sessList.length;
      sessList.forEach(s => {
        const clips = s.videoClips || [];
        totalParts += clips.length;
        (s.quizzes || []).forEach(q => uniqueQuizIds.add(q.id));
        clips.forEach(clip => {
          (clip.quizzes || []).forEach(q => uniqueQuizIds.add(q.id));
        });
      });
    });
  });

  const totalQuizzes = uniqueQuizIds.size;

  // Numbers count to their new value (js/ui/flip.js)
  const setStat = (id, n, unit) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (window.NopaFlip) window.NopaFlip.count(el, n, v => `${v} ${unit}`);
    else el.textContent = `${n} ${unit}`;
  };
  setStat('lms-stat-stations', totalStations, 'منزلگاه');
  setStat('lms-stat-sessions', totalSessions, 'جلسه مصوب');
  setStat('lms-stat-parts', totalParts, 'پارت ویدیو');
  setStat('lms-stat-quizzes', totalQuizzes, 'آزمونک فعال');

  window.filterLmsTable();
  if (typeof window.lmsSetStationsLoading === 'function') window.lmsSetStationsLoading(false);
};

// Refresh buttons: the same shimmer as the first load, then the fresh data
window.reloadLmsStations = function() {
  if (typeof window.lmsSetStationsLoading === 'function') window.lmsSetStationsLoading(true);
  return window.fetchLiveLmsStations();
};

// Search box of the stations tile: station title / description, category titles, session titles, instructors
window.filterLmsTable = function() {
  const query = (document.getElementById('lms-search-input')?.value || '').trim().toLowerCase();
  const has = v => Boolean(v) && String(v).toLowerCase().includes(query);

  const filtered = !query ? window.lmsStationsMasterList : window.lmsStationsMasterList.filter(st =>
    has(st.title) || has(st.description) ||
    (st.categories || []).some(c => has(c.title) || (c.sessions || []).some(sess => has(sess.title) || has(sess.instructor)))
  );

  // Bento overview and the open station view (js/features/lms/station-view.js)
  if (typeof window.renderLmsStationsBento === 'function') {
    window.renderLmsStationsBento(filtered.length === window.lmsStationsMasterList.length ? null : filtered);
  }
};

// Loaded by showDashboard() (js/app/bootstrap.js) once the user is signed in
window.loadLmsStationsData = window.fetchLiveLmsStations;
