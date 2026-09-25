  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  export function parseMarkdown(md) {
    if (!md) return "";

    let html = escapeHtml(md);

    // Process Markdown Tables
    const lines = html.split("\n");
    let processed = [];
    let inTable = false;
    let tableHtml = [];

    function isTableRow(l) {
      const s = l.trim();
      return s.startsWith("|") || (s.includes("|") && s.split("|").length >= 3 && !s.startsWith("http"));
    }

    function isSeparator(l) {
      const s = l.trim();
      return /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/.test(s);
    }

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();

      if (isTableRow(rawLine)) {
        if (isSeparator(rawLine)) {
          continue;
        }

        // Extract cells
        const cells = rawLine.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
        if (!cells || cells.length === 0 || cells.every(c => c === "")) {
          continue;
        }

        if (!inTable) {
          inTable = true;
          tableHtml = ['<div class="olinda-table-wrapper"><table class="olinda-table"><thead><tr>'];
          cells.forEach(cell => { tableHtml.push(`<th>${cell}</th>`); });
          tableHtml.push('</tr></thead><tbody>');
        } else {
          tableHtml.push('<tr>');
          cells.forEach(cell => { tableHtml.push(`<td>${cell}</td>`); });
          tableHtml.push('</tr>');
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHtml.push('</tbody></table></div>');
          processed.push(tableHtml.join(""));
          tableHtml = [];
        }
        processed.push(lines[i]);
      }
    }

    if (inTable) {
      tableHtml.push('</tbody></table></div>');
      processed.push(tableHtml.join(""));
    }

    html = processed.join("\n");

    // Format Bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Format Italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Format Markdown Links ([title](url))
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Format Bullet Lists (- item, • item, or * item)
    html = html.replace(/^(?:[\-\•\*]\s+)(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul class="olinda-list">$1</ul>');

    // Convert line breaks while leaving table wrappers clean
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }


