# CineVault — Каталог фильмов (микросервисная архитектура)

Учебный проект: React + Vite (фронтенд), Node.js / Express (основной API), отдельный OMDb Proxy (web-service), PostgreSQL 16 (БД). Все компоненты запускаются Docker Compose. Снаружи доступен только frontend на порту 8080.

## Возможности

- Поиск через OMDb API по названию, году, с постраничным просмотром.
- Просмотр подробностей: описание, жанр, актёры, режиссёр, IMDb-рейтинг.
- Добавление в коллекцию, независимые отметки «В избранном» и «Просмотрено».
- Личные оценки от 1 до 10, удаление фильмов из коллекции.
- Статистика коллекции, состояния загрузки и сообщения об ошибках.
- Адаптивный интерфейс с тёмной темой.

## Запуск

1. Установите Docker Desktop с Docker Compose.
2. Скопируйте файл `.env.example` в `.env` (`cp .env.example .env` на macOS/Linux или `copy .env.example .env` в cmd на Windows).
3. В `.env` замените `change_this_password` на собственный пароль PostgreSQL и `your_omdb_api_key` на действующий API-ключ с https://www.omdbapi.com/apikey.aspx.
4. Запустите из корня проекта: `docker compose up -d --build`.
5. Откройте http://localhost:8080. Для проверки: `docker compose ps` и `docker compose logs -f`.
6. Остановка: `docker compose down` (данные БД сохранятся в Docker volume).

**Важно:** Docker должен быть запущен. Секреты не добавляйте в Git. Если таблицы уже были созданы по другой схеме в старом томе PostgreSQL, используйте новый проект/том либо выполните миграцию. Команда `docker compose down -v` удаляет накопленные данные без возможности восстановления.

## Контейнеры и сеть

```text
Браузер --> frontend (Nginx, :8080)
                |
                +-- /api/* --> backend (Express, :3000)
                                  |                |
                                  v                v
                            PostgreSQL       web-service (Express, :3001)
                                                     |
                                                     v
                                               OMDb (внешний HTTPS)
```

Внутренняя сеть Compose `internal` использует драйвер bridge. Только frontend публикует порт. Web-service — настоящий работающий HTTP-сервис, а не заглушка.

## REST API

| Метод | Путь | Действие |
|---|---|---|
| GET | `/api/search?q=matrix&page=1&year=1999` | Поиск в OMDb |
| GET | `/api/details/tt0133093` | Подробности фильма |
| GET | `/api/movies?filter=all` | Все фильмы из PostgreSQL (`all`, `favorite`, `watched`) |
| GET | `/api/stats` | Статистика коллекции |
| POST | `/api/movies` | Добавление фильма в коллекцию |
| PATCH | `/api/movies/:id` | Изменение `is_favorite`, `is_watched`, `user_rating` |
| DELETE | `/api/movies/:id` | Удаление из коллекции |

Пример тела `POST /api/movies`:

```json
{"imdb_id":"tt0133093","title":"The Matrix","year":"1999","poster":null,"is_favorite":true,"is_watched":false}
```

Пример тела `PATCH /api/movies/1`:

```json
{"is_watched":true,"user_rating":9}
```

При повторном добавлении уже существующего фильма включённые флаги сохраняются. Для снятия отметки используется `PATCH`.

## Структура

```text
movie-catalog-improved/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── db/init.sql
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/index.js
├── web-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/index.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── style.css
```

## Демонстрация преподавателю

1. Покажите четыре работающих контейнера через `docker compose ps`.
2. Найдите «matrix» и откройте подробности фильма (данные идут через web-service к OMDb).
3. Добавьте фильм в избранное, отметьте просмотренным и выставьте оценку.
4. Перейдите в «Моя коллекция», «Избранное», «Просмотрено». Покажите отдельные фильтры.
5. Перезагрузите страницу и убедитесь, что сохранённые фильмы остались в БД.
6. Объясните: интерфейс, бизнес-API, интеграционный сервис и хранение данных разделены на четыре контейнера.

## Ограничения

- Вход и разграничение пользователей не предусмотрены: коллекция общая, как в исходном учебном варианте.
- OMDb API требует личного ключа и подключения к сети.
- Внешние Google Fonts загружаются при доступном интернете; при его отсутствии используется системный шрифт.
- Приложение рассчитано на локальную учебную демонстрацию, а не на открытое размещение в интернете без авторизации и ограничения запросов.
