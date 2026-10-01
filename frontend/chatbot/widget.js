/** Public entry point. Works in plain HTML, React, Angular and other hosts. */
(function () {
  if (window.OlindaWidgetInitialized) return;
  const script = document.currentScript;
  if (!script?.src) return;
  window.OlindaWidgetInitialized = true;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const config = {
    backend: (script.dataset.backend || (local ? 'http://localhost:8000' : 'https://olinda-ai-backend-chatbot.onrender.com')).replace(/\/+$/, ''),
    name: script.dataset.name || 'Olinda',
    college: script.dataset.college || 'Hobart College',
    autoOpen: script.dataset.autoOpen === 'true',
    privacyUrl: script.dataset.privacyUrl || '',
  };
  const backendUrl = new URL(config.backend, location.href);
  if (backendUrl.protocol !== 'https:' && !(local && ['localhost', '127.0.0.1'].includes(backendUrl.hostname))) {
    throw new Error('Olinda backend must use HTTPS');
  }
  const entry = new URL('./js/core/widget.js', script.src).href;
  async function start() {
    try {
      const { mount } = await import(entry);
      window.OlindaWidget = await mount(config);
      window.dispatchEvent(new CustomEvent('olinda:ready'));
    } catch (error) {
      delete window.OlindaWidgetInitialized;
      console.error('[Olinda] Could not load the widget', error);
      window.dispatchEvent(new CustomEvent('olinda:error', { detail: error.message }));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
