import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../frontend/chatbot/js/core/markdown.js', import.meta.url), 'utf8');
const { parseMarkdown } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const payload of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '[click](javascript:alert(1))',
  '**<svg onload=alert(1)>**', '```\n<script>alert(1)</script>\n```']) {
  const html = parseMarkdown(payload);
  assert(!/<(?:img|script|svg)|href=|onerror=|onload=/i.test(html.replace(/&lt;[^;]*?&gt;/g, '')),
    `Unsafe rendered HTML: ${html}`);
}
const boot = await fs.readFile(new URL('../frontend/dashboard/scripts/core/boot.js', import.meta.url), 'utf8');
const escapeCode = boot.slice(0, boot.indexOf('  const submitHandlers'));
const context = vm.createContext({}); vm.runInContext(escapeCode, context);
assert.equal(context.escapeHtml(`"'><img src=x>`), '&quot;&#39;&gt;&lt;img src=x&gt;');
for (const file of ['dashboard.html', 'scripts/features/staff.js', 'scripts/features/analytics.js', 'scripts/features/knowledge.js']) {
  const content = await fs.readFile(new URL(`../frontend/dashboard/${file}`, import.meta.url), 'utf8');
  assert(!/on(?:click|submit|change)=/.test(content), `Inline handler in ${file}`);
}
console.log('Frontend security checks passed: escaped Markdown, attribute escaping, no inline event handlers.');

const apiSource = await fs.readFile(new URL('../frontend/chatbot/js/core/api.js', import.meta.url), 'utf8');
const { createApi } = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(createApi('https://example.invalid')('/chat', { query: 'Courses?' }), error => error.status === 429);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Frontend usage-limit check passed: HTTP 429 is preserved for the user-facing message.');
