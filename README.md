# GameReview

A small fullstack game review web application built as an academic team project.

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Backend   | Django 6, Django REST Framework                   |
| Database  | PostgreSQL                                        |
| Auth      | JWT (djangorestframework-simplejwt)               |
| Frontend  | React 19, Vite, Axios, React Router               |
| API style | REST, versioned under `/api/v1`                   |
| Architecture | View → Service → Repository → Model (pragmatic MVC) |

## Project Structure

```text
Game-Review/
├── backend/
│   ├── apps/
│   │   ├── accounts/     # User, register/login/refresh
│   │   ├── games/        # Game, Category
│   │   ├── reviews/      # Game reviews
│   │   ├── comments/     # Review comments
│   │   ├── favorites/    # User favorites
│   │   ├── reports/      # User reports + moderation queue (Phase E)
│   │   └── common/       # Shared infrastructure (responses, errors, pagination)
│   ├── config/           # Django settings, urls
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
├── docs/
│   ├── ARCHITECTURE.md   # Layers, conventions, transactions, ORM rules
│   ├── API.md            # Response format, errors, pagination, filtering
│   ├── FRONTEND.md       # Frontend structure, auth/token design, checks
│   └── PROJECT_PLAN.md   # Phase status and acceptance tracking
└── README.md
```

## Prerequisites

- Python 3.14
- Node.js 20+
- PostgreSQL 14+

## Setup

### 1. Database

```bash
createdb gamereview
```

Copy `backend/.env.example` to `backend/.env` and adjust database credentials.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

API base: `http://localhost:8000/api/v1`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # optional — defaults work for local dev
npm run dev
```

App: `http://localhost:5173`

## Commands

| Task                 | Command                                              |
| -------------------- | ---------------------------------------------------- |
| Run backend          | `cd backend && .venv/bin/python manage.py runserver` |
| Run backend tests    | `cd backend && .venv/bin/python -m pytest`           |
| Lint backend         | `cd backend && .venv/bin/ruff check .`               |
| Format backend       | `cd backend && .venv/bin/ruff format .`              |
| Run frontend         | `cd frontend && npm run dev`                         |
| Run frontend tests   | `cd frontend && npm test`                            |
| Lint frontend        | `cd frontend && npm run lint`                        |
| Format frontend      | `cd frontend && npm run format`                      |
| Check formatting     | `cd frontend && npm run format:check`                |
| Build frontend       | `cd frontend && npm run build`                       |

## API Response Format

Success:

```json
{
  "success": true,
  "message": "Game retrieved successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Review already exists",
  "errors": {}
}
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — request flow, layer responsibilities, transactions, ORM and permission conventions
- [`docs/API.md`](docs/API.md) — response envelope, status codes, pagination, search/filtering conventions
- [`docs/FRONTEND.md`](docs/FRONTEND.md) — frontend structure, auth/token design, conventions and checks
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — phase status and acceptance criteria

## Development Phases

| Phase | Description                    | Status |
| ----- | ------------------------------ | ------ |
| 00    | Project Setup                  | Done   |
| 01    | Backend Foundation             | Done   |
| 02    | Authentication                 | Done   |
| 03    | Game Module                    | Done   |
| 04    | Review                       | Done   |
| 05    | Comment and Favorite         | Done   |
| 06    | Frontend Foundation            | Done   |
| 07    | Game UI                        | Done   |
| 08    | Review UI                      | Done   |
| 09    | Admin                          | Done   |
| 10    | Comments & Favorites UI        | Done   |
| 11    | Testing and Hardening          | In progress |
# Game-Review
