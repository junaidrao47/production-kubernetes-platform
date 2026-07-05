const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  list: () => request('/api/todos'),
  create: (title) =>
    request('/api/todos', { method: 'POST', body: JSON.stringify({ title }) }),
  update: (id, changes) =>
    request(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(changes) }),
  remove: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),
};
