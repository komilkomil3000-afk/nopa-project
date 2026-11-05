// Bulk add of people (همسفران → «افزودن گروهی»; markup in index.html #user-import-overlay, styles in
// css/user-import.css). Three steps:
//   1. source: an Excel/CSV file (read on the server: POST /admin/users/import/parse) or text from the clipboard
//      (TSV copied from Excel, CSV, or one person per line with the phone anywhere in it)
//   2. review: map each column to a field (guessed from the header), pick the role (and caravan) of every row,
//      select all / some, fix names and phones in place
//   3. result: POST /admin/users/import in chunks, then each row's outcome
// Name + phone are the only required fields; every other column of the file is sent along.
(function () {
  const CHUNK = 200;
  const MAX_ROWS = 2000;
  const ROLE_LABELS = {
    student: 'نوجوان (دانش‌آموز)', mentor: 'راهبر', sub_admin: 'ادمین محتوا',
    channel_manager: 'مسئول کانال‌ها', support: 'پشتیبانی', admin: 'سوپر ادمین',
  };
  const STAFF = ['admin', 'sub_admin', 'channel_manager', 'support'];

  // field key -> label + header aliases (compared after norm())
  const FIELDS = [
    { key: 'name', label: 'نام و نام خانوادگی', aliases: ['name', 'fullname', 'نام', 'نامونامخانوادگی', 'نامکامل', 'اسم', 'نامهمسفر', 'نامدانشاموز', 'نامنوجوان', 'نامراهبر'] },
    { key: 'firstName', label: 'نام (کوچک)', aliases: ['firstname', 'first', 'نامکوچک'] },
    { key: 'lastName', label: 'نام خانوادگی', aliases: ['lastname', 'last', 'surname', 'family', 'familyname', 'نامخانوادگی', 'فامیلی', 'فامیل'] },
    { key: 'phoneNumber', label: 'شماره همراه', aliases: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'cell', 'موبایل', 'شمارهموبایل', 'شمارههمراه', 'همراه', 'شمارهتماس', 'تلفن', 'تلفنهمراه', 'شماره', 'تماس'] },
    { key: 'role', label: 'نقش', aliases: ['role', 'نقش', 'سمت', 'نوعکاربر'] },
    { key: 'caravanName', label: 'کاروان', aliases: ['caravan', 'caravanname', 'کاروان', 'نامکاروان', 'گروه'] },
    { key: 'levelFrame', label: 'سطح (منزلگاه)', aliases: ['level', 'levelframe', 'سطح', 'منزلگاه'] },
    { key: 'mentorLevel', label: 'سطح راهبری', aliases: ['mentorlevel', 'سطحراهبری', 'رتبهراهبری'] },
    { key: 'nationalId', label: 'کد ملی', aliases: ['nationalid', 'nationalcode', 'کدملی', 'شمارهملی'] },
    { key: 'dateOfBirth', label: 'تاریخ تولد', aliases: ['dateofbirth', 'birthdate', 'birthday', 'dob', 'تاریختولد', 'تولد'] },
    { key: 'gender', label: 'جنسیت', aliases: ['gender', 'sex', 'جنسیت', 'جنس'] },
    { key: 'password', label: 'گذرواژه', aliases: ['password', 'pass', 'گذرواژه', 'رمز', 'رمزعبور', 'کلمهعبور'] },
    { key: 'email', label: 'ایمیل', aliases: ['email', 'mail', 'ایمیل', 'پستالکترونیک', 'پستالکترونیکی'] },
    { key: 'city', label: 'شهر', aliases: ['city', 'شهر', 'محلسکونت', 'شهرمحلسکونت'] },
    { key: 'academicDegree', label: 'مدرک تحصیلی', aliases: ['degree', 'academicdegree', 'مدرک', 'مدرکتحصیلی', 'تحصیلات'] },
    { key: 'academicCertificates', label: 'مدارک و گواهی‌نامه‌ها', aliases: ['certificates', 'academiccertificates', 'گواهینامه', 'گواهینامهها', 'مدارکوگواهینامهها', 'مدارک'] },
    { key: 'bio', label: 'توضیحات', aliases: ['bio', 'about', 'description', 'توضیحات', 'بیوگرافی', 'درباره'] },
    { key: 'slogan', label: 'شعار', aliases: ['slogan', 'شعار'] },
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const EXTRA_KEYS = FIELDS.map(f => f.key).filter(k => !['name', 'firstName', 'lastName', 'phoneNumber', 'role', 'caravanName'].includes(k));
  const FILTERS = [
    { key: 'all', label: 'همه' }, { key: 'on', label: 'انتخاب‌شده' },
    { key: 'ok', label: 'آماده' }, { key: 'bad', label: 'دارای خطا' },
  ];

  const st = {
    step: 'source', grid: [], hasHeader: false, map: [], rows: [], filter: 'all',
    sourceLabel: '', caravans: [], busy: false, done: false, summary: null,
  };
  const $ = id => document.getElementById(id);
  const fa = n => (typeof crvFa === 'function' ? crvFa(n) : Number(n).toLocaleString('fa-IR'));

  // ---- text helpers ------------------------------------------------------------------------
  const latinDigits = s => String(s == null ? '' : s)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const norm = s => latinDigits(s).toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
    .replace(/[\s‌‏‎_\-.:()\[\]/\\*#،,؛;]+/g, '');
  function normPhone(v) {
    let p = latinDigits(v).replace(/\D/g, '');
    if (p.startsWith('0098')) p = '0' + p.slice(4);
    else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
    else if (p.length === 10 && p.startsWith('9')) p = '0' + p;
    return p;
  }
  const isPhone = v => /^09\d{9}$/.test(normPhone(v));
  const PHONE_IN_TEXT = /(?:\+98|0098|98|0)?\s*9[\d۰-۹٠-٩](?:[\s-]?[\d۰-۹٠-٩]){8}/;

  function parseRole(v) {
    const s = norm(v);
    if (!s) return '';
    for (const [k, label] of Object.entries(ROLE_LABELS)) if (s === k.replace(/_/g, '') || s === norm(label)) return k;
    if (/سوپر|superadmin/.test(s)) return 'admin';
    if (/محتوا|subadmin/.test(s)) return 'sub_admin';
    if (/کانال|channel/.test(s)) return 'channel_manager';
    if (/پشتیبان|support/.test(s)) return 'support';
    if (/راهبر|مربی|mentor/.test(s)) return 'mentor';
    if (/نوجوان|دانشاموز|متربی|همسفر|student/.test(s)) return 'student';
    if (/^(admin|ادمین|مدیر)$/.test(s)) return 'admin';
    return '';
  }
  function parseGender(v) {
    const s = norm(v);
    if (!s) return '';
    if (/^(m|male|man|boy|پسر|مرد|اقا|مذکر)$/.test(s)) return 'male';
    if (/^(f|female|woman|girl|دختر|زن|خانم|مونث)$/.test(s)) return 'female';
    return '';
  }

  // ---- grid parsing ------------------------------------------------------------------------
  function splitDelimited(line, sep) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"' && cur === '') q = true;
      else if (c === sep) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  function parseText(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const count = ch => lines.filter(l => l.includes(ch)).length;
    let sep = null;
    if (count('\t') >= lines.length / 2) sep = '\t';
    else for (const ch of [',', '،', ';', '؛', '|']) if (count(ch) >= lines.length / 2) { sep = ch; break; }
    let grid = sep ? lines.map(l => splitDelimited(l, sep)) : lines.map(l => [l.trim()]);
    return splitNamePhone(grid);
  }
  // one-column lists ("علی رضایی 0912...") become [name, phone]
  function splitNamePhone(grid) {
    const width = Math.max(0, ...grid.map(r => r.length));
    if (width !== 1) return grid;
    return grid.map(([cell]) => {
      const m = String(cell).match(PHONE_IN_TEXT);
      if (!m) return [cell, ''];
      const name = (cell.slice(0, m.index) + ' ' + cell.slice(m.index + m[0].length)).replace(/[\s,،;؛:\-|]+/g, ' ').trim();
      return [name, m[0].replace(/\s|-/g, '')];
    });
  }

  function aliasMatch(header) {
    const h = norm(header);
    if (!h) return null;
    for (const f of FIELDS) if (f.aliases.includes(h)) return f.key;
    for (const f of FIELDS) if (f.aliases.some(a => a.length >= 4 && h.includes(a))) return f.key;
    return null;
  }
  function looksLikeHeader(row) {
    return row.some(c => aliasMatch(c)) && !row.some(c => isPhone(c));
  }
  function guessMap() {
    const width = Math.max(0, ...st.grid.map(r => r.length));
    const map = new Array(width).fill('');
    if (st.hasHeader) {
      const used = new Set();
      st.grid[0].forEach((h, i) => {
        const k = aliasMatch(h);
        if (k && !used.has(k)) { map[i] = k; used.add(k); }
      });
    }
    const body = st.hasHeader ? st.grid.slice(1) : st.grid;
    const sample = body.slice(0, 200);
    if (!map.includes('phoneNumber')) {
      let best = -1, bestN = 0;
      for (let i = 0; i < width; i++) {
        if (map[i]) continue;
        const n = sample.filter(r => isPhone(r[i])).length;
        if (n > bestN) { best = i; bestN = n; }
      }
      if (best >= 0 && bestN >= sample.length / 3) map[best] = 'phoneNumber';
    }
    if (!map.includes('name') && !map.includes('firstName')) {
      let best = -1, bestN = 0;
      for (let i = 0; i < width; i++) {
        if (map[i]) continue;
        const n = sample.filter(r => /[^\d\s+\-۰-۹٠-٩]/.test(String(r[i] || '')) && !isPhone(r[i])).length;
        if (n > bestN) { best = i; bestN = n; }
      }
      if (best >= 0) map[best] = 'name';
    }
    st.map = map;
  }

  // ---- rows --------------------------------------------------------------------------------
  const isSuper = () => !window.NopaNav || window.NopaNav.sectionAllowed(null);
  const allowedRoles = () => Object.keys(ROLE_LABELS).filter(r => isSuper() || !STAFF.includes(r));
  const caravanKey = s => norm(s);
  function matchCaravan(v) {
    const s = String(v || '').trim();
    if (!s) return { id: '', miss: '' };
    const hit = st.caravans.find(c => String(c.id) === s || caravanKey(c.name || c.title) === caravanKey(s));
    return hit ? { id: String(hit.id), miss: '' } : { id: '', miss: s };
  }

  function buildRows() {
    const body = st.hasHeader ? st.grid.slice(1) : st.grid;
    const col = key => st.map.indexOf(key);
    const get = (r, key) => { const i = col(key); return i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''; };
    const roles = allowedRoles();
    st.rows = body.slice(0, MAX_ROWS).map((r, i) => {
      // «نام» + «نام خانوادگی» columns are joined (unless the name column already holds the full name)
      const first = get(r, 'name') || get(r, 'firstName');
      const last = get(r, 'lastName');
      const name = last && !first.endsWith(last) ? [first, last].filter(Boolean).join(' ') : first;
      const rawRole = get(r, 'role');
      let role = parseRole(rawRole);
      const roleNote = rawRole && !role ? `نقش «${rawRole}» شناخته نشد` : (role && !roles.includes(role) ? `نقش «${ROLE_LABELS[role]}» فقط با سوپر ادمین` : '');
      if (!roles.includes(role)) role = 'student';
      const cv = matchCaravan(get(r, 'caravanName'));
      const extra = {};
      EXTRA_KEYS.forEach(k => { const v = get(r, k); if (v) extra[k] = v; });
      if (extra.gender) { const g = parseGender(extra.gender); if (g) extra.gender = g; else delete extra.gender; }
      return { id: i, name: name.replace(/\s+/g, ' '), phone: get(r, 'phoneNumber'), role, caravanId: cv.id, caravanMiss: cv.miss, roleNote, extra, on: true, err: '', result: null };
    });
    validate();
    st.rows.forEach(r => { r.on = !r.err; });
  }

  function validate() {
    const counts = new Map();
    st.rows.forEach(r => { const p = normPhone(r.phone); if (p) counts.set(p, (counts.get(p) || 0) + 1); });
    const firstOf = new Map();
    st.rows.forEach(r => {
      const p = normPhone(r.phone);
      if (!r.name.trim()) r.err = 'نام خالی است';
      else if (!p) r.err = 'شماره همراه خالی است';
      else if (!/^09\d{9}$/.test(p)) r.err = 'شماره همراه معتبر نیست';
      else if (counts.get(p) > 1 && firstOf.has(p)) r.err = `تکراری (ردیف ${fa(firstOf.get(p) + 1)})`;
      else r.err = '';
      if (p && !firstOf.has(p)) firstOf.set(p, r.id);
    });
  }

  // ---- rendering ---------------------------------------------------------------------------
  function roleOptions(selected) {
    return allowedRoles().map(r => `<option value="${r}"${r === selected ? ' selected' : ''}>${esc(ROLE_LABELS[r])}</option>`).join('');
  }
  function caravanOptions(selected, first) {
    return `<option value="">${esc(first || 'بدون کاروان')}</option>` +
      st.caravans.map(c => `<option value="${esc(c.id)}"${String(c.id) === String(selected) ? ' selected' : ''}>${esc(c.name || c.title || '')}</option>`).join('');
  }
  function statusBadge(r) {
    if (r.result) {
      const cls = { created: 'is-ok', updated: 'is-info', skipped: 'is-warn', error: 'is-bad' }[r.result.status] || '';
      return `<span class="uim-badge ${cls}">${esc(r.result.message)}</span>`;
    }
    if (r.err) return `<span class="uim-badge is-bad"><i class="fa-solid fa-circle-exclamation"></i> ${esc(r.err)}</span>`;
    const notes = [r.roleNote, r.caravanMiss ? `کاروان «${r.caravanMiss}» پیدا نشد` : ''].filter(Boolean);
    if (notes.length) return `<span class="uim-badge is-warn" title="${esc(notes.join(' · '))}"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(notes[0])}</span>`;
    return '<span class="uim-badge is-ok"><i class="fa-solid fa-check"></i> آماده</span>';
  }
  function extraText(r) {
    return Object.entries(r.extra).filter(([k]) => k !== 'password').map(([k, v]) => {
      const val = k === 'gender' ? (v === 'male' ? 'پسر' : 'دختر') : v;
      return `${FIELD[k].label}: ${val}`;
    }).concat(r.extra.password ? ['گذرواژه اختصاصی'] : []).join(' · ');
  }
  function rowHtml(r) {
    const locked = r.result && (r.result.status === 'created' || r.result.status === 'updated');
    const ex = extraText(r);
    return `
      <tr data-row="${r.id}" class="${r.on ? '' : 'is-off'}${r.err ? ' is-bad' : ''}${locked ? ' is-done' : ''}">
        <td class="uim-c-check"><input type="checkbox" data-f="on" aria-label="انتخاب ردیف ${r.id + 1}"${r.on ? ' checked' : ''}${r.err || locked ? ' disabled' : ''}></td>
        <td class="uim-c-num">${fa(r.id + 1)}</td>
        <td><input type="text" class="input-ctrl" data-f="name" value="${esc(r.name)}" aria-label="نام"${locked ? ' disabled' : ''}></td>
        <td><input type="text" class="input-ctrl uim-phone" data-f="phone" value="${esc(r.phone)}" inputmode="tel" aria-label="شماره همراه"${locked ? ' disabled' : ''}></td>
        <td><select class="select-ctrl" data-f="role" aria-label="نقش"${locked ? ' disabled' : ''}>${roleOptions(r.role)}</select></td>
        <td><select class="select-ctrl" data-f="caravanId" aria-label="کاروان"${locked ? ' disabled' : ''}>${caravanOptions(r.caravanId)}</select></td>
        <td>${ex ? `<span class="uim-extra" title="${esc(ex)}">${esc(ex)}</span>` : '<span class="uim-extra">—</span>'}</td>
        <td data-status>${statusBadge(r)}</td>
      </tr>`;
  }
  function visible(r) {
    if (st.filter === 'on') return r.on;
    if (st.filter === 'ok') return !r.err;
    if (st.filter === 'bad') return !!r.err;
    return true;
  }

  function renderMap() {
    const body = st.hasHeader ? st.grid.slice(1) : st.grid;
    $('uim-has-header').checked = st.hasHeader;
    $('uim-source-label').textContent = st.sourceLabel;
    $('uim-map').innerHTML = st.map.map((key, i) => {
      const head = st.hasHeader ? (st.grid[0][i] || `ستون ${fa(i + 1)}`) : `ستون ${fa(i + 1)}`;
      const sample = body.slice(0, 3).map(r => r[i]).filter(Boolean).join('، ');
      return `
        <div class="uim-col${key ? ' is-mapped' : ''}">
          <span class="uim-col-head" title="${esc(head)}">${esc(head)}</span>
          <span class="uim-col-sample" title="${esc(sample)}">${esc(sample || '—')}</span>
          <select class="select-ctrl" data-col="${i}" aria-label="فیلد ستون ${i + 1}">
            <option value="">— نادیده گرفته شود —</option>
            ${FIELDS.map(f => `<option value="${f.key}"${f.key === key ? ' selected' : ''}>${esc(f.label)}${f.key === 'name' || f.key === 'phoneNumber' ? ' *' : ''}</option>`).join('')}
          </select>
        </div>`;
    }).join('');
  }
  function renderFilters() {
    const n = { all: st.rows.length, on: st.rows.filter(r => r.on).length, ok: st.rows.filter(r => !r.err).length, bad: st.rows.filter(r => r.err).length };
    $('uim-filter').innerHTML = FILTERS.map(f =>
      `<button type="button" class="chm-chip${f.key === st.filter ? ' is-active' : ''}" data-filter="${f.key}" aria-pressed="${f.key === st.filter}">${esc(f.label)}<span class="chm-chip-count">${fa(n[f.key])}</span></button>`).join('');
  }
  function renderRows() {
    const rows = st.rows.filter(visible);
    $('uim-rows').innerHTML = rows.length ? rows.map(rowHtml).join('')
      : `<tr><td colspan="8" class="uim-empty">${st.rows.length ? 'ردیفی با این فیلتر نیست' : 'ردیفی پیدا نشد؛ ستون نام و شماره همراه را تعیین کنید'}</td></tr>`;
    renderCounts();
  }
  function renderCounts() {
    const on = st.rows.filter(r => r.on && !r.err && !isLocked(r));
    const vis = st.rows.filter(r => visible(r) && !r.err && !isLocked(r));
    const all = $('uim-check-all');
    all.checked = vis.length > 0 && vis.every(r => r.on);
    all.indeterminate = !all.checked && vis.some(r => r.on);
    $('uim-sel-count').textContent = `${fa(on.length)} نفر انتخاب شده`;
    renderFilters();
    renderFoot();
  }
  const isLocked = r => r.result && (r.result.status === 'created' || r.result.status === 'updated');
  function renderBulk() {
    $('uim-bulk-role').innerHTML = '<option value="">تعیین نقش انتخاب‌شده‌ها…</option>' + roleOptions('');
    $('uim-bulk-caravan').innerHTML = '<option value="">تعیین کاروان انتخاب‌شده‌ها…</option><option value="__none">بدون کاروان</option>' +
      st.caravans.map(c => `<option value="${esc(c.id)}">${esc(c.name || c.title || '')}</option>`).join('');
  }
  function updateRowEl(r) {
    const tr = $('uim-rows').querySelector(`tr[data-row="${r.id}"]`);
    if (!tr) return;
    tr.classList.toggle('is-off', !r.on);
    tr.classList.toggle('is-bad', !!r.err);
    const cb = tr.querySelector('[data-f="on"]');
    cb.checked = r.on;
    cb.disabled = !!r.err || isLocked(r);
    tr.querySelector('[data-status]').innerHTML = statusBadge(r);
  }

  function renderFoot() {
    const actions = $('uim-foot-actions');
    const note = $('uim-foot-note');
    if (st.busy) return;
    if (st.step === 'source') {
      note.innerHTML = '<i class="fa-solid fa-circle-info"></i> حداقل اطلاعات هر نفر: نام و شماره همراه';
      actions.innerHTML = '<button type="button" class="lse-btn" data-click="closeUserImport">انصراف</button>';
    } else if (st.step === 'review') {
      const n = st.rows.filter(r => r.on && !r.err && !isLocked(r)).length;
      const bad = st.rows.filter(r => r.err).length;
      note.innerHTML = bad
        ? `<i class="fa-solid fa-triangle-exclamation"></i> ${fa(bad)} ردیف خطا دارد و افزوده نمی‌شود؛ می‌توانید همین‌جا اصلاحش کنید`
        : '<i class="fa-solid fa-circle-info"></i> شماره همراه، نام کاربری ورود به اپ است';
      actions.innerHTML = `
        <button type="button" class="lse-btn" data-click="uimGo" data-click-args='["source"]'><i class="fa-solid fa-arrow-right"></i> منبع دیگر</button>
        <button type="button" class="lsv-pill" data-click="uimSubmit"${n ? '' : ' disabled'}><i class="fa-solid fa-user-plus"></i> افزودن ${fa(n)} نفر</button>`;
    } else {
      note.innerHTML = '<i class="fa-solid fa-circle-check"></i> فهرست همسفران به‌روز شد';
      const left = st.rows.some(r => !isLocked(r));
      actions.innerHTML = `
        ${left ? '<button type="button" class="lse-btn" data-click="uimGo" data-click-args=\'["review"]\'><i class="fa-solid fa-pen"></i> اصلاح ردیف‌های باقی‌مانده</button>' : ''}
        <button type="button" class="lse-btn" data-click="uimRestart"><i class="fa-solid fa-file-import"></i> فهرست تازه</button>
        <button type="button" class="lsv-pill" data-click="closeUserImport"><i class="fa-solid fa-check"></i> بستن</button>`;
    }
  }

  function setStep(step) {
    st.step = step;
    document.querySelectorAll('#user-import-overlay [data-uim-pane]').forEach(p => p.classList.toggle('is-active', p.dataset.uimPane === step));
    document.querySelectorAll('#user-import-overlay [data-uim-step]').forEach(b => {
      const s = b.dataset.uimStep;
      b.classList.toggle('is-active', s === step);
      b.disabled = s === 'review' ? !st.grid.length : s === 'result' ? !st.summary : false;
    });
    $('uim-body').scrollTop = 0;
    renderFoot();
  }

  function loadGrid(grid, label) {
    grid = (grid || []).map(r => (Array.isArray(r) ? r.map(c => String(c == null ? '' : c).trim()) : [])).filter(r => r.some(Boolean));
    if (!grid.length) { showToast('ردیفی در اطلاعات پیدا نشد', 'error'); return; }
    if (grid.length > MAX_ROWS + 1) showToast(`فقط ${fa(MAX_ROWS)} ردیف اول خوانده شد`, 'info');
    st.grid = grid;
    st.sourceLabel = label;
    st.hasHeader = looksLikeHeader(grid[0]);
    st.filter = 'all';
    st.summary = null;
    guessMap();
    buildRows();
    renderMap();
    renderBulk();
    renderRows();
    setStep('review');
    if (!st.map.includes('phoneNumber') || !(st.map.includes('name') || st.map.includes('firstName'))) {
      showToast('ستون نام یا شماره همراه شناخته نشد؛ در بخش «ستون‌ها» تعیینش کنید', 'info');
    }
  }

  async function ensureCaravans() {
    let list = window.caravansData && window.caravansData.length ? window.caravansData : (typeof caravansList !== 'undefined' ? caravansList : []);
    if (!list || !list.length) {
      try {
        const data = await NopaApi.json('/api/v1/admin/caravans');
        list = Array.isArray(data) ? data : (data.caravans || data.data || []);
      } catch (_) { list = []; }
    }
    st.caravans = (list || []).filter(c => c && c.id).map(c => ({ id: String(c.id), name: c.name || c.title || '' }));
  }

  // ---- actions (data-click / data-change) --------------------------------------------------
  window.openUserImport = async function () {
    st.grid = []; st.rows = []; st.map = []; st.summary = null; st.busy = false;
    $('uim-paste').value = '';
    $('uim-file').value = '';
    $('uim-password').value = '123456';
    $('uim-existing').value = 'skip';
    setStep('source');
    $('user-import-overlay').style.display = 'flex';
    await ensureCaravans();
  };
  window.closeUserImport = async function () {
    if (st.busy) return;
    const pending = st.step === 'review' && !st.summary && st.rows.some(r => r.on && !r.err);
    if (pending && !(await NopaConfirm('فهرست هنوز افزوده نشده است. پنجره بسته شود؟', { okText: 'بستن', danger: false }))) return;
    $('user-import-overlay').style.display = 'none';
    if (st.summary && (st.summary.created || st.summary.updated)) refreshAfterImport();
  };
  window.uimRestart = function () {
    st.grid = []; st.rows = []; st.summary = null;
    $('uim-paste').value = '';
    $('uim-file').value = '';
    setStep('source');
  };
  window.uimGo = function (step) {
    if (st.busy) return;
    if (step === 'review' && !st.grid.length) return;
    if (step === 'review') renderRows();
    setStep(step);
  };

  window.uimPickFile = function (input) {
    const file = input.files && input.files[0];
    if (file) readFile(file);
  };
  async function readFile(file) {
    if (!/\.(xlsx|xls|xlsm|ods|csv|tsv|txt)$/i.test(file.name)) { showToast('فقط فایل Excel یا CSV', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('حجم فایل بیشتر از ۵ مگابایت است', 'error'); return; }
    const drop = $('uim-drop');
    drop.classList.add('is-busy');
    try {
      const data = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(new Error('خواندن فایل ممکن نشد'));
        fr.readAsDataURL(file);
      });
      const res = await NopaApi.json('/api/v1/admin/users/import/parse', {
        method: 'POST', body: JSON.stringify({ fileName: file.name, data }),
      });
      loadGrid(res.rows, `${file.name}${res.sheet ? ` · برگه «${res.sheet}»` : ''}`);
    } catch (e) {
      showToast(e.message || 'خطا در خواندن فایل', 'error');
    } finally {
      drop.classList.remove('is-busy');
      $('uim-file').value = '';
    }
  }

  window.uimPasteFromClipboard = async function () {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { showToast('کلیپ‌بورد خالی است', 'info'); return; }
      $('uim-paste').value = text;
      loadGrid(parseText(text), 'متن کلیپ‌بورد');
    } catch (_) {
      showToast('مرورگر اجازه خواندن کلیپ‌بورد را نداد؛ با Ctrl+V در کادر جای‌گذاری کنید', 'info');
      $('uim-paste').focus();
    }
  };
  window.uimUsePaste = function () {
    const text = $('uim-paste').value;
    if (!text.trim()) { showToast('ابتدا متن را در کادر جای‌گذاری کنید', 'info'); $('uim-paste').focus(); return; }
    loadGrid(parseText(text), 'متن جای‌گذاری‌شده');
  };

  window.uimToggleHeader = function (on) {
    st.hasHeader = !!on;
    guessMap();
    buildRows();
    renderMap();
    renderRows();
  };
  window.uimCheckAll = function (on) {
    st.rows.forEach(r => { if (visible(r) && !r.err && !isLocked(r)) r.on = !!on; });
    renderRows();
  };
  function selectedRows() { return st.rows.filter(r => r.on && !r.err && !isLocked(r)); }
  window.uimBulkRole = function (role) {
    if (!role) return;
    const rows = selectedRows();
    if (!rows.length) showToast('ابتدا ردیف‌ها را انتخاب کنید', 'info');
    rows.forEach(r => { r.role = role; r.roleNote = ''; });
    $('uim-bulk-role').value = '';
    renderRows();
  };
  window.uimBulkCaravan = function (value) {
    if (!value) return;
    const rows = selectedRows();
    if (!rows.length) showToast('ابتدا ردیف‌ها را انتخاب کنید', 'info');
    rows.forEach(r => { r.caravanId = value === '__none' ? '' : value; r.caravanMiss = ''; });
    $('uim-bulk-caravan').value = '';
    renderRows();
  };

  window.uimDownloadTemplate = function () {
    const cols = ['name', 'phoneNumber', 'role', 'caravanName', 'levelFrame', 'mentorLevel', 'nationalId', 'dateOfBirth', 'gender', 'password', 'email', 'city', 'academicDegree', 'academicCertificates', 'bio', 'slogan'];
    const sample = [
      ['علی رضایی', '09121234567', 'نوجوان', '', '1', '', '0012345678', '1390/05/12', 'پسر', '', '', 'تهران', '', '', '', ''],
      ['سارا محمدی', '09351234567', 'راهبر', '', '1', '2', '', '', 'دختر', '', 'sara@example.com', 'مشهد', 'کارشناسی ارشد', '', '', ''],
    ];
    const q = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
    const csv = '﻿' + [cols.map(k => FIELD[k].label), ...sample].map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'nopa-users-template.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  window.uimSubmit = async function () {
    const rows = selectedRows();
    if (!rows.length || st.busy) return;
    const staff = rows.filter(r => STAFF.includes(r.role)).length;
    if (staff && !(await NopaConfirm(`${fa(staff)} نفر با نقش مدیریتی (ادمین، پشتیبانی یا مسئول کانال) افزوده می‌شوند. ادامه می‌دهید؟`, { okText: 'ادامه', danger: false }))) return;
    const password = $('uim-password').value.trim();
    if (password && password.length < 4) { showToast('گذرواژه پیش‌فرض باید دست‌کم ۴ نویسه باشد', 'error'); return; }
    const existing = $('uim-existing').value;

    st.busy = true;
    const actions = $('uim-foot-actions');
    actions.innerHTML = '<div class="uim-progress"><i id="uim-progress-bar"></i></div>';
    $('uim-foot-note').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> در حال افزودن <span id="uim-progress-text">۰</span> از ${fa(rows.length)}...`;
    const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };
    let sent = 0;
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const part = rows.slice(i, i + CHUNK);
        const payload = part.map(r => Object.assign({}, r.extra, {
          index: r.id, name: r.name.trim(), phoneNumber: normPhone(r.phone), role: r.role, caravanId: r.caravanId || '',
        }));
        let res;
        try {
          res = await NopaApi.json('/api/v1/admin/users/import', {
            method: 'POST', body: JSON.stringify({ rows: payload, defaultPassword: password, existing }),
          });
        } catch (e) {
          part.forEach(r => { r.result = { status: 'error', message: e.message || 'خطای ارتباط با سرور' }; });
          summary.failed += part.length;
          continue;
        }
        (res.results || []).forEach(x => {
          const r = st.rows[x.index];
          if (r) r.result = x;
        });
        Object.keys(summary).forEach(k => { summary[k] += (res.summary && res.summary[k]) || 0; });
        sent += part.length;
        const bar = $('uim-progress-bar');
        if (bar) bar.style.width = `${Math.round((sent / rows.length) * 100)}%`;
        const txt = $('uim-progress-text');
        if (txt) txt.textContent = fa(sent);
      }
    } finally {
      st.busy = false;
    }
    rows.forEach(r => { if (isLocked(r)) r.on = false; });
    st.summary = summary;
    renderSummary(rows);
    setStep('result');
    showToast(`${fa(summary.created)} نفر افزوده شد${summary.updated ? `، ${fa(summary.updated)} نفر به‌روز شد` : ''}`, summary.created || summary.updated ? 'success' : 'info');
    if (summary.created || summary.updated) refreshAfterImport();
  };

  function renderSummary(rows) {
    const s = st.summary;
    const tile = (cls, n, label) => `<div class="uim-stat ${cls}"><b>${fa(n)}</b><span>${label}</span></div>`;
    $('uim-summary').innerHTML = tile('is-ok', s.created, 'نفر جدید افزوده شد') + tile('is-info', s.updated, 'نفر به‌روز شد') +
      tile('is-warn', s.skipped, 'ردیف رد شد (تکراری)') + tile('is-bad', s.failed, 'ردیف خطا داشت');
    $('uim-result-rows').innerHTML = rows.map(r => {
      const x = r.result || { status: 'error', message: 'نتیجه‌ای دریافت نشد' };
      const cls = { created: 'is-ok', updated: 'is-info', skipped: 'is-warn', error: 'is-bad' }[x.status] || '';
      return `<tr><td class="uim-c-num">${fa(r.id + 1)}</td><td>${esc(r.name)}</td><td dir="ltr">${esc(normPhone(r.phone))}</td><td>${esc(ROLE_LABELS[r.role] || r.role)}</td><td><span class="uim-badge ${cls}">${esc(x.message)}</span></td></tr>`;
    }).join('');
  }

  function refreshAfterImport() {
    if (typeof loadUsers === 'function') loadUsers();
    if (typeof window.lvlInvalidate === 'function') window.lvlInvalidate();
    if (typeof loadAllUsersDropdown === 'function') loadAllUsersDropdown();
    if (typeof loadCaravansTab === 'function') loadCaravansTab();
  }

  // ---- delegated listeners for the rows, column mapping, filters and file drop -------------
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
  let inited = false;
  function init() {
    if (inited || !$('user-import-overlay')) return;
    inited = true;
    const tbody = $('uim-rows');
    const rowOf = el => st.rows[Number(el.closest('tr[data-row]')?.dataset.row)];
    tbody.addEventListener('input', e => {
      const f = e.target.dataset.f;
      const r = rowOf(e.target);
      if (!r || (f !== 'name' && f !== 'phone')) return;
      const wasBad = !!r.err;
      r[f] = e.target.value;
      const before = st.rows.map(x => x.err);
      validate();
      if (wasBad && !r.err) r.on = true;
      st.rows.forEach((x, i) => { if (x === r || before[i] !== x.err) updateRowEl(x); });
      renderCounts();
    });
    tbody.addEventListener('change', e => {
      const f = e.target.dataset.f;
      const r = rowOf(e.target);
      if (!r) return;
      if (f === 'on') { r.on = e.target.checked; updateRowEl(r); renderCounts(); }
      if (f === 'role') { r.role = e.target.value; r.roleNote = ''; updateRowEl(r); }
      if (f === 'caravanId') { r.caravanId = e.target.value; r.caravanMiss = ''; updateRowEl(r); }
    });
    $('uim-map').addEventListener('change', e => {
      const i = Number(e.target.dataset.col);
      if (!Number.isInteger(i)) return;
      const key = e.target.value;
      if (key) st.map = st.map.map((k, j) => (k === key && j !== i ? '' : k)); // a field belongs to one column
      st.map[i] = key;
      buildRows();
      renderMap();
      renderRows();
    });
    $('uim-filter').addEventListener('click', e => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      st.filter = b.dataset.filter;
      renderRows();
    });
    const drop = $('uim-drop');
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('uim-file').click(); } });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readFile(f); });
    // Ctrl+V straight into the dialog's first step (outside the text box) reads the pasted rows too
    $('user-import-overlay').addEventListener('paste', e => {
      if (st.step !== 'source' || e.target === $('uim-paste')) return;
      const text = e.clipboardData && e.clipboardData.getData('text');
      if (text && text.trim()) { e.preventDefault(); $('uim-paste').value = text; loadGrid(parseText(text), 'متن جای‌گذاری‌شده'); }
    });
  }
})();
