import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [health, setHealth] = useState('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTodos = useCallback(async () => {
    try {
      const { data } = await api.list();
      setTodos(data);
      setError('');
    } catch (err) {
      setError('Could not load todos. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const data = await api.health();
      setHealth(data.status === 'ok' ? 'up' : 'degraded');
    } catch {
      setHealth('down');
    }
  }, []);

  useEffect(() => {
    loadTodos();
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [loadTodos, checkHealth]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    try {
      await api.create(trimmed);
      await loadTodos();
    } catch {
      setError('Could not add todo.');
    }
  }

  async function handleToggle(todo) {
    try {
      await api.update(todo.id, { completed: !todo.completed });
      await loadTodos();
    } catch {
      setError('Could not update todo.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.remove(id);
      await loadTodos();
    } catch {
      setError('Could not delete todo.');
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Todos</h1>
        <span className={`badge badge-${health}`}>{healthLabel(health)}</span>
      </header>

      <form className="todo-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
        />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading...</p>
      ) : todos.length === 0 ? (
        <p className="empty">No todos yet. Add one above.</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.completed ? 'completed' : ''}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggle(todo)}
              />
              <span className="title">{todo.title}</span>
              <button className="delete" onClick={() => handleDelete(todo.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function healthLabel(status) {
  if (status === 'up') return 'backend healthy';
  if (status === 'degraded') return 'backend degraded';
  if (status === 'down') return 'backend unreachable';
  return 'checking...';
}
