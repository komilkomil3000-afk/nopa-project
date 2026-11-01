// "Needs attention" counts (pending mentor documents, submissions waiting for review, open tickets).
// Used by the header bell (js/layout/topnav.js) and, later, the dashboard. Loaded before the feature modules (js/app, js/features).
//   NopaAttention.fetch(isSectionAllowed) -> Promise<[{ key, label, icon, tab, count }]>
// Only sections the user may open are requested (sub admins would get 403 otherwise).
(function () {
  const list = d => (Array.isArray(d) ? d : (d && (d.data || d.items || d.documents || d.submissions || d.tickets)) || []);

  const SOURCES = [
    {
      key: 'docs', section: 'mentors', tab: 'mentors-docs-tab',
      label: 'مدارک راهبران در انتظار تایید', icon: 'fa-solid fa-file-circle-check',
      url: '/api/v1/admin/mentors/documents/pending', count: d => list(d).length,
    },
    {
      key: 'submissions', section: 'challenges', tab: 'submissions-tab',
      label: 'تکالیف در انتظار ارزیابی', icon: 'fa-solid fa-trophy',
      url: '/api/v1/admin/submissions?status=pending', count: d => list(d).length,
    },
    {
      key: 'tickets', section: 'support', tab: 'mentors-tickets-tab',
      label: 'تیکت‌های باز', icon: 'fa-solid fa-inbox',
      url: '/api/v1/admin/tickets?status=OPEN', count: d => list(d).filter(t => !t.status || /^open$/i.test(t.status)).length,
    },
  ];

  async function fetchCounts(isSectionAllowed) {
    const allowed = SOURCES.filter(s => !isSectionAllowed || isSectionAllowed(s.section));
    return Promise.all(allowed.map(async s => {
      try {
        const res = await request(s.url, { silent: true });
        if (!res.ok) return Object.assign({}, s, { count: null });
        return Object.assign({}, s, { count: s.count(await res.json()) });
      } catch (_) {
        return Object.assign({}, s, { count: null });
      }
    }));
  }

  window.NopaAttention = { SOURCES, fetch: fetchCounts };
})();
