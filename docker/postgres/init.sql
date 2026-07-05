CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- a couple of sample rows so the UI isn't empty on first run
INSERT INTO todos (title, completed) VALUES
  ('Learn Docker Compose', false),
  ('Set up Redis caching', true)
ON CONFLICT DO NOTHING;
