# ShrineVTT

ShrineVTT — минимальный каркас виртуального игрового стола. Первая итерация проекта запускает HTTP и WebSocket сервер на Node.js (ESM), отдаёт статическую страницу фронтенда с канвасом, поддерживает базовую аутентификацию с ролями MASTER/PLAYER и собирается в единый Docker-образ.

## Возможности

- **Express (ESM)** — `/health` отдаёт JSON с состоянием сервиса, `/api/**` содержит REST-эндпоинты для аутентификации и проверки роли.
- **Статика фронтенда** — страница с `<canvas>` и панелью авторизации, собираемая Vite и отдаваемая из `backend/static`.
- **WebSocket (Socket.IO)** — namespace `/game`, поддержка комнат по идентификатору сессии, обработка `ping → pong` и мастер-объявлений.
- **RBAC** — в комплекте две учётные записи: `master/masterpass` (роль MASTER) и `player/playerpass` (роль PLAYER). Доступ к защищённым HTTP- и WS-операциям контролируется на сервере.
- **Хранилище** — `lowdb` (JSON) с хранением в каталоге данных (`DATA_DIR`).
- **Docker** — мультистейдж-образ, собирающий фронтенд и backend, плюс `docker-compose.yml` для запуска одним контейнером.
- **Качество** — ESLint (flat config) и Prettier, npm-скрипты `lint`, `format`, `dev`, `start`, `build`.

## Подготовка окружения

Требуется Node.js 18+ и npm 9+. Клонируйте репозиторий и установите зависимости:

```bash
npm install
npm --prefix frontend install
```

Скопируйте `.env.example` в `.env` и при необходимости измените значения (порт, cors, каталог данных):

```bash
cp .env.example .env
```

## Локальный запуск (development)

1. Соберите фронтенд (создаст `backend/static`):
   ```bash
   npm run build
   ```
2. Запустите backend в режиме hot-reload:
   ```bash
   npm run dev
   ```
3. (Опционально) поднимите Vite Dev Server для фронтенда, если хотите редактировать UI в реальном времени:
   ```bash
   npm --prefix frontend run dev
   ```

HTTP-приложение доступно по `http://localhost:8080`. После логина (см. учётные данные выше) фронтенд подключится к WebSocket и покажет ответы `pong`.

## Проверки качества

```bash
npm run lint
npm run format
```

Команда `npm run format:write` приведёт код к стилю Prettier.

## Сборка и запуск в Docker

Соберите и поднимите сервис одной командой:

```bash
docker compose up --build -d
```

Сервис пробрасывает порт `8080` наружу, читает настройки из `.env` и хранит данные в томе `shrinevtt-data`, смонтированном в `/app/data`.

Остановить и удалить контейнер:

```bash
docker compose down
```

## API и события

- `GET /health` — проверка состояния.
- `POST /api/auth/login` — вход, возвращает `{ token, user }`.
- `GET /api/auth/me` — получение текущей сессии (требуется `Authorization: Bearer <token>`).
- `POST /api/auth/logout` — выход.
- `GET /api/session/me` — информация о пользователе и сессии (защищено).
- `POST /api/session/master/broadcast` — защищённый MASTER-эндпоинт.
- Socket.IO namespace `/game`:
  - `ping` → `pong` (эхо)
  - `gm:announcement` (MASTER) → `announcement`

## Дальнейшие шаги

- Подключить реальное хранилище (PostgreSQL/SQLite).
- Добавить управление игровыми комнатами, сценами и объектами.
- Реализовать полноценную авторизацию и refresh-токены.
- Обновить UI и канвас под реальные игровые потребности.
