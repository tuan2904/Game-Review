# GameReview Frontend

React 19 + Vite client for the GameReview API. Phase 06 delivered the
foundation (API client, auth, routing, layout, reusable components);
business pages arrive in Phases 07–08.

## Quick Start

```bash
npm install
cp .env.example .env   # optional — defaults work for local dev
npm run dev            # http://localhost:5173
```

Requires the backend running at `http://localhost:8000/api/v1`
(see the repository root `README.md`).

## Commands

| Task             | Command                   |
| ---------------- | ------------------------- |
| Dev server       | `npm run dev`             |
| Tests            | `npm test`                |
| Watch tests      | `npm run test:watch`      |
| Lint             | `npm run lint`            |
| Format           | `npm run format`          |
| Check formatting | `npm run format:check`    |
| Build            | `npm run build`           |

## Documentation

Architecture, token-storage trade-off, routing and conventions:
[`../docs/FRONTEND.md`](../docs/FRONTEND.md).
