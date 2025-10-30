# ShrineVTT

## Development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

## Docker

Build the Docker image:

```bash
docker build -t shrinevtt .
```

Run the container and expose the preview server on port 4173:

```bash
docker run --rm -p 4173:4173 shrinevtt
```

The application will be served from `http://localhost:4173` via `npm run preview`.

## Docker Compose

Build the image and start the preview server with Docker Compose:

```bash
docker compose up --build
```

Then access the app at `http://localhost:4173`.
