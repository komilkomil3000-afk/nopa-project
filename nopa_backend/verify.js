async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '09036658547', password: '123456' }) 
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');
    const token = loginData.token;
    console.log("Got token");
    
    const meRes = await fetch('http://localhost:5000/api/v1/users/me', { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    const meData = await meRes.json();
    console.log("Me Response:");
    console.dir(meData, { depth: null });
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
