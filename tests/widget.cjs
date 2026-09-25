// Run with Playwright installed. Test servers and all model responses are local.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend');
const requests = [];
let failVote = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.url === '/health') { res.setHeader('Content-Type', 'application/json'); res.end('{"status":"ok"}'); return; }
  if (req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body); requests.push({ path: req.url, ...data });
    if (req.url === '/feedback') {
      res.statusCode = failVote ? 500 : 200;
      res.end(JSON.stringify({ status: 'saved' })); return;
    }
    if (data.query === 'slow question') await new Promise(resolve => setTimeout(resolve, 500));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ reply: '**Choose your pathway.**\nExplore courses with a college advisor.', message_id: `answer-${requests.length}`, action_links: [{ title: 'Unsafe link', url: 'javascript:alert(1)' }, { title: 'Course guide', url: 'https://example.edu/course' }], conversation_summary: 'Prior context' })); return;
  }
  if (req.url === '/host') {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>College integration test</title><style>body{background:#e9eef2;padding:50px;font-family:system-ui}button{background:red!important;font-size:50px!important}header{display:none!important}</style><script defer src="http://localhost:5511/chatbot/widget.js" data-backend="http://localhost:5511"></script></head><body><h1>A college website</h1><p>The assistant works independently of this page’s styles.</p></body></html>`); return;
  }
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});
async function main() {
  await new Promise(resolve => server.listen(5511, '0.0.0.0', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // 127.0.0.1 host and localhost assets exercise actual cross-origin module loading.
    await page.goto('http://127.0.0.1:5511/host');
    await page.getByRole('button', { name: 'Open Olinda chat assistant' }).click();
    await page.getByText('Big questions. A little guidance.').waitFor();
    assert.equal(await page.locator('#olinda-widget-root').count(), 1);
    assert.equal(await page.locator('#olinda-widget-root header').evaluate(el => getComputedStyle(el).display), 'flex');
    if (process.env.WIDGET_SCREENSHOT) await page.screenshot({ path: process.env.WIDGET_SCREENSHOT });
    await page.getByLabel('Your question').fill('Which course?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByRole('button', { name: 'Like this answer', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Unsafe link' }).count(), 0);
    await page.getByRole('button', { name: 'Like this answer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#olinda-widget-root').shadowRoot.querySelector('[aria-label="Like this answer"]').getAttribute('aria-pressed') === 'true');
    failVote = true;
    await page.getByRole('button', { name: 'Dislike this answer', exact: true }).click();
    await page.getByText('Could not save. Try again.').waitFor();
    failVote = false;
    await page.getByRole('button', { name: 'Dislike this answer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#olinda-widget-root').shadowRoot.querySelector('[aria-label="Dislike this answer"]').getAttribute('aria-pressed') === 'true');
    const firstSession = requests.find(r => r.path === '/chat').session_id;
    await page.reload(); await page.getByRole('button', { name: 'Open Olinda chat assistant' }).click();
    assert.equal(await page.getByRole('button', { name: 'Dislike this answer', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Your question').fill('slow question');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByRole('button', { name: 'Reset conversation' }).click();
    await page.getByText('Big questions. A little guidance.').waitFor();
    await page.waitForTimeout(650);
    assert.equal(await page.getByText('Choose your pathway.', { exact: false }).count(), 0);
    await page.getByLabel('Your question').fill('New question');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByRole('button', { name: 'Like this answer', exact: true }).waitFor();
    const newest = requests.filter(r => r.path === '/chat').at(-1);
    assert.notEqual(newest.session_id, firstSession);
    assert.equal(newest.conversation_summary, '');
    assert.equal(newest.messages.length, 1);
    await page.addScriptTag({ url: 'http://localhost:5511/chatbot/widget.js' });
    assert.equal(await page.locator('#olinda-widget-root').count(), 1);
    await page.setViewportSize({ width: 375, height: 667 });
    const panel = await page.getByRole('dialog').boundingBox();
    assert(panel.x >= 0 && panel.x + panel.width <= 375 && panel.y >= 0 && panel.y + panel.height <= 667);
    if (process.env.WIDGET_SCREENSHOT) await page.screenshot({ path: process.env.WIDGET_SCREENSHOT.replace('.png', '-mobile.png') });
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.evaluate(() => window.OlindaWidget.destroy());
    assert.equal(await page.locator('#olinda-widget-root').count(), 0);
    // A blocked storage API must still allow startup and reset.
    await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Blocked'); } }));
    await page.reload(); await page.getByRole('button', { name: 'Open Olinda chat assistant' }).click();
    await page.getByRole('button', { name: 'Reset conversation' }).click();
    await page.getByText('Big questions. A little guidance.').waitFor();
    assert.deepEqual(errors, []);
    const dashboard = await browser.newPage();
    const dashboardErrors = []; dashboard.on('pageerror', error => dashboardErrors.push(error.message));
    await dashboard.route('http://localhost:8001/**', route => {
      const url = route.request().url();
      const data = url.endsWith('/api/login') ? { token: 'fixture-token', name: 'Test Admin', role: 'admin' } :
        url.endsWith('/api/analytics') ? { total_messages: 12, unanswered_count: 2, escalated_count: 1, knowledge_chunks: 8 } : { status: 'ok' };
      return route.fulfill({ json: data });
    });
    await dashboard.goto('http://localhost:5511/dashboard/dashboard.html');
    await dashboard.locator('#login-username').fill('testadmin');
    await dashboard.locator('#login-password').fill('test-password');
    await dashboard.locator('#login-btn').click();
    await dashboard.waitForFunction(() => document.querySelector('#stat-messages').textContent === '12');
    assert(await dashboard.locator('#login-overlay').evaluate(el => el.classList.contains('hidden')));
    assert.deepEqual(dashboardErrors, []);
    console.log('PASS: cross-origin embed, style isolation, chat, feedback/retry, persistence, reset race, duplicate load, mobile, Escape, teardown and blocked storage');
    console.log('PASS: separated dashboard scripts, login and analytics rendering');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
