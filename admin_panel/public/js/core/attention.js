// "Needs attention" counts (pending mentor documents, submissions waiting for review, open tickets, open support cases).
// Used by the header bell (js/layout/topnav.js) and the dashboard. Loaded before the feature modules (js/app, js/features).
//   NopaAttention.fetch(isSectionAllowed) -> Promise<[{ key, label, icon, tab, count, recent }]>
//   recent: newest waiting messages of a support source, [{ id, who, text, at }] (the bell lists them)
// Only sections the user may open are requested (sub admins would get 403 otherwise).
(function () {
  const list = d => (Array.isArray(d) ? d : (d && (d.data || d.items || d.documents || d.submissions || d.tickets)) || []);
  const isOpen = t => !t.status || /^open$/i.test(t.status);

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
      label: 'تیکت‌ها و پیام‌های پشتیبانی باز', icon: 'fa-solid fa-inbox',
      url: '/api/v1/admin/tickets?status=OPEN', count: d => list(d).filter(isOpen).length,
      recent: d => list(d).filter(isOpen).map(t => ({ id: t.id, who: t.student && t.student.name, text: t.subject, at: t.createdAt })),
    },
    {
      key: 'cases', section: 'support', tab: 'support-cases-tab',
      label: 'پرونده‌های پشتیبانی باز', icon: 'fa-solid fa-life-ring',
      url: '/api/v1/admin/support-cases?status=open', count: d => list(d).filter(isOpen).length,
      recent: d => list(d).filter(isOpen).map(c => ({ id: c.id, who: c.user && c.user.name, text: c.subject, at: c.createdAt })),
    },
  ];

  async function fetchCounts(isSectionAllowed) {
    const allowed = SOURCES.filter(s => !isSectionAllowed || isSectionAllowed(s.section));
    return Promise.all(allowed.map(async s => {
      try {
        const res = await request(s.url, { silent: true });
        if (!res.ok) return Object.assign({}, s, { count: null, recent: [] });
        const data = await res.json();
        return Object.assign({}, s, { count: s.count(data), recent: s.recent ? s.recent(data) : [] });
      } catch (_) {
        return Object.assign({}, s, { count: null, recent: [] });
      }
    }));
  }

  window.NopaAttention = { SOURCES, fetch: fetchCounts };
})();
