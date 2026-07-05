require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { pool, ensureSchema } = require('./db');
const { redisClient, connectRedis } = require('./redisClient');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint - checks DB and Redis connectivity too
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      postgres: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    await pool.query('SELECT 1');
    health.services.postgres = 'up';
  } catch (err) {
    health.services.postgres = 'down';
    health.status = 'degraded';
  }

  try {
    await redisClient.ping();
    health.services.redis = 'up';
  } catch (err) {
    health.services.redis = 'down';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.use('/api/todos', todosRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function start() {
  try {
    await ensureSchema();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
