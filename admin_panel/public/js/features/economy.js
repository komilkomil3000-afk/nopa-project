// Money rules of the app, edited by the super admin (سرمایه‌ها tab).
// Classic script: shares globals with the other modules; load order is set in index.html.

const ECONOMY_GROUPS = [
  {
    title: 'نرخ‌ها',
    fields: [
      ['nakhPerFarsh', 'تعداد کلاف هر قالیچه'],
      ['farshSalePrice', 'قیمت فروش هر قالیچه (زریک)'],
      ['allowBuyNakh', 'امکان خرید کلاف با زریک', 'checkbox'],
      ['zarikPerNakh', 'قیمت هر کلاف، اگر خرید فعال باشد (زریک)'],
    ],
  },
  { title: 'چالش‌های شخصی و درون‌گروهی', fields: [['challengeMaxNakh', 'سقف جایزه‌ی هر چالش (کلاف)']] },
  {
    title: 'وزن معیارهای ارزیابی چالش (درصد، جمع ۱۰۰)',
    fields: [
      ['evaluationWeights.relevance', 'ارتباط با موضوع'],
      ['evaluationWeights.quality', 'کیفیت و استدلال'],
      ['evaluationWeights.collaboration', 'همکاری با دیگران'],
      ['evaluationWeights.initiative', 'ابتکار و پیشبرد'],
    ],
  },
  {
    title: 'جایزه‌ی فراگروهی برای هر فرد (زریک)',
    fields: [
      ['interGroup.prizes.gold', 'رتبه‌ی اول'],
      ['interGroup.prizes.silver', 'رتبه‌ی دوم'],
      ['interGroup.prizes.bronze', 'رتبه‌ی سوم'],
      ['interGroup.prizes.cloth', 'سایر کاروان‌ها'],
    ],
  },
  {
    title: 'سهم فرد از جایزه‌ی فراگروهی (دیگر استفاده نمی‌شود؛ درصدها ثابت‌اند: پرچمدار ۱۰۰، فعال ۷۵، نیمه‌فعال ۵۰، همراه ۲۵، خسته ۰)',
    fields: [
      ['interGroup.tiers.full', 'فعال کامل'],
      ['interGroup.tiers.partner', 'همراه'],
      ['interGroup.tiers.minimal', 'حداقلی'],
    ],
  },
  {
    title: 'وزن معیارهای رتبه‌ی فراگروهی (درصد، جمع ۱۰۰)',
    fields: [
      ['interGroup.rankWeights.judges', 'امتیاز داوران'],
      ['interGroup.rankWeights.coverage', 'پوشش مشارکت'],
      ['interGroup.rankWeights.delivery', 'کامل بودن و تحویل در مهلت'],
    ],
  },
];

const economyPath = key => key.split('.');
const economyGet = (config, key) => economyPath(key).reduce((v, k) => (v == null ? v : v[k]), config);
const economyInputId = key => `economy-${key.replace(/\./g, '-')}`;

function economyReadForm() {
  const config = { evaluationWeights: {}, interGroup: { prizes: {}, tiers: {}, rankWeights: {} } };
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

window.loadEconomy = async function() {
  const box = document.getElementById('economy-settings');
  const historyBox = document.getElementById('economy-history');
  if (!box) return;
  let data;
  try {
    data = await NopaApi.json('/api/v1/admin/economy', { silent: true });
  } catch (e) {
    box.innerHTML = '<div class="u-fs-12_5 u-c-text-muted">این بخش فقط برای مدیر کل در دسترس است.</div>';
    return;
  }
  box.innerHTML = ECONOMY_GROUPS.map(group => `
    <div class="u-mb-14">
      <div class="u-c-text-soft u-fs-12 u-bold u-mb-5">${esc(group.title)}</div>
      <div class="u-grid u-cols-2 u-gap-12">
        ${group.fields.map(([key, label, type]) => {
          const value = economyGet(data.config, key);
          const id = economyInputId(key);
          return type === 'checkbox'
            ? `<label class="u-flex u-gap-6 u-items-center u-fs-12_5 u-c-text"><input type="checkbox" id="${id}" ${value ? 'checked' : ''}>${esc(label)}</label>`
            : `<div><label for="${id}" class="u-block u-fs-11 u-c-text-muted u-mb-5">${esc(label)}</label>
                 <input type="number" min="0" step="1" id="${id}" value="${esc(String(value))}" class="u-w-full u-p-6-10 u-bg-surface-2 u-bd-border-strong u-r-6 u-c-text u-fs-12_5"></div>`;
        }).join('')}
      </div>
    </div>`).join('');
  document.getElementById('economy-preview').textContent = '';

  historyBox.innerHTML = data.history.map(h => `
    <div class="u-fs-12 u-c-text-soft u-mb-5">نسخه‌ی ${esc(String(h.version))} · ${esc(h.createdByName)} · ${esc(new Date(h.createdAt).toLocaleString('fa-IR'))}${h.note ? ` · ${esc(h.note)}` : ''}</div>`).join('');
};

window.previewEconomy = async function() {
  try {
    const { preview: p } = await economySend({ config: economyReadForm(), dryRun: true });
    const n = v => Number(v).toLocaleString('fa-IR');
    document.getElementById('economy-preview').textContent =
      `سرمایه‌ی رتبه‌بندی ${n(p.students)} دانش‌آموز: از ${n(p.capitalBefore)} به ${n(p.capitalAfter)} زریک. ` +
      `بیشترین پرداخت یک چالش فراگروهی: از ${n(p.maxInterGroupBefore)} به ${n(p.maxInterGroupAfter)} زریک.`;
  } catch (e) {
    showToast(e.message || 'خطا در محاسبه‌ی اثر تغییرات', 'error');
  }
};

window.saveEconomy = async function() {
  const note = document.getElementById('economy-note').value;
  try {
    const saved = await economySend({ config: economyReadForm(), note });
    document.getElementById('economy-note').value = '';
    showToast(`نسخه‌ی ${saved.version} ثبت شد. تراکنش‌ها و موجودی‌های قبلی تغییر نمی‌کنند.`, 'success');
    window.loadEconomy();
  } catch (e) {
    showToast(e.message || 'خطا در ذخیره تنظیمات', 'error');
  }
};
