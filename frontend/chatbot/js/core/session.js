/** Session storage is optional: privacy settings must not prevent chatting. */
export function createSession(key) {
  const fresh = () => ({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, history: [], context: [], summary: '' });
  let state;
  try { state = JSON.parse(sessionStorage.getItem(key)); } catch { /* use memory */ }
  if (!state || typeof state.id !== 'string' || !Array.isArray(state.history)) state = fresh();
  state.history = state.history.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-40);
  state.context = (Array.isArray(state.context) ? state.context : state.history).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-10);
  if (typeof state.summary !== 'string') state.summary = '';
  function save() {
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* use memory */ }
  }
  save();
  return {
    get state() { return state; },
    save,
    reset() { state = fresh(); save(); },
  };
}
