const express = require('express');
const { pool } = require('../db');
const { redisClient } = require('../redisClient');

const router = express.Router();

const CACHE_KEY = 'todos:all';
const CACHE_TTL_SECONDS = 30;
const WORKER_QUEUE = 'todo_events';

async function invalidateCache() {
  await redisClient.del(CACHE_KEY);
}

// GET /api/todos - list all (cached in Redis)
router.get('/', async (req, res) => {
  try {
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) {
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }

    const result = await pool.query('SELECT * FROM todos ORDER BY id DESC');
    await redisClient.setEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(result.rows));

    res.json({ source: 'db', data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// GET /api/todos/:id - single todo
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM todos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// POST /api/todos - create
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      'INSERT INTO todos (title) VALUES ($1) RETURNING *',
      [title.trim()]
    );

    await invalidateCache();

    // push event for worker to process (e.g. notification, logging, etc.)
    await redisClient.lPush(
      WORKER_QUEUE,
      JSON.stringify({ type: 'TODO_CREATED', todo: result.rows[0], at: new Date().toISOString() })
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// PUT /api/todos/:id - update (title and/or completed)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    const existing = await pool.query('SELECT * FROM todos WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const updated = {
      title: title !== undefined ? title : existing.rows[0].title,
      completed: completed !== undefined ? completed : existing.rows[0].completed,
    };

    const result = await pool.query(
      'UPDATE todos SET title = $1, completed = $2 WHERE id = $3 RETURNING *',
      [updated.title, updated.completed, id]
    );

    await invalidateCache();

    await redisClient.lPush(
      WORKER_QUEUE,
      JSON.stringify({ type: 'TODO_UPDATED', todo: result.rows[0], at: new Date().toISOString() })
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    await invalidateCache();

    await redisClient.lPush(
      WORKER_QUEUE,
      JSON.stringify({ type: 'TODO_DELETED', todo: result.rows[0], at: new Date().toISOString() })
    );

    res.json({ message: 'Todo deleted', todo: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

module.exports = router;
