async function loadAnalytics() {
    try {
      const res = await authFetch(`${API_BASE}/api/analytics`);
      const data = await res.json();
      document.getElementById('stat-messages').textContent = data.total_messages;
      document.getElementById('stat-unanswered').textContent = data.unanswered_count;
      document.getElementById('stat-escalations').textContent = data.escalated_count;
      document.getElementById('stat-chunks').textContent = data.knowledge_chunks;
      document.getElementById('badge-unanswered').textContent = data.unanswered_count;
    } catch (e) {
      console.error('Analytics load error:', e);
    }
  }

  async function loadUnanswered() {
    try {
      const res = await authFetch(`${API_BASE}/api/unanswered`);
      let data = await res.json();
      if (!Array.isArray(data)) data = data ? [data] : [];
      const tbody = document.getElementById('unanswered-table-body');
      tbody.innerHTML = '';

      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--ink-soft);">No unanswered questions logged!</td></tr>';
        return;
      }

      data.forEach(item => {
        const tr = document.createElement('tr');
        const dateStr = new Date(item.occurred_at).toLocaleString();
        const isReviewed = item.reviewed === 1 || item.reviewed === true;

        tr.innerHTML = `
          <td>${dateStr}</td>
          <td style="font-weight:600;">${escapeHtml(item.question)}</td>
          <td>${(item.confidence_score * 100).toFixed(1)}%</td>
          <td>
            <span class="tag ${isReviewed ? 'tag-success' : 'tag-warning'}">
              ${isReviewed ? 'Resolved' : 'Needs Answer'}
            </span>
          </td>
          <td>
            ${isReviewed ? `<span style="color: var(--ink-soft); font-size:0.85rem;">Answer added to Knowledge Base</span>
                ${item.resolved_by ? `<div class="attribution">Answered by <strong>${escapeHtml(item.resolved_by)}</strong></div>` : ''}` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                <textarea id="answer-${item.id}" rows="2" placeholder="Type official answer..." style="margin-bottom:0; font-size:0.85rem;"></textarea>
                <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="resolveQuestion('${item.id}')">Save & Update Knowledge Base</button>
              </div>
            `}
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Unanswered load error:', e);
    }
  }

  async function resolveQuestion(id) {
    const textarea = document.getElementById(`answer-${id}`);
    const answer = textarea.value.trim();
    if (!answer) {
      alert('Please type an answer before submitting.');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/unanswered/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, answer })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(`Answered by ${data.resolved_by || getStaffName()} — knowledge chunk embedded!`);
        loadUnanswered();
        loadAnalytics();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || 'Failed to resolve question.');
      }
    } catch (e) {
      console.error('Resolve error:', e);
    }
  }
