import express from 'express';
import pg from 'pg';

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const MOVIE_SERVICE_URL = process.env.MOVIE_SERVICE_URL || 'http://web-service:3001';
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '32kb' }));

const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const isImdb = value => /^tt\d{5,12}$/.test(value || '');
const isId = value => /^[1-9]\d*$/.test(value || '');
const columns = 'id, imdb_id, title, year, poster, is_favorite, is_watched, user_rating, created_at, updated_at';

async function proxy(req, res, endpoint) {
  const url = new URL(endpoint, MOVIE_SERVICE_URL);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const json = await response.json();
  res.status(response.status).json(json);
}

app.get('/health', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'backend' });
}));
app.get('/api/search', wrap(async (req, res) => {
  const params = new URLSearchParams();
  for (const k of ['q', 'page', 'year']) if (typeof req.query[k] === 'string') params.set(k, req.query[k]);
  await proxy(req, res, `/movies/search?${params}`);
}));
app.get('/api/details/:imdbId', wrap(async (req, res) => {
  if (!isImdb(req.params.imdbId)) return res.status(400).json({ error: 'Некорректный IMDb ID' });
  await proxy(req, res, `/movies/${req.params.imdbId}`);
}));
app.get('/api/movies', wrap(async (req, res) => {
  const filter = String(req.query.filter || 'all');
  const filters = { all: 'TRUE', favorite: 'is_favorite = TRUE', watched: 'is_watched = TRUE' };
  if (!(filter in filters)) return res.status(400).json({ error: 'Неизвестный фильтр' });
  const { rows } = await pool.query(`SELECT ${columns} FROM movies WHERE ${filters[filter]} ORDER BY created_at DESC`);
  res.json(rows);
}));
app.get('/api/stats', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT count(*)::integer AS total, count(*) FILTER (WHERE is_favorite)::integer AS favorites, count(*) FILTER (WHERE is_watched)::integer AS watched FROM movies');
  res.json(rows[0]);
}));
app.post('/api/movies', wrap(async (req, res) => {
  const { imdb_id, title, year = null, poster = null, is_favorite = true, is_watched = false } = req.body || {};
  if (!isImdb(imdb_id) || typeof title !== 'string' || !title.trim() || title.length > 255 ||
      (year !== null && (typeof year !== 'string' || year.length > 20)) ||
      (poster !== null && (typeof poster !== 'string' || poster.length > 2048)) ||
      typeof is_favorite !== 'boolean' || typeof is_watched !== 'boolean') {
    return res.status(400).json({ error: 'Некорректные данные фильма' });
  }
  const { rows } = await pool.query(
    `INSERT INTO movies (imdb_id, title, year, poster, is_favorite, is_watched)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (imdb_id) DO UPDATE SET
       is_favorite = movies.is_favorite OR EXCLUDED.is_favorite,
       is_watched = movies.is_watched OR EXCLUDED.is_watched,
       updated_at = NOW()
     RETURNING ${columns}`,
    [imdb_id, title.trim(), year, poster, is_favorite, is_watched]
  );
  res.status(201).json(rows[0]);
}));
app.patch('/api/movies/:id', wrap(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Некорректный ID' });
  const allowed = ['is_favorite', 'is_watched', 'user_rating'];
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length ||
      Object.keys(body).some(k => !allowed.includes(k)) ||
      (body.is_favorite !== undefined && typeof body.is_favorite !== 'boolean') ||
      (body.is_watched !== undefined && typeof body.is_watched !== 'boolean') ||
      (body.user_rating !== undefined && body.user_rating !== null && (!Number.isInteger(body.user_rating) || body.user_rating < 1 || body.user_rating > 10))) {
    return res.status(400).json({ error: 'Разрешены только флаги и оценка от 1 до 10' });
  }
  const keys = Object.keys(body);
  const assignments = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE movies SET ${assignments}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING ${columns}`,
    [...keys.map(k => body[k]), req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Фильм не найден' });
  res.json(rows[0]);
}));
app.delete('/api/movies/:id', wrap(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Некорректный ID' });
  const { rowCount } = await pool.query('DELETE FROM movies WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Фильм не найден' });
  res.status(204).end();
}));
app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
app.use((err, _req, res, _next) => {
  console.error('Backend error:', err.message);
  res.status(503).json({ error: 'Сервис временно недоступен. Повторите попытку.' });
});
app.listen(PORT, '0.0.0.0', () => console.log(`Backend on ${PORT}`));
