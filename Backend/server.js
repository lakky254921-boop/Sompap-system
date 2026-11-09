const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'helpdesk',
  port: process.env.DB_PORT || 5432,
});

// Health Checks สำหรับ Kubernetes
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).send('Ready');
  } catch (err) {
    res.status(500).send('DB Not Ready');
  }
});

// API Endpoints (3 Actions)
app.post('/api/tickets', async (req, res) => {
  const { title, category, description, priority } = req.body;
  const result = await pool.query(
    'INSERT INTO tickets (title, category, description, priority) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, category, description, priority]
  );
  res.status(201).json(result.rows[0]);
});

app.get('/api/tickets', async (req, res) => {
  const result = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
  res.json(result.rows);
});

app.patch('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const result = await pool.query(
    'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  res.json(result.rows[0]);
});

app.listen(3000, () => console.log('Backend running on port 3000'));