function escapeHtml(str) {
    return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  if (getToken()) {
    enterDashboard();
  } else {
    document.getElementById('login-overlay').classList.remove('hidden');
  }
