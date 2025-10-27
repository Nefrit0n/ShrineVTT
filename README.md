# ShrineVTT

Stage 1.1 of the ShrineVTT monorepo establishes the base project structure that future stages will build on.

## Requirements

- Node.js >= 18
- npm >= 9 (bundled with Node.js 18+)

## Project structure

```
.
├── backend   # Express + Socket.IO implementation will live here in later stages
├── frontend  # Static assets and bundler configuration will be added in later stages
├── shared    # Shared constants and JSDoc types
├── data      # Database files and persistent storage (gitignored)
└── package.json
```

## Development

Install dependencies once from the repository root:

```bash
npm install
```

Run both backend and frontend development placeholders:

```bash
npm run dev
```

You can also run each package individually:

```bash
npm run dev:backend
npm run dev:frontend
```

## Production build

Production workflows will be defined in later stages. For now, placeholder scripts exist:

```bash
npm run build
npm start
```

These commands currently print placeholder messages until real build and runtime steps are implemented.
