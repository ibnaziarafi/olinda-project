/** Session storage is optional: privacy settings must not prevent chatting. */
export function createSession(key) {
  const fresh = () => ({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, history: [], context: [], summary: '' });
  let state = fresh();
  // Tab-scoped storage survives refresh without sharing chats across websites.
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && typeof saved.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(saved.id)) {
      state = {
        id: saved.id,
        history: Array.isArray(saved.history) ? saved.history : [],
        context: Array.isArray(saved.context) ? saved.context : saved.history,
        summary: typeof saved.summary === 'string' ? saved.summary.slice(0, 4000) : '',
      };
    }
  } catch { /* corrupted or unavailable storage: start a fresh in-memory chat */ }
  const validMessage = m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 4000;
  state.history = state.history.filter(validMessage).slice(-40);
  state.context = (Array.isArray(state.context) ? state.context : state.history).filter(validMessage).slice(-10);
  function save() {
    state.history = state.history.slice(-40);
    state.context = state.context.slice(-10);
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* chatting still works if storage is blocked/full */ }
  }
  save();
  return {
    get state() { return state; },
    save,
    reset() { state = fresh(); save(); },
  };
}
