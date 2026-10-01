function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  const submitHandlers = { doLogin, handleFileUpload, handleTextIngest, addStaff, changePassword };
  document.querySelectorAll('[data-submit]').forEach(form => {
    form.addEventListener('submit', submitHandlers[form.dataset.submit]);
  });
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  document.querySelector('[data-action="logout"]').addEventListener('click', () => logout());
  document.querySelector('[data-action="select-file"]').addEventListener('click', () => document.getElementById('file-input').click());
  document.querySelector('[data-action="file-change"]').addEventListener('change', updateFileNameDisplay);

  if (getToken()) {
    enterDashboard();
  } else {
    document.getElementById('login-overlay').classList.remove('hidden');
  }
