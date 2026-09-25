/** Network boundary shared by chat, health and feedback. */
export function createApi(base) {
  return async function request(path, body, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 45000);
    try {
      const response = await fetch(`${base}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'omit', signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return await response.json();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}
