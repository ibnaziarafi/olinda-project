// Point API_BASE to Dashboard Service on Port 8001 when local
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';
  const API_BASE = LOCAL ? (location.port === '8001' ? location.origin : 'http://localhost:8001') : 'https://olinda-ai-backend-dashboard.onrender.com';
  const DASHBOARD_HEALTH_URL = API_BASE + '/health';
  const HEALTH_CHECK_INTERVAL = 13 * 60 * 1000;

  async function checkDashboardHealth() {
    const loginStatus = document.getElementById('server-status');
    const dashboardStatus = document.getElementById('dashboard-api-status');
    loginStatus.textContent = 'Connecting to dashboard server...';
    dashboardStatus.textContent = '● Connecting to API...';
    try {
      const response = await fetch(DASHBOARD_HEALTH_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Health check returned ${response.status}`);
      loginStatus.textContent = 'Dashboard server up';
      dashboardStatus.textContent = '● Server up';
      dashboardStatus.className = 'tag tag-success';
    } catch (error) {
      loginStatus.textContent = 'Dashboard server unavailable';
      dashboardStatus.textContent = '● Server unavailable';
      dashboardStatus.className = 'tag tag-warning';
    }
  }

  checkDashboardHealth();
  setInterval(checkDashboardHealth, HEALTH_CHECK_INTERVAL);

  const TOKEN_KEY = 'olinda_staff_token';
  const NAME_KEY  = 'olinda_staff_name';
  const ROLE_KEY  = 'olinda_staff_role';

  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function getStaffName() { return sessionStorage.getItem(NAME_KEY) || ''; }
  function getRole() { return sessionStorage.getItem(ROLE_KEY) || 'user'; }
  function isAdmin() { return getRole() === 'admin'; }

  function authHeaders(extra) {
    const h = extra || {};
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function authFetch(url, options) {
    options = options || {};
    options.headers = authHeaders(options.headers || {});
    const res = await fetch(url, options);
    if (res.status === 401) {
      logout('Your session expired. Please sign in again.');
      throw new Error('unauthorized');
    }
    return res;
  }
