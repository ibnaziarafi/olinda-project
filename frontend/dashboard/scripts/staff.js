async function loadStaff() {
    try {
      const res = await authFetch(`${API_BASE}/api/staff`);
      let data = await res.json();
      if (!Array.isArray(data)) data = data ? [data] : [];
      const tbody = document.getElementById('staff-table-body');
      tbody.innerHTML = '';
      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--ink-soft);">No staff accounts found.</td></tr>';
        return;
      }
      const me = getStaffName();
      data.forEach(u => {
        const tr = document.createElement('tr');
        const typeTag = u.builtin
          ? '<span class="tag tag-info">Built-in</span>'
          : '<span class="tag tag-success">Added via dashboard</span>';
        const roleTag = u.role === 'admin'
          ? '<span class="tag tag-warning">Admin</span>'
          : '<span class="tag tag-info">User</span>';
        let action;
        if (u.removable) {
          action = `<button class="btn btn-danger" style="padding:4px 10px; font-size:0.78rem;" onclick="removeStaff('${escapeHtml(u.username)}', '${escapeHtml(u.name)}')">Remove</button>`;
        } else {
          action = '<span style="color: var(--ink-soft); font-size:0.82rem;">—</span>';
        }
        tr.innerHTML = `
          <td style="font-weight:600;">${escapeHtml(u.name)}${u.name === me ? ' <span class="tag tag-info" style="font-size:0.68rem;">you</span>' : ''}</td>
          <td style="font-family: var(--font-mono); font-size:0.85rem;">${escapeHtml(u.username)}</td>
          <td>${roleTag}</td>
          <td>${typeTag}</td>
          <td>${action}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Staff load error:', e);
    }
  }

  async function addStaff(e) {
    e.preventDefault();
    const btn = document.getElementById('add-staff-btn');
    const name = document.getElementById('new-name').value.trim();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const res = await authFetch(`${API_BASE}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password, role })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`${data.role === 'admin' ? 'Admin' : 'Staff'} login created for ${data.name}`);
        document.getElementById('new-name').value = '';
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('new-role').value = 'user';
        loadStaff();
      } else {
        alert(data.detail || 'Could not create staff login.');
      }
    } catch (err) {
      console.error('Add staff error:', err);
    } finally {
      btn.disabled = false; btn.textContent = 'Create Staff Login';
    }
  }

  async function removeStaff(username, name) {
    if (!confirm(`Remove staff login for ${name} (${username})? They will no longer be able to sign in.`)) return;
    try {
      const res = await authFetch(`${API_BASE}/api/staff/${encodeURIComponent(username)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`Removed ${name}`);
        loadStaff();
      } else {
        alert(data.detail || 'Could not remove this user.');
      }
    } catch (e) {
      console.error('Remove staff error:', e);
    }
  }

  async function loadMe() {
    try {
      const res = await authFetch(`${API_BASE}/api/me`);
      const me = await res.json();
      document.getElementById('me-name').textContent = me.name;
      document.getElementById('me-username').textContent = me.username;
      document.getElementById('me-role').innerHTML = me.role === 'admin'
        ? '<span class="tag tag-warning">Admin</span>' : '<span class="tag tag-info">Normal user</span>';
    } catch (e) {
      console.error('loadMe error:', e);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    const btn = document.getElementById('change-pw-btn');
    const current_password = document.getElementById('cur-password').value;
    const new_password = document.getElementById('new-my-password').value;
    btn.disabled = true; btn.textContent = 'Updating...';
    try {
      const res = await authFetch(`${API_BASE}/api/me/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password, new_password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Password updated.');
        document.getElementById('cur-password').value = '';
        document.getElementById('new-my-password').value = '';
      } else {
        if ((data.detail || '').toLowerCase().includes('built-in')) {
          document.getElementById('account-builtin-note').style.display = 'block';
        }
        alert(data.detail || 'Could not update password.');
      }
    } catch (err) {
      console.error('changePassword error:', err);
    } finally {
      btn.disabled = false; btn.textContent = 'Update Password';
    }
  }
