// Local mock API for checking admin-panel pages in a browser without the real backend (which needs a login).
//   node mock-server.js <path-to-admin_panel/public> [port]
// then open http://localhost:<port>/admin/, run in the console:
//   localStorage.setItem('nopa_admin_token','mock'); localStorage.setItem('nopa_admin_user', JSON.stringify({id:'a1',name:'مدیر',role:'admin'})); location.hash='#<tab-hash>'; location.reload();
// The sample data below covers the caravans / mentors / tickets / instructors routes. For another tab, add its
// routes to api() with realistic Persian sample data (and an empty and a long case). Unknown GETs return [].
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 5179);

const now = Date.now();
const ago = h => new Date(now - h * 3600e3).toISOString();
const caravans = [
  { id: 'c1', name: 'کاروان ستاره', mentorId: 'm1', memberCount: 3, overallProgress: 62, status: 'active', capacityLimit: 25, coverImageUrl: null },
  { id: 'c2', name: 'کاروان افق', mentorId: 'm1', memberCount: 2, overallProgress: 40, status: 'active', capacityLimit: 10, coverImageUrl: null },
  { id: 'c3', name: 'کاروان مهتاب', mentorId: 'm2', memberCount: 2, overallProgress: 85, status: 'suspended', capacityLimit: 2, coverImageUrl: null },
  { id: 'c4', name: 'کاروان سپیده', mentorId: null, memberCount: 0, overallProgress: 0, status: 'active', capacityLimit: 25, coverImageUrl: null },
];
const students = [
  { id: 's1', name: 'علی رضایی', phoneNumber: '09121111111', userCode: 1001, zarikBalance: 320, caravanId: 'c1' },
  { id: 's2', name: 'سارا محمدی', phoneNumber: '09122222222', userCode: 1002, zarikBalance: 150, caravanId: 'c1' },
  { id: 's3', name: 'محمد کریمی', phoneNumber: '09123333333', userCode: 1003, zarikBalance: 90, caravanId: 'c1' },
  { id: 's4', name: 'زهرا احمدی', phoneNumber: '09124444444', userCode: 1004, zarikBalance: 410, caravanId: 'c2' },
  { id: 's5', name: 'حسین نوری', phoneNumber: '09125555555', userCode: 1005, zarikBalance: 60, caravanId: 'c2' },
  { id: 's6', name: 'مریم صادقی', phoneNumber: '09126666666', userCode: 1006, zarikBalance: 220, caravanId: 'c3' },
  { id: 's7', name: 'رضا جلالی', phoneNumber: '09127777777', userCode: 1007, zarikBalance: 10, caravanId: 'c3' },
];
const mentors = [
  { id: 'm1', name: 'نرگس توکلی', phoneNumber: '09351234567', nationalId: '0012345678', role: 'mentor', mentorLevel: 2, city: 'تهران', academicDegree: 'کارشناسی ارشد علوم تربیتی', accountStatus: 'ACTIVE', identityVerified: true, userCode: 501, socialPlatform: 'ایتا', socialMessengerHandle: '@narges', bio: 'راهبر کاروان‌های نوجوانان با پنج سال سابقه کار با نوجوانان.', ratingsReceived: [{ ratingValue: 5 }, { ratingValue: 4 }], evaluationsReceived: [], mentorDocuments: [{ id: 'd1', status: 'pending', filename: 'مدرک.pdf', url: '#' }] },
  { id: 'm2', name: 'امیر حسینی', phoneNumber: '09359876543', role: 'mentor', mentorLevel: 1, city: 'اصفهان', accountStatus: 'PENDING_VERIFICATION', identityVerified: false, userCode: 502, ratingsReceived: [{ ratingValue: 3 }], evaluationsReceived: [], mentorDocuments: [] },
  { id: 'm3', name: 'فاطمه کاظمی', phoneNumber: '', role: 'mentor', mentorLevel: 3, accountStatus: 'SUSPENDED', identityVerified: true, userCode: 503, ratingsReceived: [], evaluationsReceived: [], mentorDocuments: [] },
];
const tickets = [
  { id: 't1', studentId: 's1', category: 'فنی', subject: 'ویدیوی جلسه دوم پخش نمی‌شود', status: 'open', createdAt: ago(5), updatedAt: ago(5), replies: [] },
  { id: 't2', studentId: 's2', category: 'چالش', subject: 'زمان ارسال چالش هفته را تمدید می‌کنید؟', status: 'answered', createdAt: ago(30), updatedAt: ago(20), replies: [{ id: 'r1', message: 'بله، تا پنجشنبه فرصت دارید.', createdAt: ago(20), mentor: { id: 'm1', name: 'نرگس توکلی', role: 'mentor' } }] },
  { id: 't3', studentId: 's4', category: 'زریک', subject: 'زریک جایزه به حسابم نیامد', status: 'resolved', createdAt: ago(80), updatedAt: ago(70), replies: [{ id: 'r2', message: 'بررسی شد و واریز شد.', createdAt: ago(70), mentor: { id: 'a1', name: 'مدیر پنل', role: 'admin' } }] },
  { id: 't4', studentId: 's6', category: 'عمومی', subject: 'چطور عضو کاروان دیگری شوم؟', status: 'open', createdAt: ago(2), updatedAt: ago(2), replies: [] },
  { id: 't5', studentId: 's9', category: 'عمومی', subject: 'سلام، کاروان ندارم', status: 'open', createdAt: ago(1), updatedAt: ago(1), replies: [] },
];
const instructors = [
  { id: 'i1', name: 'علیرضا خوش‌منظر', degree: 'کارشناسی ارشد رسانه', phoneNumber: '09120000001', nationalId: '0011111111', classes: 'سواد رسانه، تولید محتوا، عکاسی', resume: 'ده سال تدریس سواد رسانه در مدارس.', description: 'معرفی کوتاه استاد.', avatarUrl: null, isActive: true, createdAt: ago(900) },
  { id: 'i2', name: 'لیلا مرادی', degree: '', phoneNumber: '', classes: 'فتوشاپ', resume: '', avatarUrl: null, isActive: false, createdAt: ago(400) },
];

const mentorPublic = m => m && { id: m.id, name: m.name, avatarUrl: m.avatarUrl || null, phoneNumber: m.phoneNumber };
const caravanOut = c => ({ ...c, _count: { members: students.filter(s => s.caravanId === c.id).length }, mentor: mentorPublic(mentors.find(m => m.id === c.mentorId)), members: students.filter(s => s.caravanId === c.id) });
const studentOut = s => {
  const c = caravans.find(x => x.id === s.caravanId);
  return { id: s.id, name: s.name, phoneNumber: s.phoneNumber, userCode: s.userCode, role: 'student', caravan: c ? { id: c.id, name: c.name, mentor: mentorPublic(mentors.find(m => m.id === c.mentorId)) } : null };
};

function api(method, url, body) {
  const p = url.split('?')[0];
  let m;
  if (p === '/api/v1/auth/login') return { token: 'mock', user: { id: 'a1', name: 'مدیر پنل', role: 'admin' } };
  if (p === '/api/v1/admin/mentors' && method === 'GET') {
    return mentors.map(x => ({ ...x, mentoredCaravans: caravans.filter(c => c.mentorId === x.id).map(c => ({ ...c, _count: { members: students.filter(s => s.caravanId === c.id).length } })) }));
  }
  if ((m = p.match(/^\/api\/v1\/admin\/mentors\/([^/]+)\/dossier$/))) {
    const mentor = mentors.find(x => x.id === m[1]);
    const cs = caravans.filter(c => c.mentorId === m[1]);
    const sup = [];
    cs.forEach(c => students.filter(s => s.caravanId === c.id).forEach(s => {
      const ts = tickets.filter(t => t.studentId === s.id);
      sup.push({ ...s, caravanName: c.name, tickets: ts, submissions: [], quizSubmissions: [], stats: { totalTickets: ts.length, openTickets: ts.filter(t => t.status !== 'resolved').length, totalSubmissions: 1, pendingSubmissions: s.id === 's1' ? 1 : 0 } });
    }));
    return { identity: mentor, caravans: cs, supervisedStudents: sup };
  }
  if (p === '/api/v1/admin/caravans' && method === 'GET') return caravans.map(caravanOut);
  if ((m = p.match(/^\/api\/v1\/admin\/caravans\/([^/]+)$/)) && method === 'PATCH') {
    const c = caravans.find(x => x.id === m[1]);
    if (c && body && 'mentorId' in body) c.mentorId = body.mentorId || null;
    return { caravan: c };
  }
  if (p === '/api/v1/admin/tickets') return tickets.map(t => ({ ...t, student: studentOut(students.find(s => s.id === t.studentId) || { id: t.studentId, name: 'کاربر بی‌کاروان' }) }));
  if ((m = p.match(/^\/api\/v1\/admin\/tickets\/([^/]+)\/reply$/))) {
    const t = tickets.find(x => x.id === m[1]);
    const reply = { id: 'r' + Date.now(), message: body.message, createdAt: new Date().toISOString(), mentor: { id: 'a1', name: 'مدیر پنل', role: 'admin' } };
    t.replies.push(reply); t.status = 'answered';
    return { success: true, reply };
  }
  if ((m = p.match(/^\/api\/v1\/admin\/tickets\/([^/]+)\/resolve$/))) { tickets.find(x => x.id === m[1]).status = 'resolved'; return { success: true }; }
  if (p === '/api/v1/instructors' || p === '/api/v1/admin/instructors') return { success: true, data: instructors };
  if ((m = p.match(/^\/api\/v1\/admin\/instructors\/([^/]+)$/))) {
    const i = instructors.find(x => x.id === m[1]);
    if (method === 'PUT') { Object.assign(i, body); return { success: true, data: i }; }
    return { success: true, data: { ...i, sessions: i.id === 'i1' ? [
      { id: 'se1', title: 'جلسه اول: رسانه چیست؟', sessionDate: '1405/07/02', sessionTime: '۱۸:۰۰ الی ۱۹:۳۰', videoUrl: 'x', category: { id: 'k1', title: 'مبانی', station: { id: 'st1', title: 'منزلگاه اول' } } },
      { id: 'se2', title: 'جلسه دوم: تولید محتوا', sessionDate: '1405/07/09', category: { id: 'k1', title: 'مبانی', station: { id: 'st1', title: 'منزلگاه اول' } } },
    ] : [] } };
  }
  return method === 'GET' ? [] : { success: true };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    let raw = '';
    req.on('data', d => { raw += d; });
    req.on('end', () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (_) {}
      const out = api(req.method, req.url, body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  let rel = decodeURIComponent(req.url.split('?')[0]);
  let base = ROOT;
  if (rel.startsWith('/admin/libs/fontawesome')) { base = path.join(ROOT, '../node_modules/@fortawesome/fontawesome-free'); rel = rel.slice('/admin/libs/fontawesome'.length); }
  else if (rel.startsWith('/admin/libs/chartjs')) { base = path.join(ROOT, '../node_modules/chart.js/dist'); rel = rel.slice('/admin/libs/chartjs'.length); }
  else if (rel.startsWith('/admin')) rel = rel.slice('/admin'.length);
  let file = path.join(base, rel);
  if (req.url === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('mock on ' + PORT));
