async function loadChunks() {
    try {
      const res = await authFetch(`${API_BASE}/api/chunks`);
      let data = await res.json();
      if (!Array.isArray(data)) data = data ? [data] : [];
      const tbody = document.getElementById('chunks-table-body');
      tbody.innerHTML = '';

      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--ink-soft);">No knowledge chunks in database yet. Upload a document above!</td></tr>';
        return;
      }

      data.forEach(chunk => {
        const tr = document.createElement('tr');
        const dateStr = chunk.created_at ? new Date(chunk.created_at).toLocaleDateString() : 'N/A';
        const addedBy = chunk.added_by
          ? `<strong style="color:var(--blue-700);">${escapeHtml(chunk.added_by)}</strong>`
          : '<span style="color:var(--ink-soft);">—</span>';
        tr.innerHTML = `
          <td style="max-width:340px; font-size:0.85rem;">${escapeHtml(chunk.content.substring(0, 160))}...</td>
          <td><span class="tag tag-info">${escapeHtml(chunk.doc_type || 'general')}</span></td>
          <td>${escapeHtml(chunk.source_file || 'unknown')}</td>
          <td style="font-size:0.82rem;">${addedBy}</td>
          <td>${dateStr}</td>
          <td>
            <button class="btn btn-danger" style="padding:4px 10px; font-size:0.78rem;" onclick="deleteChunk('${chunk.chunk_id}')">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Chunks load error:', e);
    }
  }

  async function deleteChunk(chunkId) {
    if (!confirm('Are you sure you want to delete this knowledge chunk?')) return;
    try {
      const res = await authFetch(`${API_BASE}/api/chunks/${chunkId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Knowledge chunk deleted');
        loadChunks();
        loadAnalytics();
      }
    } catch (e) {
      console.error('Delete chunk error:', e);
    }
  }

  function updateFileNameDisplay() {
    const input = document.getElementById('file-input');
    const display = document.getElementById('file-selected-name');
    if (input.files.length > 0) {
      display.textContent = `Selected: ${input.files[0].name}`;
      display.style.fontWeight = '600';
      display.style.color = 'var(--blue-700)';
    }
  }

  async function handleFileUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const docTypeSelect = document.getElementById('doc-type-select');
    const uploadBtn = document.getElementById('upload-btn');

    if (!fileInput.files.length) {
      alert('Please select a PDF or Excel/CSV file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('doc_type', docTypeSelect.value);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Processing & Embedding...';

    try {
      const res = await authFetch(`${API_BASE}/api/upload-file`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Ingested ${data.chunks_added} chunks from ${data.filename} (added by ${data.added_by || getStaffName()})`);
        fileInput.value = '';
        document.getElementById('file-selected-name').textContent = 'Supports .pdf, .xlsx, .xls, .csv';
        loadChunks();
        loadAnalytics();
      } else {
        alert(`Error: ${data.detail || 'File processing failed'}`);
      }
    } catch (e) {
      console.error('Upload error:', e);
      alert('Upload failed.');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload & Ingest Document';
    }
  }

  async function handleTextIngest(e) {
    e.preventDefault();
    const textarea = document.getElementById('manual-text');
    const text = textarea.value.trim();
    if (!text) return;

    try {
      const res = await authFetch(`${API_BASE}/api/ingest-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, doc_type: 'faq' })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(`Added to Knowledge Base by ${data.added_by || getStaffName()}!`);
        textarea.value = '';
        loadChunks();
        loadAnalytics();
      }
    } catch (e) {
      console.error('Text ingest error:', e);
    }
  }
