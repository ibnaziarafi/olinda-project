/** Session storage is optional: privacy settings must not prevent chatting. */
export function createSession(key) {
  const fresh = () => ({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, history: [], context: [], summary: '' });
  let state;
  // Chat text stays in memory. Remove legacy tab storage on first use.
  try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
  state = fresh();
  state.history = state.history.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-40);
  state.context = (Array.isArray(state.context) ? state.context : state.history).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-10);
  if (typeof state.summary !== 'string') state.summary = '';
  function save() {
    // Intentionally no persistent browser storage of conversation text.
  }
  save();
  return {
    get state() { return state; },
    save,
    reset() { state = fresh(); save(); },
  };
}
