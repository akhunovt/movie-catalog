import express from 'express';

const app = express();
const API_KEY = process.env.OMDB_API_KEY;
const PORT = Number(process.env.PORT || 3001);
if (!API_KEY) throw new Error('OMDB_API_KEY is required');

function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

async function omdb(params) {
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', API_KEY);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    const err = new Error('Сервис OMDb временно недоступен');
    err.status = 502;
    throw err;
  }
  const data = await response.json();
  if (data.Response === 'False') {
    const err = new Error(data.Error || 'Фильмы не найдены');
    err.status = /not found/i.test(data.Error || '') ? 404 : 400;
    throw err;
  }
  return data;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'omdb-proxy' }));
app.get('/movies/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Number(req.query.page || 1);
  const year = String(req.query.year || '').trim();
  if (q.length < 2 || q.length > 100) return res.status(400).json({ error: 'Введите название от 2 до 100 символов' });
  if (!Number.isInteger(page) || page < 1 || page > 100) return res.status(400).json({ error: 'Некорректная страница' });
  if (year && !/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Год должен содержать четыре цифры' });
  try {
    const result = await omdb({ s: q, page, ...(year ? { y: year } : {}) });
    res.json({ movies: result.Search || [], total: Number(result.totalResults || 0), page });
  } catch (err) {
    if (err.status === 404) return res.json({ movies: [], total: 0, page });
    throw err;
  }
}));
app.get('/movies/:imdbId', wrap(async (req, res) => {
  if (!/^tt\d{5,12}$/.test(req.params.imdbId)) return res.status(400).json({ error: 'Некорректный IMDb ID' });
  res.json(await omdb({ i: req.params.imdbId, plot: 'full' }));
}));
app.use((err, _req, res, _next) => {
  console.error('OMDb proxy error:', err.message);
  res.status(err.status || 502).json({ error: err.name === 'TimeoutError' ? 'Время ожидания OMDb истекло' : (err.status ? err.message : 'Не удалось связаться с OMDb') });
});
app.listen(PORT, '0.0.0.0', () => console.log(`OMDb proxy on ${PORT}`));
