import React, { useState, useEffect } from 'react';
import { Film, Search, Heart, CheckCircle2, Bookmark, Trash2, X, Star, ChevronLeft, ChevronRight, Clapperboard, CalendarDays, LoaderCircle, ArrowUpRight } from 'lucide-react';

async function api(path, options) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}
const poster = film => film?.poster || film?.Poster;
const movieTitle = film => film?.title || film?.Title;
const movieYear = film => film?.year || film?.Year;
const imdbId = film => film?.imdb_id || film?.imdbID;

function Poster({ film }) {
  const image = poster(film);
  return image && image !== 'N/A' ? <img src={image} loading="lazy" alt={`Постер: ${movieTitle(film)}`} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <div className="no-poster"><Film size={40}/><span>Нет постера</span></div>;
}

export default function App() {
  const [tab, setTab] = useState('discover');
  const [q, setQ] = useState('matrix');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [found, setFound] = useState([]);
  const [total, setTotal] = useState(0);
  const [collection, setCollection] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshCollection = async () => setCollection(await api('/api/movies'));
  useEffect(() => { refreshCollection().catch(e => setError(e.message)); }, []);

  async function searchMovies(nextPage = 1) {
    const name = q.trim();
    if (name.length < 2) { setError('Введите хотя бы два символа названия'); return; }
    setError(''); setLoading(true); setTab('discover');
    try {
      const params = new URLSearchParams({ q: name, page: nextPage });
      if (year.trim()) params.set('year', year.trim());
      const data = await api(`/api/search?${params}`);
      setFound(data.movies || []); setTotal(data.total || 0); setPage(nextPage);
    } catch (e) { setError(e.message); setFound([]); setTotal(0); }
    finally { setLoading(false); }
  }
  async function openDetails(film) {
    setDetailLoading(true); setError('');
    try { setDetail(await api(`/api/details/${imdbId(film)}`)); }
    catch (e) { setError(e.message); }
    finally { setDetailLoading(false); }
  }
  async function saveFilm(film, field = 'is_favorite') {
    const key = imdbId(film);
    const saved = collection.find(m => m.imdb_id === key);
    setBusy(key); setError('');
    try {
      if (saved) {
        await api(`/api/movies/${saved.id}`, { method: 'PATCH', body: JSON.stringify({ [field]: !saved[field] }) });
      } else {
        await api('/api/movies', { method: 'POST', body: JSON.stringify({
          imdb_id: key, title: movieTitle(film), year: movieYear(film) || null,
          poster: poster(film) === 'N/A' ? null : (poster(film) || null),
          is_favorite: field === 'is_favorite', is_watched: field === 'is_watched'
        }) });
      }
      await refreshCollection(); setNotice('Коллекция обновлена');
    } catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }
  async function removeFilm(film) {
    if (!window.confirm(`Удалить «${film.title}» из коллекции?`)) return;
    setBusy(film.imdb_id); setError('');
    try { await api(`/api/movies/${film.id}`, { method: 'DELETE' }); await refreshCollection(); setNotice('Фильм удалён'); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }
  async function rateFilm(film, rating) {
    setBusy(film.imdb_id);
    try { await api(`/api/movies/${film.id}`, { method: 'PATCH', body: JSON.stringify({ user_rating: rating || null }) }); await refreshCollection(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }

  const shown = tab === 'discover' ? found : collection.filter(m => tab === 'all' || (tab === 'favorites' ? m.is_favorite : m.is_watched));
  const favoritesCount = collection.filter(m => m.is_favorite).length;
  const watchedCount = collection.filter(m => m.is_watched).length;
  const savedDetail = detail && collection.find(m => m.imdb_id === detail.imdbID);
  const nav = [
    { id: 'discover', label: 'Поиск фильмов', icon: Search },
    { id: 'all', label: 'Моя коллекция', icon: Bookmark, count: collection.length },
    { id: 'favorites', label: 'Избранное', icon: Heart, count: favoritesCount },
    { id: 'watched', label: 'Просмотрено', icon: CheckCircle2, count: watchedCount },
  ];
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Clapperboard size={23}/></div><span>Cine<span className="brand-accent">Vault</span></span></div>
      <div className="nav-caption">МЕНЮ</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setError(''); }}><item.icon size={18}/><span>{item.label}</span>{item.count !== undefined && <span className="nav-count">{item.count}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><Film size={18}/><span>Твоя личная фильмотека<br/><small>На основе OMDb API</small></span></div>
    </aside>

    <main className="main">
      <header className="topbar"><span className="eyebrow">ТВОЙ КИНОМИР</span><span className="top-meta"><span className="online-dot"/> Movie collection</span></header>
      <div className="content">
        <section className="hero"><div className="hero-copy"><span className="hero-kicker"><Star size={13} fill="currentColor"/> СОЗДАВАЙ СВОЮ КОЛЛЕКЦИЮ</span><h1>Все любимые фильмы.<br/><span>В одном месте.</span></h1><p>Находи кино, сохраняй в избранное, отмечай просмотренное и собирай собственную коллекцию.</p></div><div className="hero-art"><div className="orbit orbit-1"/><div className="orbit orbit-2"/><Clapperboard size={86} strokeWidth={1.1}/></div></section>
        <section className="stats"><div className="stat"><div className="stat-icon purple"><Film size={19}/></div><div><strong>{collection.length}</strong><small>Всего фильмов</small></div></div><div className="stat"><div className="stat-icon pink"><Heart size={19}/></div><div><strong>{favoritesCount}</strong><small>В избранном</small></div></div><div className="stat"><div className="stat-icon green"><CheckCircle2 size={19}/></div><div><strong>{watchedCount}</strong><small>Просмотрено</small></div></div></section>
        {tab === 'discover' && <form className="searchbar" onSubmit={e => { e.preventDefault(); searchMovies(1); }}><Search size={21}/><input aria-label="Название фильма" value={q} onChange={e => setQ(e.target.value)} placeholder="Название фильма, например Inception..."/><div className="search-separator"/><CalendarDays size={17} className="year-icon"/><input className="year-input" aria-label="Год выпуска" value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Год"/><button type="submit" className="primary-btn" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18}/> : <Search size={18}/>} <span>Найти</span></button></form>}
        {error && <div role="alert" className="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Закрыть"><X size={16}/></button></div>}
        {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Закрыть"><X size={15}/></button></div>}
        <div className="section-title"><div><span className="eyebrow">{tab === 'discover' ? 'ИССЛЕДУЙ' : 'БИБЛИОТЕКА'}</span><h2>{({ discover: 'Результаты поиска', all: 'Моя коллекция', favorites: 'Избранные фильмы', watched: 'Просмотренные фильмы' })[tab]}</h2></div><span className="results-count">{tab === 'discover' ? (total ? `${total} результатов` : 'Начни с поиска') : `${shown.length} фильмов`}</span></div>
        {loading ? <div className="empty"><LoaderCircle className="spin" size={32}/><h3>Ищем фильмы...</h3></div> : shown.length ? <div className="movies">{shown.map(film => {
          const saved = collection.find(m => m.imdb_id === imdbId(film));
          const favorite = saved?.is_favorite || false;
          const watched = saved?.is_watched || false;
          return <article className="movie-card" key={imdbId(film)}><button className="poster-button" onClick={() => openDetails(film)} title="Информация о фильме"><Poster film={film}/><span className="poster-overlay">Подробнее <ArrowUpRight size={16}/></span></button><div className="movie-data"><div className="movie-year">{movieYear(film) || '—'}</div><button className="movie-name" onClick={() => openDetails(film)} title="Подробнее">{movieTitle(film)}</button><div className="actions"><button disabled={busy === imdbId(film)} className={`action ${favorite ? 'is-favorite' : ''}`} title={favorite ? 'Убрать из избранного' : 'В избранное'} onClick={() => saveFilm(film, 'is_favorite')}><Heart size={17} fill={favorite ? 'currentColor' : 'none'}/></button><button disabled={busy === imdbId(film)} className={`action ${watched ? 'is-watched' : ''}`} title={watched ? 'Отметить непросмотренным' : 'Отметить просмотренным'} onClick={() => saveFilm(film, 'is_watched')}><CheckCircle2 size={17}/></button>{saved && tab !== 'discover' && <button disabled={busy === imdbId(film)} className="action delete" title="Удалить" onClick={() => removeFilm(saved)}><Trash2 size={16}/></button>}</div>{tab !== 'discover' && saved && <div className="rating"><Star size={14} fill="#fbbf24" color="#fbbf24"/><select aria-label={`Личная оценка ${saved.title}`} value={saved.user_rating ?? ''} disabled={busy === saved.imdb_id} onChange={e => rateFilm(saved, Number(e.target.value) || null)}><option value="">Моя оценка</option>{Array.from({length: 10}, (_, i) => i+1).map(n => <option key={n} value={n}>{n} / 10</option>)}</select></div>}</div></article>;
        })}</div> : <div className="empty"><div className="empty-icon"><Film size={30}/></div><h3>{tab === 'discover' ? 'Найдём что-нибудь интересное?' : 'Пока здесь пусто'}</h3><p>{tab === 'discover' ? 'Введи название фильма выше и нажми «Найти».' : 'Найди фильм через поиск и добавь его в коллекцию.'}</p>{tab !== 'discover' && <button className="outline-btn" onClick={() => setTab('discover')}>Перейти к поиску <ArrowUpRight size={15}/></button>}</div>}
        {tab === 'discover' && total > 10 && !loading && <div className="pagination"><button disabled={page === 1} onClick={() => searchMovies(page - 1)}><ChevronLeft size={17}/> Назад</button><span>Страница {page} из {Math.min(100, Math.ceil(total / 10))}</span><button disabled={page >= Math.min(100, Math.ceil(total / 10))} onClick={() => searchMovies(page + 1)}>Вперёд <ChevronRight size={17}/></button></div>}
        <footer>Данные о фильмах предоставлены OMDb API · CineVault © 2026</footer>
      </div>
    </main>
    {(detailLoading || detail) && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !detailLoading) setDetail(null); }}><section role="dialog" aria-modal="true" aria-label="Информация о фильме" className="modal"><button className="modal-close" disabled={detailLoading} onClick={() => setDetail(null)} aria-label="Закрыть"><X size={20}/></button>{detailLoading ? <div className="empty"><LoaderCircle className="spin" size={30}/>Загружаем подробности...</div> : <><div className="modal-poster"><Poster film={detail}/></div><div className="modal-info"><div className="eyebrow">ИНФОРМАЦИЯ О ФИЛЬМЕ</div><h2>{detail.Title}</h2><div className="modal-tags"><span>{detail.Year}</span><span>{detail.Runtime}</span><span>{detail.Genre}</span></div><p>{detail.Plot && detail.Plot !== 'N/A' ? detail.Plot : 'Описание отсутствует.'}</p><dl><dt>Режиссёр</dt><dd>{detail.Director}</dd><dt>Актёры</dt><dd>{detail.Actors}</dd><dt>IMDb</dt><dd><Star size={14} color="#fbbf24" fill="#fbbf24"/> {detail.imdbRating} / 10</dd></dl><div className="modal-buttons"><button className={`outline-btn ${savedDetail?.is_favorite ? 'selected' : ''}`} onClick={() => saveFilm(detail)}><Heart size={17}/> {savedDetail?.is_favorite ? 'В избранном' : 'В избранное'}</button><button className={`outline-btn ${savedDetail?.is_watched ? 'selected' : ''}`} onClick={() => saveFilm(detail, 'is_watched')}><CheckCircle2 size={17}/> {savedDetail?.is_watched ? 'Просмотрено' : 'Отметить просмотренным'}</button></div></div></>}</section></div>}
  </div>;
}
