const fetch = require('node-fetch');

async function testEndpoints() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '09380346668', password: '123456' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    if (!token) {
      console.log('Login failed');
      return;
    }
    
    console.log('--- ADMIN ENDPOINTS ---');
    const eps = [
      '/api/v1/admin/lms/stations',
      '/api/v1/admin/caravans',
      '/api/v1/admin/users',
      '/api/v1/admin/mentors'
    ];
    
    for (const ep of eps) {
      const res = await fetch('http://localhost:5000' + ep, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(`Endpoint ${ep} returned data:`, Array.isArray(data) || Array.isArray(data.users) ? 'Valid Array' : 'Invalid format');
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}
testEndpoints();
