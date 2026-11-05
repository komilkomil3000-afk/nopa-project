// Money rules of the app, edited by the super admin (سرمایه‌ها tab, #eco-overview-view): a bento with the rules form
// in the big tile (one lse-card per group), the current rates, asset names (js/features/asset-names.js), the effect of
// the change, the version history and a live "needs attention" check of the form.
// Styles: css/stations.css (.lst-*, .lse-*, .eco-*). Classic script: shares globals with the other modules; load order
// is set in index.html (crvFa / crvArgs from caravans.js are only used at run time).

const ECONOMY_GROUPS = [
  {
    title: 'نرخ‌ها', icon: 'fa-right-left',
    fields: [
      ['nakhPerFarsh', 'تعداد کلاف هر قالیچه'],
      ['farshSalePrice', 'قیمت فروش هر قالیچه (زریک)'],
      ['allowBuyNakh', 'امکان خرید کلاف با زریک', 'checkbox'],
      ['zarikPerNakh', 'قیمت هر کلاف، اگر خرید فعال باشد (زریک)'],
    ],
  },
  {
    title: 'چالش شخصی و چالش گروهی (پاداش راهبر)', icon: 'fa-user-group',
    hint: 'راهبر فقط زریک یا کلاف می‌دهد؛ درفش فقط از رتبه‌بندی چالش فراگروهی می‌آید.',
    fields: [['challengeMaxNakh', 'سقف جایزه‌ی هر چالش (کلاف)'], ['challengeMaxZarik', 'سقف جایزه‌ی هر چالش (زریک)']],
  },
  {
    title: 'وزن معیارهای ارزیابی چالش', icon: 'fa-scale-balanced', sum: true,
    fields: [
      ['evaluationWeights.relevance', 'ارتباط با موضوع'],
      ['evaluationWeights.quality', 'کیفیت و استدلال'],
      ['evaluationWeights.collaboration', 'همکاری با دیگران'],
      ['evaluationWeights.initiative', 'ابتکار و پیشبرد'],
    ],
  },
  {
    title: 'جایزه‌ی فراگروهی برای هر فرد (زریک)', icon: 'fa-trophy',
    fields: [
      ['interGroup.prizes.gold', 'رتبه‌ی اول'],
      ['interGroup.prizes.silver', 'رتبه‌ی دوم'],
      ['interGroup.prizes.bronze', 'رتبه‌ی سوم'],
      ['interGroup.prizes.cloth', 'سایر کاروان‌ها'],
    ],
  },
  {
    title: 'جایزه‌ی فراگروهی برای هر فرد (کلاف)', icon: 'fa-ribbon',
    hint: 'پیش‌فرض هر چالش فراگروهی؛ مدیر هنگام رتبه‌بندی می‌تواند برای همان چالش تغییرش دهد. ۰ یعنی بدون کلاف.',
    fields: [
      ['interGroup.nakhPrizes.gold', 'رتبه‌ی اول (طلایی)'],
      ['interGroup.nakhPrizes.silver', 'رتبه‌ی دوم (نقره‌ای)'],
      ['interGroup.nakhPrizes.bronze', 'رتبه‌ی سوم (برنزی)'],
      ['interGroup.nakhPrizes.cloth', 'سایر کاروان‌ها (پارچه‌ای)'],
    ],
  },
  {
    title: 'وزن معیارهای رتبه‌ی فراگروهی', icon: 'fa-ranking-star', sum: true,
    fields: [
      ['interGroup.rankWeights.judges', 'امتیاز داوران'],
      ['interGroup.rankWeights.coverage', 'پوشش مشارکت'],
      ['interGroup.rankWeights.delivery', 'کامل بودن و تحویل در مهلت'],
    ],
  },
  {
    title: 'سهم فرد از جایزه‌ی فراگروهی', icon: 'fa-box-archive', legacy: true,
    hint: 'دیگر استفاده نمی‌شود؛ درصدها ثابت‌اند: پرچمدار ۱۰۰، فعال ۷۵، نیمه‌فعال ۵۰، همراه ۲۵، خسته ۰.',
    fields: [
      ['interGroup.tiers.full', 'فعال کامل'],
      ['interGroup.tiers.partner', 'همراه'],
      ['interGroup.tiers.minimal', 'حداقلی'],
    ],
  },
];

const economyPath = key => key.split('.');
const economyGet = (config, key) => economyPath(key).reduce((v, k) => (v == null ? v : v[k]), config);
const economyInputId = key => `economy-${key.replace(/\./g, '-')}`;
let ecoSaved = null;   // the config as last loaded (to tell unsaved changes)
let ecoLoadedOnce = false;

function economyReadForm() {
  const config = { evaluationWeights: {}, interGroup: { prizes: {}, nakhPrizes: {}, tiers: {}, rankWeights: {} } };
  ECONOMY_GROUPS.forEach(group => group.fields.forEach(([key, , type]) => {
    const input = document.getElementById(economyInputId(key));
    const path = economyPath(key);
    const parent = path.slice(0, -1).reduce((o, k) => o[k], config);
    parent[path[path.length - 1]] = type === 'checkbox' ? input.checked : Number(input.value);
  }));
  return config;
}

async function economySend(body) {
  return NopaApi.json('/api/v1/admin/economy', { method: 'PUT', body: JSON.stringify(body) });
}

function ecoSet(id, fn) { const el = document.getElementById(id); if (el) fn(el); }

// Called by the router on every visit
window.loadAssetsTab = async function() {
  window.ecoSetLoading(true);
  await Promise.allSettled([window.loadAssetNames(), window.loadEconomy()]);
  ecoLoadedOnce = true;
  window.ecoSetLoading(false);
};

window.ecoSetLoading = function(on) {
  const overview = document.getElementById('eco-overview-view');
  if (!overview) return;
  overview.querySelectorAll('.lst-bento > .lst-tile').forEach(t => t.classList.toggle('is-loading', on));
  ecoSet('economy-settings', el => el.setAttribute('aria-busy', on ? 'true' : 'false'));
  if (!on || ecoLoadedOnce) return;
  ecoSet('economy-settings', el => {
    el.innerHTML = Array.from({ length: 4 }, () => `
      <section class="lse-card" aria-hidden="true">
        <span class="lst-skel-line lst-skel-short"></span><span class="lst-skel-line"></span><span class="lst-skel-line"></span>
      </section>`).join('');
  });
  const lines = '<div class="lst-skel-lines" aria-hidden="true">' + '<span class="lst-skel-row"></span>'.repeat(3) + '</div>';
  ['asset-names-list', 'economy-history', 'eco-bento-health'].forEach(id => ecoSet(id, el => { el.innerHTML = lines; }));
};

function ecoGroupHtml(group, config, i) {
  const fields = group.fields.map(([key, label, type]) => {
    const value = economyGet(config, key);
    const id = economyInputId(key);
    return type === 'checkbox'
      ? `<label class="lse-tree-row crv-cand eco-check"><input type="checkbox" id="${id}" data-change="ecoCheck"${value ? ' checked' : ''}><span class="lse-tree-text"><strong>${esc(label)}</strong></span></label>`
      : `<label class="lse-field"><span>${esc(label)}</span><input type="number" min="0" step="1" id="${id}" value="${esc(String(value ?? 0))}" class="input-ctrl" data-input="ecoCheck"></label>`;
  }).join('');
  return `
    <section class="lse-card eco-group${group.legacy ? ' is-legacy' : ''}" data-anim-key="eg:${i}">
      <h4 class="lse-card-title"><i class="fa-solid ${group.icon}"></i> ${esc(group.title)}
        ${group.sum ? `<span class="lsv-status eco-sum" id="eco-sum-${i}"></span>` : ''}
        ${group.legacy ? '<span class="lst-chip lst-chip-scheduled"><i class="fa-solid fa-box-archive"></i> قدیمی</span>' : ''}
      </h4>
      <div class="lse-grid lse-grid-2">${fields}</div>
      ${group.hint ? `<p class="lse-hint">${esc(group.hint)}</p>` : ''}
    </section>`;
}

window.loadEconomy = async function() {
  const box = document.getElementById('economy-settings');
  if (!box) return;
  let data;
  try {
    data = await NopaApi.json('/api/v1/admin/economy', { silent: true });
  } catch (e) {
    box.innerHTML = '<div class="lst-empty"><i class="fa-solid fa-lock lst-warn"></i> این بخش فقط برای مدیر کل در دسترس است.</div>';
    ['economy-history', 'eco-bento-health'].forEach(id => ecoSet(id, el => { el.innerHTML = '<div class="lst-empty">در دسترس نیست.</div>'; }));
    return;
  }
  ecoSaved = data.config;
  const draw = () => { box.innerHTML = ECONOMY_GROUPS.map((g, i) => ecoGroupHtml(g, data.config, i)).join(''); };
  if (window.NopaFlip) window.NopaFlip.render(box, draw); else draw();
  box.setAttribute('aria-busy', 'false');

  const c = data.config || {};
  ecoSet('eco-stat-version', el => { el.textContent = crvFa(data.version); });
  ecoSet('eco-stat-nakh', el => { el.textContent = crvFa(c.nakhPerFarsh); });
  ecoSet('eco-stat-farsh', el => { el.textContent = crvFa(c.farshSalePrice); });
  ecoSet('eco-stat-challenge', el => { el.textContent = crvFa(c.challengeMaxNakh); });
  ecoSet('eco-version-badge', el => { el.textContent = `نسخه‌ی ${crvFa(data.version)} فعال است؛ هر ذخیره یک نسخه‌ی جدید می‌سازد`; });
  ecoSet('economy-preview', el => {
    el.innerHTML = '<div class="lst-empty"><i class="fa-solid fa-calculator"></i> مقادیر را تغییر دهید و «محاسبه‌ی اثر» را بزنید.</div>';
  });

  const history = Array.isArray(data.history) ? data.history : [];
  ecoSet('economy-history', el => {
    el.innerHTML = history.length
      ? `<ul class="lst-list">${history.slice(0, 6).map(h => `
          <li class="lst-list-item" data-anim-key="eh:${esc(h.version)}">
            <span class="crv-rank${Number(h.version) === Number(data.version) ? ' eco-rank-current' : ''}">${crvFa(h.version)}</span>
            <span class="lst-grow"><strong>${esc(h.createdByName)}</strong> <small class="u-c-text-muted">${esc(new Date(h.createdAt).toLocaleDateString('fa-IR'))}${h.note ? ` · ${esc(h.note)}` : ''}</small></span>
          </li>`).join('')}</ul>`
      : '<div class="lst-empty">هنوز تغییری ثبت نشده است؛ مقادیر پیش‌فرض فعال‌اند.</div>';
  });
  window.ecoCheck();
};

// Live check of the form: weight sums, rates that make no sense, prizes out of order, unsaved changes
window.ecoCheck = function() {
  if (!document.getElementById(economyInputId('nakhPerFarsh'))) return;
  const c = economyReadForm();
  const issues = [];
  ECONOMY_GROUPS.forEach((g, i) => {
    if (!g.sum) return;
    const total = g.fields.reduce((n, [key]) => n + (Number(economyGet(c, key)) || 0), 0);
    ecoSet(`eco-sum-${i}`, el => {
      el.textContent = `جمع ${crvFa(total)}٪`;
      el.classList.toggle('is-ok', total === 100);
      el.classList.toggle('is-warn', total !== 100);
    });
    if (total !== 100) issues.push(`${g.title}: جمع وزن‌ها ${crvFa(total)}٪ است (باید ۱۰۰ باشد)`);
  });
  if (!c.nakhPerFarsh) issues.push('تعداد کلاف هر قالیچه صفر است');
  if (!c.farshSalePrice) issues.push('قیمت فروش قالیچه صفر است');
  if (c.allowBuyNakh && !c.zarikPerNakh) issues.push('خرید کلاف فعال است اما قیمت هر کلاف صفر است');
  const p = c.interGroup.prizes;
  if (!(p.gold >= p.silver && p.silver >= p.bronze && p.bronze >= p.cloth)) issues.push('جایزه‌های فراگروهی از رتبه‌ی اول به پایین نزولی نیستند');
  const k = c.interGroup.nakhPrizes;
  if (!(k.gold >= k.silver && k.silver >= k.bronze && k.bronze >= k.cloth)) issues.push('کلاف‌های فراگروهی از رتبه‌ی اول به پایین نزولی نیستند');
  const dirty = ecoSaved && JSON.stringify(economyReadForm()) !== JSON.stringify(ecoNormalize(ecoSaved));

  ecoSet('eco-bento-health', el => {
    const rows = issues.map(t => `
      <li class="lst-list-item"><i class="fa-solid fa-triangle-exclamation lst-warn"></i><span class="lst-grow">${esc(t)}</span></li>`);
    if (dirty) rows.unshift(`
      <li class="lst-list-item lst-clickable" role="button" tabindex="0" data-click="saveEconomy">
        <i class="fa-solid fa-pen-to-square u-c-accent-text"></i><span class="lst-grow">تغییرات ذخیره‌نشده دارید؛ برای ساخت نسخه‌ی جدید بزنید</span>
      </li>`);
    el.innerHTML = rows.length
      ? `<ul class="lst-list">${rows.join('')}</ul>`
      : '<div class="lst-empty"><i class="fa-solid fa-circle-check u-c-success-text"></i> مقادیر سازگارند و تغییر ذخیره‌نشده‌ای نیست.</div>';
  });
};
// The saved config in the form's shape (same keys, same order) so it can be compared with economyReadForm()
function ecoNormalize(config) {
  const out = { evaluationWeights: {}, interGroup: { prizes: {}, nakhPrizes: {}, tiers: {}, rankWeights: {} } };
  ECONOMY_GROUPS.forEach(group => group.fields.forEach(([key, , type]) => {
    const path = economyPath(key);
    const parent = path.slice(0, -1).reduce((o, k) => o[k], out);
    const v = economyGet(config, key);
    parent[path[path.length - 1]] = type === 'checkbox' ? !!v : Number(v ?? 0);
  }));
  return out;
}

window.previewEconomy = async function() {
  const box = document.getElementById('economy-preview');
  if (box) box.closest('.lst-tile')?.classList.add('is-loading');
  try {
    const { preview: p } = await economySend({ config: economyReadForm(), dryRun: true });
    const delta = (a, b) => {
      const d = Number(b) - Number(a);
      return d ? `<small class="${d > 0 ? 'u-c-success-text' : 'u-c-danger-text'}" dir="ltr">${d > 0 ? '+' : ''}${crvFa(d)}</small>` : '<small class="u-c-text-muted">بدون تغییر</small>';
    };
    if (box) box.innerHTML = `
      <ul class="lst-list">
        <li class="lst-list-item"><i class="fa-solid fa-sack-dollar u-c-accent-text"></i><span class="lst-grow">سرمایه‌ی رتبه‌بندی ${crvFa(p.students)} دانش‌آموز<br><strong>${crvFa(p.capitalBefore)} ← ${crvFa(p.capitalAfter)}</strong></span>${delta(p.capitalBefore, p.capitalAfter)}</li>
        <li class="lst-list-item"><i class="fa-solid fa-trophy u-c-info-text"></i><span class="lst-grow">بیشترین پرداخت یک چالش فراگروهی<br><strong>${crvFa(p.maxInterGroupBefore)} ← ${crvFa(p.maxInterGroupAfter)}</strong></span>${delta(p.maxInterGroupBefore, p.maxInterGroupAfter)}</li>
      </ul>`;
  } catch (e) {
    showToast(e.message || 'خطا در محاسبه‌ی اثر تغییرات', 'error');
  } finally {
    if (box) box.closest('.lst-tile')?.classList.remove('is-loading');
  }
};

window.saveEconomy = async function() {
  const note = document.getElementById('economy-note').value;
  if (!(await NopaConfirm('نسخه‌ی جدید قوانین مالی از همین لحظه اعمال شود؟'))) return;
  try {
    const saved = await economySend({ config: economyReadForm(), note });
    document.getElementById('economy-note').value = '';
    showToast(`نسخه‌ی ${saved.version} ثبت شد. تراکنش‌ها و موجودی‌های قبلی تغییر نمی‌کنند.`, 'success');
    window.loadEconomy();
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره تنظیمات', 'error');
  }
};

// The tab starts in its loading state until the first fetch finishes
window.ecoSetLoading(true);
