#!/usr/bin/env node
// Builds a new release APK of the Flutter app with a higher version, without touching pubspec.yaml by hand.
//
//   node scripts/release_app.js            -> 1.4.2+9 becomes 1.4.3+10  (a fix release: last number + 1)
//   node scripts/release_app.js minor      -> 1.4.2+9 becomes 1.5.0+10  (new features: middle number + 1)
//   node scripts/release_app.js --dry-run  -> only shows what the next version would be
//   node scripts/release_app.js --no-build -> only writes the new version into pubspec.yaml
//
// The first number (major) is changed by hand in app/pubspec.yaml (e.g. 1.5.0 -> 2.0.0). The script notices it
// (app/release_state.json keeps the last released version) and releases that version as it is, only raising the
// build number. The build number (after "+") always goes up, which Android needs to install over the old app.
//
// The build is split per processor architecture (flutter build apk --split-per-abi): one light APK each for
// arm64-v8a, armeabi-v7a and x86_64 instead of one big file. The app downloads the one of the phone
// (app/lib/services/app_update_service.dart). Flutter gives the split files the Android version codes
// 1000 + build (armv7), 2000 + build (arm64) and 4000 + build (x86_64); an all-in-one APK would only get
// "build" and so could never be installed over them, which is why none is built here.
//
// When the build fails, pubspec.yaml is put back as it was. On success the APKs are copied to
// app/build/releases/nopa-<version>-<abi>.apk and the version to enter in the panel is printed.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const PUBSPEC = path.join(APP, 'pubspec.yaml');
const STATE = path.join(APP, 'release_state.json');
const APK_DIR = path.join(APP, 'build', 'app', 'outputs', 'flutter-apk');
const RELEASES = path.join(APP, 'build', 'releases');
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];

const args = process.argv.slice(2);
const mode = args.find(a => !a.startsWith('--')) || 'patch';
const dryRun = args.includes('--dry-run');
const noBuild = args.includes('--no-build');

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

if (!['patch', 'minor'].includes(mode)) {
  fail(`نوع انتشار نامعتبر است: «${mode}». فقط patch (پیش‌فرض) یا minor. عدد اول را دستی در pubspec.yaml عوض کنید.`);
}

const VERSION_LINE = /^version:\s*(\d+)\.(\d+)\.(\d+)(?:\+(\d+))?\s*$/m;
const pubspec = fs.readFileSync(PUBSPEC, 'utf8');
const m = pubspec.match(VERSION_LINE);
if (!m) fail('خط version در app/pubspec.yaml پیدا نشد (باید شبیه version: 1.0.0+1 باشد).');

const current = { major: +m[1], minor: +m[2], patch: +m[3], build: +(m[4] || 0) };

let state = null;
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (_) { /* first release made by this script */ }
const last = state && /^\d+\.\d+\.\d+$/.test(state.version)
  ? (([a, b, c]) => ({ major: +a, minor: +b, patch: +c, build: +state.build || 0 }))(state.version.split('.'))
  : null;

let next;
if (last && current.major > last.major) {
  // the first number was raised by hand: release exactly that version
  next = { ...current };
  console.log(`عدد اول دستی از ${last.major} به ${current.major} رسیده؛ همین نسخه منتشر می‌شود.`);
} else if (mode === 'minor') {
  next = { major: current.major, minor: current.minor + 1, patch: 0 };
} else {
  next = { major: current.major, minor: current.minor, patch: current.patch + 1 };
}
next.build = Math.max(current.build, last ? last.build : 0) + 1;
if (next.build >= 1000) {
  // the split APKs' version codes are <abi>*1000 + build: from 1000 on, the ranges of two architectures meet
  console.warn('⚠ شماره ساخت به ۱۰۰۰ رسیده؛ کدهای نسخه‌ی معماری‌ها (۱۰۰۰ + ساخت، ۲۰۰۰ + ساخت، ...) روی هم می‌افتند.');
}

const name = `${next.major}.${next.minor}.${next.patch}`;
const full = `${name}+${next.build}`;
const was = `${current.major}.${current.minor}.${current.patch}+${current.build}`;
console.log(`نسخه: ${was}  →  ${full}`);
if (dryRun) process.exit(0);

const updated = pubspec.replace(VERSION_LINE, `version: ${full}`);
fs.writeFileSync(PUBSPEC, updated);

if (!noBuild) {
  console.log('\nساخت APK به تفکیک معماری (flutter build apk --release --split-per-abi) ...\n');
  // old split files must not be mistaken for this build's
  for (const abi of ABIS) fs.rmSync(path.join(APK_DIR, `app-${abi}-release.apk`), { force: true });
  const r = spawnSync('flutter', ['build', 'apk', '--release', '--split-per-abi'], { cwd: APP, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    fs.writeFileSync(PUBSPEC, pubspec);
    fail(`ساخت APK انجام نشد؛ نسخه در pubspec.yaml به ${was} برگشت.`);
  }
}

fs.writeFileSync(STATE, JSON.stringify({ version: name, build: next.build, releasedAt: new Date().toISOString() }, null, 2) + '\n');

if (noBuild) {
  console.log(`\n✔ نسخه در pubspec.yaml به ${full} تغییر کرد (APK ساخته نشد).`);
  process.exit(0);
}

fs.mkdirSync(RELEASES, { recursive: true });
const made = [];
for (const abi of ABIS) {
  const src = path.join(APK_DIR, `app-${abi}-release.apk`);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(RELEASES, `nopa-${name}-${abi}.apk`);
  fs.copyFileSync(src, dest);
  made.push({ abi, dest, mb: (fs.statSync(dest).size / 1024 / 1024).toFixed(1) });
}
if (!made.length) fail(`فایلی در ${APK_DIR} ساخته نشد.`);

console.log(`
✔ نسخه ${full} ساخته شد (${made.length} فایل):
${made.map(m => `  ${m.abi.padEnd(12)} ${m.mb.padStart(6)} MB   ${m.dest}`).join('\n')}

بعد:
  ۱. پنل ادمین ← نقش‌ها و دسترسی‌ها ← «نسخه اپلیکیشن» ← «ثبت نسخه جدید»
  ۲. شماره نسخه: ${name}
  ۳. در ردیف هر معماری، فایل همان معماری را «بارگذاری» کنید (یا لینکش را بگذارید)، سپس «انتشار».
  ۴. تغییرات pubspec.yaml و app/release_state.json را commit کنید.
`);
