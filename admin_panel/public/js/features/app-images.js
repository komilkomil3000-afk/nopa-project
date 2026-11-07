// «تصاویر اپلیکیشن»: every picture the app shows that the admin sets here, in one place.
//  - header banners of the home page (Banner rows with position home_top, the same rows as the Jarchi tab)
//  - the image of each asset (shown in the app instead of the built-in icon)
//  - the default picture of each kind of chat channel / group (used when the space has no picture of its own)
//  - the profile pictures users pick from in the app, per group (boys, girls, male / female mentors)
// Data: GET/POST/DELETE /admin/app-images[/:group/:key] (multipart `image`), GET/POST/DELETE /admin/banners,
//       /admin/app-avatars (see avatarCatalogController.ts).
// Markup: #app-images-tab in index.html; styles: css/stations.css (.lst-*, .crv-card, .aim-*).
(function () {
  const $ = id => document.getElementById(id);
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const st = { images: null, banners: null, avatars: null, busy: new Set() };

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
      ['aim-banners', 'aim-assets', 'aim-chat', 'aim-avatars'].forEach(id => { if ($(id)) $(id).innerHTML = skel(4); });
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

    paint('aim-avatars', drawAvatars());

    const set = Object.keys(images.assets).length + Object.keys(images.chat).length;
    if ($('aim-stat-banners')) $('aim-stat-banners').textContent = fa(banners.length);
    if ($('aim-stat-set')) $('aim-stat-set').textContent = fa(set);
    if ($('aim-stat-empty')) $('aim-stat-empty').textContent = fa(ASSET_SLOTS.length + CHAT_SLOTS.length - set);
  }

  // ---- profile pictures ----
  const AV_GROUPS = [
    ['male', 'پسرها', 'fa-person'], ['female', 'دخترها', 'fa-person-dress'],
    ['mentor_male', 'راهبران آقا', 'fa-user-tie'], ['mentor_female', 'راهبران خانم', 'fa-user-tie'],
  ];
  const avAccept = 'image/png,image/jpeg,image/webp,image/gif';
  const avArgs = v => esc(JSON.stringify(v));

  function avatarCard(item, index, firstActiveId) {
    const anim = `aim-v:${item.id}`;
    const busy = st.busy.has(anim);
    const isDefault = item.id === firstActiveId;
    const who = item.holders ? `${fa(item.holders)} نفر انتخاب کرده‌اند` : 'هنوز کسی انتخاب نکرده';
    const sub = item.active ? who : `بایگانی؛ فقط برای ${fa(item.holders)} نفری که دارندش`;
    return `<div class="crv-card aim-slot${busy ? ' is-busy' : ''}${item.active ? '' : ' is-retired'}" data-anim-key="${esc(anim)}">
      <span class="aim-thumb"><img src="${esc(src(item.value))}" alt="" loading="lazy"></span>
      <span class="crv-card-name"><strong>تصویر ${fa(index + 1)} ${isDefault ? '<span class="aim-av-badge"><i class="fa-solid fa-star"></i> پیش‌فرض</span>' : ''}</strong><small class="u-c-text-muted">${esc(sub)}</small></span>
      <span class="aim-tools">
        <label class="lsv-pill aim-upload" title="جایگزینی تصویر">
          <i class="fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}"></i> جایگزینی
          <input type="file" accept="${avAccept}" hidden data-change="aimAvatarReplace" data-change-args="${avArgs(['$this', item.id])}">
        </label>
        <span class="aim-tools-end">
          ${item.active && !isDefault ? `<button type="button" class="lsv-round lsv-round-sm" title="پیش‌فرض این گروه شود" aria-label="پیش‌فرض این گروه شود" data-click="aimAvatarFirst" data-click-args="${avArgs([item.id])}"><i class="fa-regular fa-star"></i></button>` : ''}
          ${item.active ? '' : `<button type="button" class="lsv-round lsv-round-sm" title="دوباره قابل انتخاب شود" aria-label="دوباره قابل انتخاب شود" data-click="aimAvatarRestore" data-click-args="${avArgs([item.id])}"><i class="fa-solid fa-rotate-left"></i></button>`}
          <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" title="حذف تصویر" aria-label="حذف تصویر" data-click="aimAvatarRemove" data-click-args="${avArgs([item.id])}"><i class="fa-solid fa-trash"></i></button>
        </span>
      </span>
    </div>`;
  }

  function drawAvatars() {
    if (!st.avatars) return '<div class="lsv-col-empty">فهرست تصاویر پروفایل دریافت نشد.</div>';
    const items = st.avatars.items || [];
    return AV_GROUPS.map(([group, title, icon]) => {
      const list = items.filter(i => i.group === group);
      const active = list.filter(i => i.active);
      const ordered = [...active, ...list.filter(i => !i.active)];
      const firstActiveId = active[0] && active[0].id;
      const addAnim = `aim-v-add:${group}`;
      return `<div class="aim-av-group">
        <h5 class="aim-av-group-title"><i class="fa-solid ${icon}"></i> ${esc(title)} <small>${fa(active.length)} تصویر قابل انتخاب</small></h5>
        <div class="crv-card-grid aim-grid aim-av-grid">
          <label class="crv-card crv-card-add aim-add" data-anim-key="${addAnim}" title="افزودن تصویر به ${esc(title)}">
            <span class="lsv-round lsv-round-lg"><i class="fa-solid ${st.busy.has(addAnim) ? 'fa-spinner fa-spin' : 'fa-plus'}"></i></span><span>تصویر جدید</span>
            <input type="file" accept="${avAccept}" hidden data-change="aimAvatarAdd" data-change-args="${avArgs(['$this', group])}">
          </label>
          ${ordered.map((item, i) => avatarCard(item, i, firstActiveId)).join('')}
        </div>
      </div>`;
    }).join('');
  }

  const avItem = id => ((st.avatars && st.avatars.items) || []).find(i => i.id === id);

  async function avatarCall(anim, url, opts) {
    st.busy.add(anim);
    draw();
    try {
      st.avatars = await json(url, opts);
      return true;
    } catch (e) {
      showToast(e.message || 'خطا در ذخیره‌ی تصویر پروفایل', 'error');
      return false;
    } finally {
      st.busy.delete(anim);
      draw();
    }
  }

  function pickedFile(input) {
    const file = input && input.files && input.files[0];
    if (input) input.value = '';
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) { showToast('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.', 'error'); return null; }
    return file;
  }

  window.aimAvatarAdd = async function (input, group) {
    const file = pickedFile(input);
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    if (await avatarCall(`aim-v-add:${group}`, `/api/v1/admin/app-avatars/group/${encodeURIComponent(group)}`, { method: 'POST', body: form })) {
      showToast('تصویر اضافه شد؛ کاربران از دفعه‌ی بعد که اپ را باز کنند آن را می‌بینند.', 'success');
    }
  };

  // Replacing a picture people already have asks whether their picture changes too, or stays (and is retired)
  window.aimAvatarReplace = async function (input, id) {
    const file = pickedFile(input);
    const item = avItem(id);
    if (!file || !item) return;
    let mode = 'all';
    if (item.holders > 0) {
      const answer = await NopaConfirm(`${fa(item.holders)} نفر این تصویر را انتخاب کرده‌اند. عکس آن‌ها هم به تصویر جدید تغییر کند؟ اگر نه، عکس فعلی برای همان‌ها می‌ماند و دیگر برای بقیه قابل انتخاب نیست.`, {
        title: 'جایگزینی تصویر پروفایل', danger: false,
        okText: 'بله، همه تغییر کنند',
        altText: 'نه، عکس آن‌ها بماند', altDanger: false,
      });
      if (!answer) return;
      mode = answer === 'alt' ? 'keep' : 'all';
    }
    // `mode` goes before the file so multer has it in req.body when the file arrives
    const form = new FormData();
    form.append('mode', mode);
    form.append('image', file);
    if (await avatarCall(`aim-v:${id}`, `/api/v1/admin/app-avatars/item/${encodeURIComponent(id)}`, { method: 'POST', body: form })) {
      showToast(mode === 'keep' ? 'تصویر جدید جایگزین شد؛ تصویر قبلی برای کسانی که داشتند ماند و دیگر قابل انتخاب نیست.' : 'تصویر جایگزین شد.', 'success');
    }
  };

  window.aimAvatarRemove = async function (id) {
    const item = avItem(id);
    if (!item) return;
    let mode = 'switch';
    if (item.holders > 0) {
      const answer = await NopaConfirm(item.active
        ? `${fa(item.holders)} نفر این تصویر را دارند. عکس آن‌ها به تصویر پیش‌فرض گروه تغییر کند، یا همین بماند و فقط از فهرست انتخاب حذف شود؟`
        : `${fa(item.holders)} نفر هنوز این تصویر بایگانی‌شده را دارند. با حذف کامل، عکس آن‌ها به تصویر پیش‌فرض گروه تغییر می‌کند.`, {
        title: 'حذف تصویر پروفایل', danger: true,
        okText: 'عکس آن‌ها هم تغییر کند',
        ...(item.active ? { altText: 'عکس آن‌ها بماند', altDanger: false } : {}),
      });
      if (!answer) return;
      mode = answer === 'alt' ? 'keep' : 'switch';
    } else if (!(await NopaConfirm('این تصویر از فهرست تصاویر پروفایل حذف شود؟'))) return;
    await avatarCall(`aim-v:${id}`, `/api/v1/admin/app-avatars/item/${encodeURIComponent(id)}?mode=${mode}`, { method: 'DELETE' });
  };

  window.aimAvatarRestore = id => avatarCall(`aim-v:${id}`, `/api/v1/admin/app-avatars/item/${encodeURIComponent(id)}/restore`, { method: 'POST' });
  window.aimAvatarFirst = id => avatarCall(`aim-v:${id}`, `/api/v1/admin/app-avatars/item/${encodeURIComponent(id)}/first`, { method: 'POST' });

  async function json(url, opts) {
    const res = await request(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'عملیات ناموفق');
    return data;
  }

  window.loadAppImagesTab = async function () {
    setLoading(true);
    try {
      const [images, banners, avatars] = await Promise.all([
        json('/api/v1/admin/app-images'), json('/api/v1/admin/banners'),
        json('/api/v1/admin/app-avatars').catch(() => null),
      ]);
      st.images = images;
      st.avatars = avatars;
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
