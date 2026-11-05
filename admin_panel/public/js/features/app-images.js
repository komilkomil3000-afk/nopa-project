// «تصاویر اپلیکیشن»: every picture the app shows that the admin sets here, in one place.
//  - header banners of the home page (Banner rows with position home_top, the same rows as the Jarchi tab)
//  - the image of each asset (shown in the app instead of the built-in icon)
//  - the default picture of each kind of chat channel / group (used when the space has no picture of its own)
// Data: GET/POST/DELETE /admin/app-images[/:group/:key] (multipart `image`), GET/POST/DELETE /admin/banners.
// Markup: #app-images-tab in index.html; styles: css/stations.css (.lst-*, .crv-card, .aim-*).
(function () {
  const $ = id => document.getElementById(id);
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const st = { images: null, banners: null, busy: new Set() };

  const ASSET_SLOTS = [
    ['zarik', 'fa-coins'], ['nakh', 'fa-circle-nodes'], ['farsh', 'fa-rug'], ['derafsh', 'fa-flag'],
    ['derafsh_gold', 'fa-medal'], ['derafsh_silver', 'fa-medal'], ['derafsh_bronze', 'fa-medal'], ['derafsh_cloth', 'fa-flag'],
  ];
  const CHAT_SLOTS = [
    ['announcements', 'کانال اعلانات', 'fa-bullhorn'],
    ['arena', 'میدان آثار', 'fa-trophy'],
    ['mentors', 'اتاق راهبران', 'fa-people-group'],
    ['caravan', 'گروه کاروان (وقتی راهبر عکسی نگذاشته)', 'fa-users'],
    ['challenges', 'گروه چالش‌ها', 'fa-fire'],
    ['media', 'گروه‌های رسانه‌ای', 'fa-photo-film'],
    ['support', 'پشتیبانی نپا', 'fa-headset'],
  ];
  const assetLabel = key => (typeof window.assetName === 'function' ? window.assetName(key) : key);
  const src = url => (typeof window.nopaImgSrc === 'function' ? window.nopaImgSrc(url) : url) || url;

  function setLoading(on) {
    document.querySelectorAll('#app-images-tab .lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
    if (on && !st.images) {
      const skel = n => Array.from({ length: n }, () => '<div class="crv-card lst-skel" aria-hidden="true"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-short"></span></div>').join('');
      ['aim-banners', 'aim-assets', 'aim-chat'].forEach(id => { if ($(id)) $(id).innerHTML = skel(4); });
    }
  }

  // One slot: picture (or the placeholder icon), its name, and the upload / remove buttons.
  // The card is a plain block (not a button) because it holds buttons of its own.
  function slot({ anim, title, sub, icon, url, uploadArgs, removeFn, removeArgs }) {
    const busy = st.busy.has(anim);
    return `<div class="crv-card aim-slot${busy ? ' is-busy' : ''}" data-anim-key="${esc(anim)}">
      <span class="aim-thumb">${url ? `<img src="${esc(src(url))}" alt="" loading="lazy">` : `<i class="fa-solid ${esc(icon)}"></i>`}</span>
      <span class="crv-card-name"><strong>${esc(title)}</strong>${sub ? `<small class="u-c-text-muted">${esc(sub)}</small>` : ''}</span>
      <span class="aim-tools">
        <label class="lsv-pill aim-upload" title="${url ? 'جایگزینی تصویر' : 'بارگذاری تصویر'}">
          <i class="fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}"></i> ${url ? 'جایگزینی' : 'بارگذاری'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-change="aimUpload" data-change-args="${esc(JSON.stringify(['$this', ...uploadArgs]))}">
        </label>
        ${url && removeFn ? `<button type="button" class="lsv-round lsv-round-sm lsv-round-danger" title="حذف تصویر" aria-label="حذف تصویر" data-click="${removeFn}" data-click-args="${esc(JSON.stringify(removeArgs))}"><i class="fa-solid fa-trash"></i></button>` : ''}
      </span>
    </div>`;
  }

  function draw() {
    const images = st.images || { assets: {}, chat: {} };
    const banners = (st.banners || []).filter(b => b.position === 'home_top').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const paint = (id, html) => {
      const box = $(id);
      if (!box) return;
      if (window.NopaFlip && typeof NopaFlip.render === 'function') NopaFlip.render(box, () => { box.innerHTML = html; });
      else box.innerHTML = html;
    };

    paint('aim-banners', banners.map((b, i) => slot({
      anim: `aim-b:${b.id}`, title: b.title || `بنر ${fa(i + 1)}`, sub: b.isActive === false ? 'غیرفعال' : `ترتیب ${fa(i + 1)}`,
      icon: 'fa-image', url: b.imageUrl, uploadArgs: ['banner', String(b.id)], removeFn: 'aimRemoveBanner', removeArgs: [String(b.id)],
    })).join('') + `<label class="crv-card crv-card-add aim-add" data-anim-key="aim-b-add" title="افزودن بنر سربرگ">
        <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span><span>بنر جدید</span>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-change="aimUpload" data-change-args="${esc(JSON.stringify(['$this', 'banner-new', '']))}">
      </label>`);

    paint('aim-assets', ASSET_SLOTS.map(([key, icon]) => slot({
      anim: `aim-a:${key}`, title: assetLabel(key), sub: images.assets[key] ? '' : 'نماد پیش‌فرض اپ', icon, url: images.assets[key],
      uploadArgs: ['assets', key], removeFn: 'aimRemove', removeArgs: ['assets', key],
    })).join(''));

    paint('aim-chat', CHAT_SLOTS.map(([key, title, icon]) => slot({
      anim: `aim-c:${key}`, title, sub: images.chat[key] ? '' : 'نماد پیش‌فرض اپ', icon, url: images.chat[key],
      uploadArgs: ['chat', key], removeFn: 'aimRemove', removeArgs: ['chat', key],
    })).join(''));

    const set = Object.keys(images.assets).length + Object.keys(images.chat).length;
    if ($('aim-stat-banners')) $('aim-stat-banners').textContent = fa(banners.length);
    if ($('aim-stat-set')) $('aim-stat-set').textContent = fa(set);
    if ($('aim-stat-empty')) $('aim-stat-empty').textContent = fa(ASSET_SLOTS.length + CHAT_SLOTS.length - set);
  }

  async function json(url, opts) {
    const res = await request(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'عملیات ناموفق');
    return data;
  }

  window.loadAppImagesTab = async function () {
    setLoading(true);
    try {
      const [images, banners] = await Promise.all([json('/api/v1/admin/app-images'), json('/api/v1/admin/banners')]);
      st.images = images;
      st.banners = Array.isArray(banners) ? banners : [];
      draw();
    } catch (e) {
      showToast(e.message || 'خطا در دریافت تصاویر', 'error');
    } finally {
      setLoading(false);
    }
  };

  // group: 'assets' | 'chat' | 'banner' (replace that banner's picture) | 'banner-new'
  window.aimUpload = async function (input, group, key) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    input.value = '';
    if (file.size > 5 * 1024 * 1024) { showToast('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.', 'error'); return; }
    const anim = group === 'banner' ? `aim-b:${key}` : group === 'banner-new' ? 'aim-b-add' : `aim-${group[0]}:${key}`;
    st.busy.add(anim);
    draw();
    try {
      const form = new FormData();
      form.append('image', file);
      if (group === 'banner-new') {
        const count = (st.banners || []).filter(b => b.position === 'home_top').length;
        form.append('title', `بنر سربرگ ${fa(count + 1)}`);
        form.append('position', 'home_top');
        form.append('isActive', 'true');
        form.append('orderIndex', String(count));
        st.banners = [...(st.banners || []), await json('/api/v1/admin/banners', { method: 'POST', body: form })];
      } else if (group === 'banner') {
        const updated = await json(`/api/v1/admin/banners/${encodeURIComponent(key)}`, { method: 'PUT', body: form });
        st.banners = (st.banners || []).map(b => (String(b.id) === String(key) ? { ...b, ...updated } : b));
      } else {
        st.images = await json(`/api/v1/admin/app-images/${group}/${encodeURIComponent(key)}`, { method: 'POST', body: form });
      }
      showToast('تصویر ذخیره شد؛ اپ در بارگذاری بعدی آن را نشان می‌دهد.', 'success');
    } catch (e) {
      showToast(e.message || 'خطا در بارگذاری تصویر', 'error');
    } finally {
      st.busy.delete(anim);
      draw();
    }
  };

  window.aimRemove = async function (group, key) {
    if (!(await NopaConfirm('این تصویر حذف شود؟ اپ به نماد پیش‌فرض برمی‌گردد.'))) return;
    try {
      st.images = await json(`/api/v1/admin/app-images/${group}/${encodeURIComponent(key)}`, { method: 'DELETE' });
      draw();
    } catch (e) {
      showToast(e.message || 'خطا در حذف تصویر', 'error');
    }
  };

  window.aimRemoveBanner = async function (id) {
    if (!(await NopaConfirm('این بنر از سربرگ صفحه‌ی اول حذف شود؟'))) return;
    try {
      await json(`/api/v1/admin/banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
      st.banners = (st.banners || []).filter(b => String(b.id) !== String(id));
      draw();
    } catch (e) {
      showToast(e.message || 'خطا در حذف بنر', 'error');
    }
  };
})();
