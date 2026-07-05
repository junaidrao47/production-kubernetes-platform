const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'todo_db',
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error', err);
});

// Ensure table exists (in case init.sql wasn't run, e.g. local dev)
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, ensureSchema, closePool };
