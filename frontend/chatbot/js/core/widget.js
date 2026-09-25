import { createApi } from './api.js';
import { createSession } from './session.js';
import { createView } from '../ui/view.js';

export async function mount(config) {
  const host = document.createElement('div'); host.id = 'olinda-widget-root';
  const shadow = host.attachShadow({ mode: 'open' });
  const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../../ui/widget.css', import.meta.url).href;
  const loaded = new Promise((resolve, reject) => { stylesheet.onload = resolve; stylesheet.onerror = () => reject(new Error('Widget stylesheet could not load')); });
  shadow.append(stylesheet); document.body.append(host);
  try { await loaded; } catch (error) { host.remove(); throw error; }
  const api = createApi(config.backend);
  const session = createSession(`olinda:${config.backend}:${config.college}`);
  const view = createView(shadow, config);
  let pending = null;
  let generation = 0;
  let destroyed = false;
  async function vote(message, rating) {
    await api('/feedback', { session_id: session.state.id, message_id: message.message_id, rating });
    message.rating = rating; session.save();
  }
  function restore() {
    view.resetScroll();
    view.find('.messages').replaceChildren();
    if (!session.state.history.length) view.welcome(send);
    else session.state.history.forEach(message => view.message(message, vote, { restoring: true }));
  }
  async function send(text) {
    const query = text.trim();
    if (!query || query.length > 4000 || pending || destroyed) return;
    const requestGeneration = generation;
    const controller = new AbortController(); pending = controller;
    view.find('.welcome')?.remove();
    const user = { role: 'user', content: query };
    session.state.history.push(user); session.state.context.push(user); session.save();
    view.message(user, vote); view.find('input').value = ''; view.busy(true);
    try {
      const data = await api('/chat', {
        query, session_id: session.state.id,
        messages: session.state.context.slice(-10).map(({ role, content }) => ({ role, content })),
        conversation_summary: session.state.summary,
      }, controller.signal);
      if (requestGeneration !== generation || destroyed) return;
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Empty reply');
      const reply = { role: 'assistant', content: data.reply, action_links: data.action_links, message_id: data.message_id };
      view.busy(false);
      view.message(reply, vote); session.state.history.push(reply); session.state.context.push(reply);
      session.state.history = session.state.history.slice(-40);
      if (data.conversation_summary) {
        session.state.summary = data.conversation_summary;
        session.state.context = session.state.context.slice(-4);
      } else session.state.context = session.state.context.slice(-10);
      session.save();
    } catch (error) {
      if (requestGeneration !== generation || destroyed) return;
      view.busy(false);
      view.message({ role: 'assistant', content: error.name === 'AbortError' ? 'This is taking longer than usual. Please try again in a moment.' : 'I couldn\u2019t connect just now. Please try again or contact Student Services.' }, vote);
    } finally {
      if (requestGeneration === generation && !destroyed) { pending = null; view.busy(false); }
    }
  }
  function reset() {
    generation++; pending?.abort(); pending = null;
    session.reset(); view.busy(false); view.find('input').value = ''; restore(); view.find('input').focus({ preventScroll: true });
  }
  view.find('.launcher').addEventListener('click', () => view.open(true));
  view.find('.close').addEventListener('click', () => view.open(false));
  view.find('.reset').addEventListener('click', reset);
  view.find('form').addEventListener('submit', event => { event.preventDefault(); send(view.find('input').value); });
  const onEscape = event => { if (event.key === 'Escape' && !view.find('.panel').hidden) view.open(false); };
  document.addEventListener('keydown', onEscape);
  restore();
  api('/health').then(() => { view.find('.status').textContent = 'Here to help'; }).catch(() => { view.find('.status').textContent = 'Connection unavailable'; });
  const controls = { open: () => view.open(true), close: () => view.open(false), reset, destroy() { destroyed = true; generation++; pending?.abort(); document.removeEventListener('keydown', onEscape); host.remove(); delete window.OlindaWidget; delete window.OlindaWidgetInitialized; } };
  if (config.autoOpen) controls.open();
  return controls;
}
