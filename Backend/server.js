const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  // ไม่ใส่รหัสผ่านสำรองแล้ว: ถ้าลืมตั้ง Secret ระบบจะต่อ DB ไม่ได้ชัดเจน
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'helpdesk',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  connectionTimeoutMillis: 3000,
});

// กัน process crash เมื่อ connection ที่ว่างอยู่ถูกตัด
pool.on('error', (err) => console.error('Unexpected DB pool error:', err.message));

const CATEGORIES = ['Hardware', 'Network', 'Software'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Pending', 'In Progress', 'Resolved'];

// สร้างตารางอัตโนมัติ (retry เผื่อ DB pod ยังไม่พร้อม)
async function initDb(retries = 20, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tickets (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          description TEXT,
          priority VARCHAR(20) DEFAULT 'Medium',
          status VARCHAR(20) DEFAULT 'Pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      console.log('Database initialised');
      return;
    } catch (err) {
      console.error(`DB init failed (${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ครอบ async handler ให้ error ไปเข้า error middleware แทนที่จะ crash
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Health Checks สำหรับ Kubernetes
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).send('Ready');
  } catch (err) {
    res.status(503).send('DB Not Ready');
  }
});

// API Endpoints (3 Actions)
app.post('/api/tickets', wrap(async (req, res) => {
  const { title, category, description, priority } = req.body || {};

  if (typeof title !== 'string' || !title.trim() || title.length > 255) {
    return res.status(400).json({ error: 'title is required (max 255 characters)' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  const prio = priority || 'Medium';
  if (!PRIORITIES.includes(prio)) {
    return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(', ')}` });
  }

  const result = await pool.query(
    'INSERT INTO tickets (title, category, description, priority) VALUES ($1, $2, $3, $4) RETURNING *',
    [title.trim(), category, description || null, prio]
  );
  res.status(201).json(result.rows[0]);
}));

app.get('/api/tickets', wrap(async (req, res) => {
  const result = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC, id DESC');
  res.json(result.rows);
}));

app.patch('/api/tickets/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid ticket id' });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }

  const result = await pool.query(
    'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'ticket not found' });
  }
  res.json(result.rows[0]);
}));

// Error handler กลาง
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const server = app.listen(3000, () => {
  console.log('Backend running on port 3000');
  initDb();
});

// ปิดอย่างเรียบร้อยตอน K8s ส่ง SIGTERM
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));