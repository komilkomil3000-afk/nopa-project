// Shared identity fields for the person forms (user modal, mentor modal). Loaded before the feature modules.
// Markup: <div data-person-fields="modal-user" data-extra="city" data-phone-group-id="phone-field-group"></div>
// renders name / phone / national id / birth date / gender (+ city) with ids `${prefix}-name`, `-phone`,
// `-national-id`, `-dob`, `-gender`, `-city` — the ids the existing handlers already read.
//   NopaPersonFields.fill(prefix, { name, phoneNumber, nationalId, dateOfBirth, gender, city })
//   NopaPersonFields.validate(prefix, { requirePhone }) -> boolean (marks fields inline, focuses the first error)
//   NopaPersonFields.read(prefix) -> normalised values; phoneNumber is undefined when an edit left the
//     loaded phone untouched (it may be masked for admins without phone access; sending it back would
//     overwrite the real number)
(function () {
  const DIGITS = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  const toLatinDigits = s => String(s == null ? '' : s).replace(/[۰-۹٠-٩]/g, d => DIGITS[d]);

  // Same rules as the server's normalizePhone (authController): login only finds users stored this way
  function normalizePhone(v) {
    let p = toLatinDigits(v).replace(/\D/g, '');
    if (p.startsWith('0098')) p = '0' + p.slice(4);
    else if (p.startsWith('98')) p = '0' + p.slice(2);
    else if (p.length === 10 && p.startsWith('9')) p = '0' + p;
    return p;
  }

  const FIELDS = {
    name: el => `<input type="text" id="${el}" class="input-ctrl" autocomplete="off" required placeholder="مثال: رضا جلالی">`,
    phone: el => `<input type="text" id="${el}" class="input-ctrl" inputmode="numeric" dir="ltr" placeholder="۰۹۱۲۰۰۰۰۰۰۰">`,
    'national-id': el => `<input type="text" id="${el}" class="input-ctrl" inputmode="numeric" dir="ltr" placeholder="۰۰۱۲۳۴۵۶۷۸">`,
    dob: el => `<input type="text" id="${el}" class="input-ctrl" dir="ltr" placeholder="۱۳۸۰/۰۵/۱۲">`,
    gender: el => `<select id="${el}" class="select-ctrl"><option value="">تعیین نشده</option><option value="male">مرد</option><option value="female">زن</option></select>`,
    city: el => `<input type="text" id="${el}" class="input-ctrl" placeholder="مثال: تهران">`,
  };
  const LABELS = {
    name: 'نام و نام خانوادگی', phone: 'شماره همراه', 'national-id': 'کد ملی (اختیاری)',
    dob: 'تاریخ تولد (شمسی)', gender: 'جنسیت (تصویر پروفایل در اپ)', city: 'شهر محل سکونت',
  };

  function render(container) {
    const prefix = container.dataset.personFields;
    const keys = ['name', 'phone', 'national-id', 'dob', 'gender'].concat((container.dataset.extra || '').split(/\s+/).filter(Boolean));
    container.classList.add('person-fields');
    container.innerHTML = keys.map(k => {
      const id = `${prefix}-${k}`;
      const groupId = k === 'phone' && container.dataset.phoneGroupId ? ` id="${container.dataset.phoneGroupId}"` : '';
      return `<div class="form-group person-field person-field--${k}"${groupId}>
        <label for="${id}">${LABELS[k]}${k === 'name' ? ' <span class="req">*</span>' : ''}</label>
        ${FIELDS[k](id)}
        <small class="field-error" id="${id}-error" aria-live="polite"></small>
      </div>`;
    }).join('');
  }

  const el = (prefix, k) => document.getElementById(`${prefix}-${k}`);

  function fill(prefix, data) {
    data = data || {};
    const set = (k, v) => { const e = el(prefix, k); if (e) e.value = v == null ? '' : v; };
    set('name', data.name);
    set('phone', data.phoneNumber);
    const phone = el(prefix, 'phone');
    if (phone) phone.dataset.initial = data.phoneNumber || '';
    set('national-id', data.nationalId);
    set('dob', data.dateOfBirth);
    set('gender', data.gender);
    set('city', data.city);
    clearErrors(prefix);
  }

  function setError(prefix, k, msg) {
    const input = el(prefix, k);
    const out = document.getElementById(`${prefix}-${k}-error`);
    if (!input) return;
    input.classList.toggle('is-invalid', !!msg);
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (msg) input.setAttribute('aria-describedby', `${prefix}-${k}-error`);
    if (out) out.textContent = msg || '';
  }
  function clearErrors(prefix) { Object.keys(FIELDS).forEach(k => setError(prefix, k, '')); }

  function phoneUnchanged(prefix) {
    const phone = el(prefix, 'phone');
    return !!phone && phone.dataset.initial !== undefined && phone.dataset.initial !== '' && phone.value.trim() === phone.dataset.initial;
  }

  function validate(prefix, opts) {
    opts = opts || {};
    clearErrors(prefix);
    const errors = [];
    const name = (el(prefix, 'name')?.value || '').trim();
    if (!name) errors.push(['name', 'نام را وارد کنید']);

    const rawPhone = (el(prefix, 'phone')?.value || '').trim();
    if (!(rawPhone && phoneUnchanged(prefix))) {
      if (!rawPhone) { if (opts.requirePhone) errors.push(['phone', 'شماره همراه را وارد کنید']); }
      else if (!/^09\d{9}$/.test(normalizePhone(rawPhone))) errors.push(['phone', 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود']);
    }

    const nid = toLatinDigits(el(prefix, 'national-id')?.value || '').replace(/[\s-]/g, '');
    if (nid && !/^\d{10}$/.test(nid)) errors.push(['national-id', 'کد ملی باید ۱۰ رقم باشد']);

    const dob = toLatinDigits(el(prefix, 'dob')?.value || '').trim();
    if (dob && !/^1[34]\d{2}\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])$/.test(dob)) errors.push(['dob', 'تاریخ را به شکل ۱۳۸۰/۰۵/۱۲ وارد کنید']);

    errors.forEach(([k, m]) => setError(prefix, k, m));
    if (errors.length) {
      const first = el(prefix, errors[0][0]);
      if (first) first.focus();
      showToast(errors[0][1], 'error');
    }
    return errors.length === 0;
  }

  function read(prefix) {
    const v = k => (el(prefix, k)?.value || '').trim();
    const rawPhone = v('phone');
    return {
      name: v('name'),
      phoneNumber: !rawPhone || phoneUnchanged(prefix) ? undefined : normalizePhone(rawPhone),
      nationalId: toLatinDigits(v('national-id')).replace(/[\s-]/g, '') || null,
      dateOfBirth: v('dob') || null,
      gender: v('gender'),
      city: el(prefix, 'city') ? (v('city') || null) : undefined,
    };
  }

  // Render at load (scripts sit at the end of <body>, the containers already exist), before any
  // feature module looks the ids up. Typing clears that field's error.
  document.querySelectorAll('[data-person-fields]').forEach(render);
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.classList && t.classList.contains('is-invalid')) {
      t.classList.remove('is-invalid');
      t.removeAttribute('aria-invalid');
      const out = document.getElementById(t.id + '-error');
      if (out) out.textContent = '';
    }
  });

  window.NopaPersonFields = { render, fill, validate, read, normalizePhone, toLatinDigits };
})();
