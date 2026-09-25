/** Small, HTML-safe Markdown renderer for assistant messages. */
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function inline(text, depth = 0) {
  if (depth > 4) return escapeHtml(text);
  const token = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^\n]+?)\*\*|__([^\n]+?)__|\*([^*\n]+)\*/g;
  let html = '', offset = 0;
  for (const match of text.matchAll(token)) {
    html += escapeHtml(text.slice(offset, match.index));
    if (match[1] !== undefined) html += `<code>${escapeHtml(match[1])}</code>`;
    else if (match[2] !== undefined) {
      let url;
      try { url = new URL(match[3]); } catch { /* leave unsupported links as text */ }
      html += url && ['https:', 'http:'].includes(url.protocol)
        ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[2])}</a>`
        : escapeHtml(match[0]);
    } else if (match[4] !== undefined || match[5] !== undefined) {
      html += `<strong>${inline(match[4] ?? match[5], depth + 1)}</strong>`;
    } else html += `<em>${inline(match[6], depth + 1)}</em>`;
    offset = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(offset));
}

const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
const separator = line => cells(line).every(cell => /^:?-{3,}:?$/.test(cell));
const heading = line => /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
const listItem = line => /^\s*(?:([-+*\u2022])\s+|(\d+)[.)]\s+)(.+)$/.exec(line);

export function parseMarkdown(markdown) {
  if (!markdown) return '';
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  const isTable = index => index + 1 < lines.length && lines[index].includes('|') && separator(lines[index + 1]);
  const startsBlock = index => !lines[index].trim() || heading(lines[index]) || listItem(lines[index]) || /^\s*```/.test(lines[index]) || isTable(index);
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); continue;
    }
    const title = heading(line);
    if (title) {
      const level = title[1].length;
      output.push(`<h${level}>${inline(title[2])}</h${level}>`); i++; continue;
    }
    if (isTable(i)) {
      const headers = cells(line); i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const row = cells(lines[i++]);
        rows.push(`<tr>${headers.map((_, n) => `<td>${inline(row[n] || '')}</td>`).join('')}</tr>`);
      }
      output.push(`<div class="olinda-table-wrapper"><table><thead><tr>${headers.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`); continue;
    }
    const first = listItem(line);
    if (first) {
      const ordered = first[2] !== undefined;
      const tag = ordered ? 'ol' : 'ul';
      const start = ordered && Number(first[2]) > 1 ? ` start="${Number(first[2])}"` : '';
      const items = [];
      while (i < lines.length) {
        const item = listItem(lines[i]);
        if (!item || (item[2] !== undefined) !== ordered) break;
        const content = [item[3]]; i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !startsBlock(i)) content.push(lines[i++].trim());
        items.push(`<li>${inline(content.join(' '))}</li>`);
      }
      output.push(`<${tag}${start}>${items.join('')}</${tag}>`); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && !startsBlock(i)) paragraph.push(lines[i++]);
    output.push(`<p>${paragraph.map(text => inline(text)).join('<br>')}</p>`);
  }
  return output.join('\n');
}
