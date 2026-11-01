// Tab registry + hash routing for the admin panel. Loaded before app.js.
// One TABS entry per <section class="tab-panel"> holds everything that used to live in four
// separate maps (hash aliases, title/description, sub-admin section, data loader) plus the
// navigation metadata (group / label / icon) the top navigation is built from.
//   section: key of the sub-admin grant that unlocks the tab (null = super admin only)
//   load:    called on every visit; loader functions live in the feature scripts
(function () {
  // Calls a global loader if it exists (feature scripts load after this file)
  function call(name) {
    const fn = window[name];
    if (typeof fn === 'function') return fn.apply(window, Array.prototype.slice.call(arguments, 1));
  }

  const GROUPS = [
    { id: 'audience', label: 'مخاطبان', icon: 'fa-solid fa-users' },
    { id: 'economy', label: 'اقتصاد و لیگ', icon: 'fa-solid fa-coins' },
    { id: 'mentors', label: 'راهبران', icon: 'fa-solid fa-user-tie' },
    { id: 'caravans', label: 'کاروان‌ها', icon: 'fa-solid fa-compass' },
    { id: 'learning', label: 'آموزش', icon: 'fa-solid fa-book-open' },
    { id: 'outreach', label: 'اطلاع‌رسانی', icon: 'fa-solid fa-bullhorn' },
    { id: 'settings', label: 'تنظیمات', icon: 'fa-solid fa-shield-halved' },
  ];

  const TABS = {
    'users-tab': {
      hashes: ['users'], group: 'audience', label: 'دایرکتوری مخاطبان', icon: 'fa-solid fa-users', section: 'users',
      title: 'دایرکتوری کاربران', desc: 'مشاهده، فیلتر، ویرایش و مدیریت اطلاعات کاربران نپا',
      load: () => call('loadUsersData'),
    },
    'levels-tab': {
      hashes: ['levels'], group: 'audience', label: 'سطوح و گواهینامه‌ها', icon: 'fa-solid fa-layer-group', section: 'users',
      title: 'سطوح و گواهینامه‌ها', desc: 'دایرکتوری دستاوردهای مخاطبان و درخواست‌های فیزیکی گواهینامه',
      load: () => call('loadLevelsAndCertificatesTab'),
    },
    'rewards-tab': {
      hashes: ['rewards'], group: 'economy', label: 'کیف پول و لیگ', icon: 'fa-solid fa-coins', section: 'rewards',
      title: 'کیف پول زریک', desc: 'مدیریت ترازنامه، جوایز فصلی و توزیع ثروت اقتصاد زریک',
      load: () => { call('loadLedger'); call('loadZarikAnalytics'); call('loadAssetLeaderboard'); call('loadRewardRules'); },
    },
    'assets-tab': {
      hashes: ['assets'], group: 'economy', label: 'نام دارایی‌ها', icon: 'fa-solid fa-tags', section: null,
      title: 'نام دارایی‌ها', desc: 'تغییر نام زریک، کلاف، قالیچه و درفش در اپ، پنل و پیام‌ها',
      load: () => call('loadAssetNames'),
    },
    'analytics-tab': {
      hashes: ['analytics'], group: null, label: 'مرکز ارزیابی و آمار', icon: 'fa-solid fa-chart-line', section: 'analytics',
      title: 'مرکز ارزیابی و آمار', desc: 'داشبورد جامع شاخص‌های کلیدی عملکرد و رفتار کاربران',
      load: () => call('loadAnalytics'),
    },
    'mentors-profile-tab': {
      hashes: ['mentors', 'mentors-profile', 'mentors-league'], group: 'mentors', label: 'پروفایل و شناسنامه', icon: 'fa-solid fa-id-card', section: 'mentors',
      title: 'پروفایل و شناسنامه راهبران', desc: 'مرکز ارزیابی راهبران و مربیان',
      load: () => call('loadMentorsData'),
    },
    'mentors-tickets-tab': {
      hashes: ['mentors-tickets'], group: 'mentors', label: 'میزکار و تیکت‌ها', icon: 'fa-solid fa-inbox', section: 'support',
      title: 'میزکار و تیکت‌ها', desc: 'مدیریت تیکت‌ها و درخواست‌های مربیان',
      load: () => call('loadTickets'),
    },
    'mentors-docs-tab': {
      hashes: ['mentors-docs'], group: 'mentors', label: 'تایید مدارک و گواهینامه‌ها', icon: 'fa-solid fa-file-circle-check', section: 'mentors',
      title: 'تایید مدارک و گواهینامه‌ها', desc: 'صف انتظار بررسی و تایید مدارک مربیان',
      load: () => call('loadMentorDocs'),
    },
    'instructors-tab': {
      hashes: ['instructors'], group: 'mentors', label: 'بانک اساتید', icon: 'fa-solid fa-chalkboard-user', section: 'instructors',
      title: 'بانک و مدیریت اساتید', desc: 'مشخصات، سوابق، مدرک، رزومه و کلاس‌های اساتید دوره',
      load: () => call('fetchInstructorsList'),
    },
    'caravans-tab': {
      hashes: ['caravans', 'caravan-league'], group: 'caravans', label: 'مدیریت و فهرست کاروان‌ها', icon: 'fa-solid fa-compass', section: 'caravans',
      title: 'کاروان‌ها و مربیان', desc: 'گزارش پیشرفت گروهی کاروان‌ها و ارزیابی مربیان',
      load: () => call('loadCaravansData'),
    },
    'lms-tab': {
      hashes: ['lms', 'stations'], group: 'learning', label: 'ساختار منزلگاه و کلاس‌ها', icon: 'fa-solid fa-graduation-cap', section: 'lms',
      title: 'ساختار منزلگاه‌ها', desc: 'مدیریت منزلگاه‌ها، کلاس‌ها و آزمون‌ها',
      load: () => call('fetchLiveLmsStations'),
    },
    'submissions-tab': {
      hashes: ['submissions'], group: 'learning', label: 'بررسی چالش‌ها و تکالیف', icon: 'fa-solid fa-trophy', section: 'challenges',
      title: 'بررسی و مدیریت چالش‌ها', desc: 'مشاهده چالش‌های فعال نپا، مراحل و گام‌های سوالات، و ارزیابی تکالیف دانش‌آموزان',
      load: () => call('loadChallengesAndSubmissionsTab'),
    },
    'form-builder-tab': {
      hashes: ['form-builder'], group: 'learning', label: 'فرم‌ساز داینامیک', icon: 'fa-brands fa-wpforms', section: 'content',
      title: 'فرم‌ساز داینامیک', desc: 'طراحی و مدیریت فرم‌ها و پرسشنامه‌های اختصاصی',
      load: () => call('loadDynForms'),
    },
    'news-tab': {
      hashes: ['news', 'jarchi'], group: 'outreach', label: 'تابلوی اعلانات جارچی', icon: 'fa-solid fa-newspaper', section: 'content',
      title: 'اخبار جارچی', desc: 'مدیریت تابلوی اعلانات جارچی و رویدادها',
      load: () => (typeof window.loadNewsAndBanners === 'function' ? call('loadNewsAndBanners') : call('loadNewsTab')),
    },
    'notifications-tab': {
      hashes: ['notifications'], group: 'outreach', label: 'تنظیمات پیام‌رسانی', icon: 'fa-solid fa-bell', section: 'notifications',
      title: 'مدیریت اعلان‌ها', desc: 'ارسال و پیگیری پیامک، ایمیل و پوش‌نوتیفیکیشن',
      load: () => call('loadNotificationData'),
    },
    'content-tab': {
      hashes: ['content'], group: 'outreach', label: 'اطلاعیه سراسری', icon: 'fa-solid fa-bullhorn', section: null,
      title: 'اطلاعیه‌ها و محتوا', desc: 'مدیریت و انتشار اطلاعیه‌های سراسری و پیام‌های هدفمند',
      load: () => {},
    },
    'media-tab': {
      hashes: ['media'], group: 'outreach', label: 'مدیریت فایل‌ها و رسانه', icon: 'fa-solid fa-folder-open', section: null,
      title: 'مدیریت رسانه‌ها', desc: 'آپلود و دسته‌بندی فایل‌های ویدیویی و تصویری جهت استریم در اپلیکیشن',
      load: () => call('loadMediaAssets'),
    },
    'chat-tab': {
      hashes: ['chat'], group: 'outreach', label: 'نظارت بر گفتگوها', icon: 'fa-solid fa-comments', section: null,
      title: 'مدیریت گفتگوها', desc: 'نظارت بر گفتگوهای کاروان‌ها و پیام‌های کاربران',
      load: () => call('loadChats'),
    },
    'roles-tab': {
      hashes: ['roles'], group: 'settings', label: 'نقش‌ها و دسترسی‌ها (RBAC)', icon: 'fa-solid fa-user-lock', section: null,
      title: 'امنیت و دسترسی', desc: 'ماتریس اختصاصی نقش‌های امنیتی نپا',
      load: () => call('loadRolePermissions'),
    },
    'audit-tab': {
      hashes: ['audit'], group: 'settings', label: 'امنیت و گزارشات سیستم', icon: 'fa-solid fa-clock-rotate-left', section: null,
      title: 'لاگ‌های سیستمی', desc: 'گزارش حسابرسی عملیات مدیران و رکوردهای امنیتی',
      load: () => call('loadAuditLogs'),
    },
  };

  const DEFAULT_TAB = 'users-tab';

  // '#users', '#users-tab', '#caravan-league' ... -> tab id
  const HASH_INDEX = {};
  Object.keys(TABS).forEach(id => {
    HASH_INDEX[id] = id;
    TABS[id].hashes.forEach(h => { HASH_INDEX[h] = id; HASH_INDEX[h + '-tab'] = id; });
  });

  function tabFromHash(hash) {
    const key = String(hash || '').replace(/^#/, '').toLowerCase();
    return HASH_INDEX[key] || null;
  }

  function sectionOf(tabId) {
    return TABS[tabId] ? TABS[tabId].section : null;
  }

  let lastSwitch = { id: null, at: 0 };

  function switchTab(tabId, updateUrl = true) {
    if (!TABS[tabId] && !document.getElementById(tabId)) tabId = DEFAULT_TAB;
    if (!tabId) tabId = DEFAULT_TAB;
    const meta = TABS[tabId] || {};

    // Automatically dismiss user detail drawer when navigating between pages/tabs
    if (typeof window.closeUserDetailDrawer === 'function') window.closeUserDetailDrawer();

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.style.display = 'none';
      panel.classList.remove('active-panel');
    });
    const target = document.getElementById(tabId);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active-panel');
    }

    activeTab = tabId; // global state declared in app.js
    lastSwitch = { id: tabId, at: Date.now() };
    window.scrollTo({ top: 0 });

    if (meta.title) {
      const titleEl = document.getElementById('tab-title-text');
      if (titleEl) titleEl.textContent = meta.title;
      const descEl = document.getElementById('tab-desc-text');
      if (descEl) descEl.textContent = meta.desc || '';
    }

    // Update URL hash cleanly without page reload
    if (updateUrl) {
      const cleanHash = meta.hashes ? meta.hashes[0] : tabId.replace('-tab', '');
      if (window.location.hash !== '#' + cleanHash) history.pushState(null, '', '#' + cleanHash);
    }

    if (typeof meta.load === 'function') {
      try { meta.load(); } catch (e) { console.error(`load ${tabId} failed:`, e); }
    }
    try { window.dispatchEvent(new CustomEvent('nopa:tabchange', { detail: { tabId } })); } catch (_) { /* old browser */ }
  }

  function handleHashRouting() {
    const tabId = tabFromHash(window.location.hash) || DEFAULT_TAB;
    // back/forward fire both popstate and hashchange: don't load the same tab twice
    if (tabId === lastSwitch.id && Date.now() - lastSwitch.at < 300) return;
    switchTab(tabId, false);
  }

  window.addEventListener('hashchange', handleHashRouting);
  window.addEventListener('popstate', handleHashRouting);

  window.NopaRouter = { TABS, GROUPS, DEFAULT_TAB, tabFromHash, sectionOf, switchTab, handleHashRouting };
  window.switchTab = switchTab;
  window.handleHashRouting = handleHashRouting;
})();
