# ShrineVTT

ShrineVTT is a monorepo that will eventually power a virtual tabletop application. Stage 1.x focuses on establishing the backend foundation, placeholder frontend assets, and smooth local development workflows.

## Requirements

- Node.js >= 18 (bundled npm >= 9)
- Docker 24+ and Docker Compose v2 (optional, for container workflows)
- GNU Make (optional, for the provided helper targets)

## Project structure

```
.
├── backend/      # Express API + Socket.IO server
├── frontend/     # Static assets served by the backend
├── shared/       # Shared constants and JSDoc types
├── data/         # Persistent SQLite database files (gitignored)
├── Dockerfile
├── docker-compose.yml
├── Makefile
├── package.json  # Workspace root scripts
└── README.md
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment example and adjust values as needed:

   ```bash
   cp .env.example .env
   ```

   The default configuration exposes the HTTP server on port **8080**.

## Development workflows

### npm scripts

- `npm run dev` – starts the backend development server (blocking) and prints the placeholder frontend message.
- `npm run dev:backend` – runs only the backend server at http://localhost:8080.
- `npm run dev:frontend` – runs the placeholder frontend script.
- `npm run build` – executes placeholder build scripts for all workspaces.
- `npm start` – launches the backend server using production settings (still a placeholder flow).

### Makefile helpers

A convenience `Makefile` mirrors the npm scripts and adds Docker helpers. List available targets with:

```bash
make help
```

Common targets:

- `make install`
- `make dev`
- `make dev-backend`
- `make build`
- `make start`
- `make docker-build`
- `make docker-run`
- `make compose-up`

## Environment variables

See `.env.example` for defaults. Key variables include:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port for the backend server. |
| `CORS_ORIGIN` | `http://localhost:8080` | Allowed CORS origin(s), comma-separated. |
| `JWT_SECRET` | `change-me` | Secret key for signing JSON Web Tokens. |
| `SQLITE_DB_PATH` | `./data/shrine.db` | Path to the SQLite database file (created if it does not exist). |
| `LOG_LEVEL` | `info` | Optional log verbosity for the backend logger. |

Environment variables are loaded via [`dotenv`](https://github.com/motdotla/dotenv) when you run any backend script.

## Building for production

The build workflow is currently a placeholder but already wired up:

```bash
npm run build
npm start
```

This launches the backend server, serving the static files located in `frontend/dist`.

## Docker usage

### Single container

1. Build the image:

   ```bash
   docker build -t shrinevtt:latest .
   ```

2. Run the container (assumes a populated `.env` file and a local `data/` directory):

   ```bash
   docker run \
     --rm \
     -p 8080:8080 \
     --env-file .env \
     -v "$(pwd)/data:/app/data" \
     shrinevtt:latest
   ```

### Docker Compose

Use the provided compose file to build and run the app with one command:

```bash
docker compose up --build
```

Stop the stack with:

```bash
docker compose down
```

Both flows expose the service on http://localhost:8080.

## Manual QA checklist

- [ ] Run `npm run dev` (or `make dev`).
- [ ] Open `http://localhost:8080/` in a browser.
- [ ] Click the **Ping** button and observe the handshake response in the UI and server logs.

## Troubleshooting tips

- Ensure `.env` is present before running the backend—missing secrets will prevent JWT-based features from working once implemented.
- Delete `data/` if you need a clean SQLite database; it will be recreated automatically on the next startup.
- Use `LOG_LEVEL=debug` to see additional diagnostics in the backend logs.
