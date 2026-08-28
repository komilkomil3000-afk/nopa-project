const fs = require('fs');
const path = require('path');

// 1. Read index.html and verify IDs
const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');

const hasUsersTbody = html.includes('id="users-tbody"');
const hasStationsTbody = html.includes('id="stations-tbody"');
const hasScriptCacheBuster = html.includes('src="/app.js?v=2.0.1"');

console.log('--- HTML CHECK ---');
console.log('users-tbody present:', hasUsersTbody);
console.log('stations-tbody present:', hasStationsTbody);
console.log('script cache-buster present:', hasScriptCacheBuster);

// 2. Syntax check app.js
const appJs = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf-8');
try {
  new Function(appJs);
  console.log('--- JS SYNTAX CHECK ---');
  console.log('app.js syntax: VALID (0 syntax errors)');
} catch (e) {
  console.error('--- JS SYNTAX ERROR ---', e);
  process.exit(1);
}

// 3. Check endpoint responses with token
const fetch = require('node-fetch');
async function verifyData() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '09380346668', password: '123456' })
    });
    const { token } = await loginRes.json();
    
    const [usersRes, stationsRes] = await Promise.all([
      fetch('http://localhost:5000/api/v1/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('http://localhost:5000/api/v1/admin/lms/stations', { headers: { Authorization: `Bearer ${token}` } })
    ]);
    
    const usersData = await usersRes.json();
    const stationsData = await stationsRes.json();
    
    console.log('--- API DATA VERIFICATION ---');
    console.log('Users count from DB:', (usersData.users || usersData).length);
    console.log('Stations count from DB:', (stationsData.stations || stationsData).length);
  } catch (err) {
    console.log('Could not connect to live backend or endpoint:', err.message);
  }
}

verifyData();
