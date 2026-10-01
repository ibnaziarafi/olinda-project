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

const sessionSource = await fs.readFile(new URL('../frontend/chatbot/js/core/session.js', import.meta.url), 'utf8');
const { createSession } = await import(`data:text/javascript;base64,${Buffer.from(sessionSource).toString('base64')}`);
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
const stored = new Map();
try {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  } });
  const first = createSession('test-chat');
  first.state.history.push({ role: 'user', content: 'Which courses are available?' });
  first.state.context.push({ role: 'user', content: 'Which courses are available?' });
  first.state.summary = 'Discussing college courses';
  first.save();
  const refreshed = createSession('test-chat');
  assert.equal(refreshed.state.id, first.state.id);
  assert.deepEqual(refreshed.state.history, first.state.history);
  assert.deepEqual(refreshed.state.context, first.state.context);
  assert.equal(refreshed.state.summary, first.state.summary);
  refreshed.reset();
  assert.notEqual(refreshed.state.id, first.state.id);
  assert.deepEqual(createSession('test-chat').state.history, []);
  stored.set('broken-chat', '{invalid JSON');
  assert.deepEqual(createSession('broken-chat').state.history, []);
  stored.set('invalid-chat', JSON.stringify({ id: 'valid-id', history: 'invalid' }));
  assert.deepEqual(createSession('invalid-chat').state.history, []);
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  const blocked = createSession('blocked-chat');
  blocked.state.history.push({ role: 'user', content: 'Courses?' });
  assert.doesNotThrow(() => blocked.save());
  assert.equal(blocked.state.history.length, 1);
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
  else delete globalThis.sessionStorage;
}
console.log('Frontend session checks passed: refresh restores chat, reset clears it, corrupt/blocked storage is tolerated.');
