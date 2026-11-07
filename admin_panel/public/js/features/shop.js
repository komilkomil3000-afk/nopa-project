// «فروشگاه بازارچه»: sticker / GIF packs and features (e.g. sending GIFs in chat) sold for zarik in the app's market.
// Bento overview (#shop-tab) + the item editor (#shp-editor-modal). API: GET/POST /admin/shop/items, PUT/DELETE /admin/shop/items/:id.
// Uses the caravans tab's helpers (crvArgs, crvFa), so it loads after js/features/caravans.js.
window.shpItems = window.shpItems || [];
let shpFeatures = [];
let shpLoaded = false;
let shpEdit = null; // { id|null, assets: [{url}] }

const SHP_KIND_LABEL = { sticker_pack: 'پک استیکر', gif_pack: 'پک گیف', feature: 'قابلیت' };
const SHP_KIND_ICON = { sticker_pack: 'fa-note-sticky', gif_pack: 'fa-film', feature: 'fa-wand-magic-sparkles' };

window.loadShopTab = async function() {
  shpSetLoading(true);
  try {
    const data = await NopaApi.json('/api/v1/admin/shop/items');
    window.shpItems = Array.isArray(data.items) ? data.items : [];
    shpFeatures = Array.isArray(data.features) ? data.features : [];
    shpLoaded = true;
  } catch (err) {
    console.error('loadShopTab error:', err);
    if (err.message !== 'Unauthorized') showToast(err.message || 'خطا در دریافت محصولات بازارچه', 'error');
  }
  shpSetLoading(false);
  window.shpFilter();
};

window.shpFilter = function() {
  const overview = document.getElementById('shp-overview-view');
  if (window.NopaFlip && overview) window.NopaFlip.render(overview, shpDrawBento); else shpDrawBento();
};

function shpCover(item) {
  const url = item.coverUrl || '';
  return url
    ? `<span class="crv-card-cover shp-cover"><img src="${esc(url)}" alt="" loading="lazy"></span>`
    : `<span class="crv-card-cover shp-cover"><i class="fa-solid ${SHP_KIND_ICON[item.kind] || 'fa-store'}"></i></span>`;
}

function shpStatusChip(item) {
  return item.isActive
    ? '<span class="lst-chip lst-chip-active">در حال فروش</span>'
    : '<span class="lst-chip lst-chip-locked">خارج از فروش</span>';
}

function shpCard(item) {
  const count = (item.assets || []).length;
  const what = item.kind === 'feature' ? esc(item.featureLabel || 'قابلیت') : `${crvFa(count)} ${item.kind === 'gif_pack' ? 'گیف' : 'استیکر'}`;
  return `
    <button type="button" class="crv-card shp-card" data-anim-key="shp:${esc(item.id)}" data-click="shpOpenEditor" data-click-args="${crvArgs(item.id)}" title="ویرایش ${esc(item.title)}">
      <span class="crv-card-top">
        ${shpCover(item)}
        <span class="crv-card-name"><strong>${esc(item.title)}</strong>${shpStatusChip(item)}</span>
      </span>
      <span class="crv-card-mentor"><i class="fa-solid ${SHP_KIND_ICON[item.kind] || 'fa-store'}"></i><span>${esc(SHP_KIND_LABEL[item.kind] || item.kind)} · ${what}</span></span>
      <span class="crv-card-foot">
        <span class="crv-card-nums"><span class="u-c-accent-text" title="قیمت"><i class="fa-solid fa-coins"></i> ${item.priceZarik ? crvFa(item.priceZarik) + ' زریک' : 'رایگان'}</span></span>
        <span class="crv-card-nums"><span class="u-c-text-soft" title="تعداد خریدار"><i class="fa-solid fa-user-check"></i> ${crvFa(item.buyers || 0)}</span></span>
      </span>
    </button>`;
}

function shpDrawBento() {
  const all = window.shpItems || [];
  const q = (document.getElementById('shp-search')?.value || '').trim().toLowerCase();
  const kind = document.getElementById('shp-kind-filter')?.value || 'all';
  const status = document.getElementById('shp-status-filter')?.value || 'all';
  const list = all.filter(i => {
    if (kind !== 'all' && i.kind !== kind) return false;
    if (status === 'active' && !i.isActive) return false;
    if (status === 'inactive' && i.isActive) return false;
    return !q || [i.title, i.description, i.featureLabel].some(v => String(v || '').toLowerCase().includes(q));
  });
  const filtering = !!q || kind !== 'all' || status !== 'all';

  const badge = document.getElementById('shp-count-badge');
  if (badge) badge.textContent = filtering ? `نمایش ${crvFa(list.length)} از ${crvFa(all.length)} محصول` : 'برای ویرایش روی هر محصول بزنید';

  const grid = document.getElementById('shp-bento-list');
  if (grid) {
    const cards = list.map(shpCard);
    if (!filtering) {
      if (shpLoaded && !all.length) cards.push('<div class="lst-empty" data-anim-key="shp-none">هنوز محصولی ساخته نشده است؛ در اپ «فعلاً محصولی برای فروش نیامده است» نمایش داده می‌شود.</div>');
      cards.push(`
        <button type="button" class="crv-card crv-card-add" data-anim-key="shp-add" data-click="shpOpenEditor" title="محصول جدید">
          <span class="lsv-round lsv-round-lg"><i class="fa-solid fa-plus"></i></span>
          <span>محصول جدید</span>
        </button>`);
    } else if (!list.length) {
      cards.push('<div class="lst-empty" data-anim-key="shp-empty">محصولی با این مشخصات یافت نشد.</div>');
    }
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('shp-stat-total', crvFa(all.length));
  set('shp-stat-active', crvFa(all.filter(i => i.isActive).length));
  set('shp-stat-buyers', crvFa(all.reduce((s, i) => s + (i.buyers || 0), 0)));
  set('shp-stat-revenue', crvFa(all.reduce((s, i) => s + (i.revenue || 0), 0)));

  const top = document.getElementById('shp-bento-top');
  if (top) {
    const rows = all.filter(i => i.buyers > 0).sort((a, b) => b.buyers - a.buyers).slice(0, 5);
    top.innerHTML = rows.length
      ? `<ul class="lst-list">${rows.map((i, n) => `
          <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-anim-key="shp-top:${esc(i.id)}" data-click="shpOpenEditor" data-click-args="${crvArgs(i.id)}">
            <span class="crv-rank">${crvFa(n + 1)}</span>
            <span class="lst-grow"><strong>${esc(i.title)}</strong><small>${esc(SHP_KIND_LABEL[i.kind] || '')}</small></span>
            <span>${crvFa(i.buyers)} خرید</span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز خریدی ثبت نشده است.</div>';
  }
}

function shpSetLoading(on) {
  const overview = document.getElementById('shp-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  const grid = document.getElementById('shp-bento-list');
  if (grid) grid.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on || shpLoaded) return;
  if (grid) {
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="crv-card lst-skel" aria-hidden="true">
        <span class="crv-card-top"><span class="crv-card-cover"></span><span class="crv-card-name"><span class="lst-skel-line"></span><span class="lst-skel-line lst-skel-chip"></span></span></span>
        <span class="lst-skel-line lst-skel-short"></span>
        <span class="lst-skel-line"></span>
      </div>`).join('');
  }
  const top = document.getElementById('shp-bento-top');
  if (top) top.innerHTML = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
}
shpSetLoading(true);

// ==================== EDITOR ====================

const shpEl = id => document.getElementById(id);

window.shpOpenEditor = function(id, presetKind) {
  const modal = shpEl('shp-editor-modal');
  if (!modal) return;
  const item = id ? (window.shpItems || []).find(i => String(i.id) === String(id)) : null;
  shpEdit = { id: item ? item.id : null, assets: item ? (item.assets || []).map(a => ({ url: a.url })) : [] };

  shpEl('shp-editor-title').textContent = item ? `ویرایش «${item.title}»` : 'محصول جدید';
  shpEl('shp-editor-sub').textContent = item
    ? `${crvFa(item.buyers || 0)} خریدار · ${crvFa(item.revenue || 0)} زریک دریافتی`
    : 'برای فروش در بازارچه‌ی اپ با زریک';
  shpEl('shp-feature').innerHTML = shpFeatures.map(f => `<option value="${esc(f.key)}">${esc(f.label)}</option>`).join('');
  shpEl('shp-kind').value = item ? item.kind : (presetKind || 'sticker_pack');
  shpEl('shp-kind').disabled = !!(item && item.buyers > 0); // what people bought keeps its kind
  if (item && item.featureKey) shpEl('shp-feature').value = item.featureKey;
  shpEl('shp-name').value = item ? item.title : '';
  shpEl('shp-price').value = item ? item.priceZarik : 0;
  shpEl('shp-order').value = item ? item.sortOrder : 0;
  shpEl('shp-active').checked = item ? !!item.isActive : false;
  shpEl('shp-desc').value = item ? (item.description || '') : '';
  // the stored cover only (the card falls back to the first sticker)
  const ownCover = item && item.coverUrl && !(item.assets || []).some(a => a.url === item.coverUrl) ? item.coverUrl : '';
  shpEl('shp-cover').value = ownCover;
  shpEl('shp-delete-btn').style.display = item ? '' : 'none';
  shpEl('shp-delete-btn').disabled = !!(item && item.buyers > 0);
  shpEl('shp-delete-btn').title = item && item.buyers > 0 ? 'محصولی که خریدار دارد حذف نمی‌شود؛ آن را از فروش خارج کنید' : 'حذف محصول';
  window.shpKindChanged();
  window.shpCoverChanged();
  modal.style.display = 'flex';
  setTimeout(() => shpEl('shp-name')?.focus(), 50);
};

window.shpCloseEditor = function() {
  const modal = shpEl('shp-editor-modal');
  if (modal) modal.style.display = 'none';
  shpEdit = null;
};

window.shpKindChanged = function() {
  const kind = shpEl('shp-kind').value;
  const isFeature = kind === 'feature';
  shpEl('shp-feature-field').style.display = isFeature ? '' : 'none';
  shpEl('shp-assets-card').style.display = isFeature ? 'none' : '';
  shpEl('shp-assets-title').textContent = kind === 'gif_pack' ? 'گیف‌های بسته' : 'استیکرهای بسته';
  shpDrawAssets();
};

window.shpCoverChanged = function() {
  const url = shpEl('shp-cover').value.trim();
  const box = shpEl('shp-cover-preview');
  if (box) box.innerHTML = url ? `<img src="${esc(url)}" alt="">` : '<i class="fa-solid fa-image"></i>';
};

function shpDrawAssets() {
  const box = shpEl('shp-assets');
  if (!box || !shpEdit) return;
  shpEl('shp-assets-count').textContent = crvFa(shpEdit.assets.length);
  box.innerHTML = shpEdit.assets.length
    ? shpEdit.assets.map((a, i) => `
        <span class="shp-asset">
          <img src="${esc(a.url)}" alt="" loading="lazy">
          <button type="button" class="lsv-round lsv-round-sm lsv-round-danger" data-click="shpRemoveAsset" data-click-args="${crvArgs(i)}" title="حذف" aria-label="حذف"><i class="fa-solid fa-xmark"></i></button>
        </span>`).join('')
    : '<div class="lst-empty">هنوز تصویری اضافه نشده است.</div>';
}

window.shpRemoveAsset = function(index) {
  if (!shpEdit) return;
  shpEdit.assets.splice(Number(index), 1);
  shpDrawAssets();
};

async function shpUploadOne(file) {
  const form = new FormData();
  form.append('file', file);
  const data = await NopaApi.json('/api/v1/media/upload', { method: 'POST', body: form });
  const url = data.url || (data.media && data.media.url) || '';
  if (!url) throw new Error('آدرس فایل برنگشت');
  return url;
}

window.shpUploadCover = async function(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  try {
    shpEl('shp-cover').value = await shpUploadOne(file);
    window.shpCoverChanged();
  } catch (err) {
    showToast('خطا در بارگذاری تصویر: ' + (err.message || ''), 'error');
  } finally { input.value = ''; }
};

window.shpUploadAssets = async function(input) {
  const files = Array.from((input && input.files) || []);
  if (!files.length || !shpEdit) return;
  const note = shpEl('shp-editor-note');
  let done = 0, failed = 0;
  for (const file of files) {
    if (note) note.textContent = `در حال بارگذاری ${crvFa(done + failed + 1)} از ${crvFa(files.length)}...`;
    try {
      shpEdit.assets.push({ url: await shpUploadOne(file) });
      done++;
      shpDrawAssets();
    } catch (_) { failed++; }
  }
  if (note) note.innerHTML = '<i class="fa-solid fa-circle-info"></i> خرید دائمی است و با زریک پرداخت می‌شود';
  if (failed) showToast(`${crvFa(failed)} تصویر بارگذاری نشد.`, 'error');
  input.value = '';
};

window.shpSaveItem = async function() {
  if (!shpEdit) return;
  const kind = shpEl('shp-kind').value;
  const body = {
    kind,
    featureKey: kind === 'feature' ? shpEl('shp-feature').value : null,
    title: shpEl('shp-name').value.trim(),
    priceZarik: Number(String(shpEl('shp-price').value).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))),
    sortOrder: Number(shpEl('shp-order').value) || 0,
    isActive: shpEl('shp-active').checked,
    description: shpEl('shp-desc').value.trim(),
    coverUrl: shpEl('shp-cover').value.trim(),
    ...(kind === 'feature' ? {} : { assets: shpEdit.assets.map(a => a.url) }),
  };
  if (!body.title) return showToast('نام محصول را وارد کنید.', 'error');
  if (!Number.isInteger(body.priceZarik) || body.priceZarik < 0) return showToast('قیمت باید عددی صحیح و صفر یا بیشتر باشد.', 'error');
  const btn = shpEl('shp-save-btn');
  if (btn) btn.disabled = true;
  try {
    const editing = shpEdit.id;
    await NopaApi.json(editing ? `/api/v1/admin/shop/items/${encodeURIComponent(editing)}` : '/api/v1/admin/shop/items', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    showToast(editing ? 'محصول ذخیره شد.' : (body.isActive ? 'محصول ساخته شد و در بازارچه برای فروش است.' : 'محصول ساخته شد (خارج از فروش).'), 'success');
    window.shpCloseEditor();
    await window.loadShopTab();
  } catch (err) {
    showToast(err.message || 'خطا در ذخیره محصول', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.shpDeleteItem = async function() {
  if (!shpEdit || !shpEdit.id) return;
  const item = (window.shpItems || []).find(i => i.id === shpEdit.id);
  if (!(await NopaConfirm(`محصول «${(item && item.title) || ''}» حذف شود؟`))) return;
  try {
    await NopaApi.json(`/api/v1/admin/shop/items/${encodeURIComponent(shpEdit.id)}`, { method: 'DELETE' });
    showToast('محصول حذف شد.', 'success');
    window.shpCloseEditor();
    await window.loadShopTab();
  } catch (err) {
    showToast(err.message || 'خطا در حذف محصول', 'error');
  }
};
