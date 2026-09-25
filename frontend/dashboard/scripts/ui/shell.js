function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  async function doLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    showLoginError('');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showLoginError(data.detail || 'Invalid username or password.');
        return;
      }
      const data = await res.json();
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(NAME_KEY, data.name);
      sessionStorage.setItem(ROLE_KEY, data.role || 'user');
      enterDashboard();
    } catch (err) {
      showLoginError('Could not reach dashboard server on port 8001. Please make sure backend is running.');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  }

  function logout(message) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(NAME_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('login-password').value = '';
    if (message) showLoginError(message);
  }

  function enterDashboard() {
    const name = getStaffName();
    document.getElementById('user-name').textContent = name || 'Staff';
    document.getElementById('user-avatar').textContent = (name || '?').trim().charAt(0).toUpperCase();
    document.getElementById('role-badge').textContent = isAdmin() ? 'Admin' : 'Staff';
    document.getElementById('tab-btn-staff').style.display = isAdmin() ? '' : 'none';
    document.getElementById('login-overlay').classList.add('hidden');
    loadAnalytics();
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelectorAll('.tab-btn').forEach(btn => {
      if ((btn.getAttribute('onclick') || '').includes(`'${tabId}'`)) btn.classList.add('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'analytics') loadAnalytics();
    if (tabId === 'unanswered') loadUnanswered();
    if (tabId === 'knowledge') loadChunks();
    if (tabId === 'staff') loadStaff();
    if (tabId === 'account') loadMe();
  }
