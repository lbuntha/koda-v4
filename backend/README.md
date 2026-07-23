# Koda Backend — FastAPI + MongoDB

Auth + data API for the Koda counting studio. Home-use model: **parents** manage
**kids (students)**; **teachers** author content; an **admin** oversees the platform.

## Roles

| Role | Signs in with | Highlights |
|------|---------------|------------|
| `admin` | email + password | Full access |
| `teacher` | email + password | Authors curriculum + question decks |
| `parent` | email + password | Manages their kids, sees their progress; owns a **family code** |
| `student` | family code + name + PIN, **or** parent-launched | Plays games, writes its own learning events only |

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit JWT_SECRET, MONGO_URI, OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

Needs a running MongoDB (local `mongod`, Docker, or Atlas — set `MONGO_URI`).
Interactive API docs: http://localhost:8000/docs

## Auth flows

- **Adults:** `POST /auth/register` then `POST /auth/login` (OAuth2 password form) →
  `{ access_token, refresh_token }`. Refresh via `POST /auth/refresh`.
- **Kid, independent:** `POST /auth/student/login` with `{ family_code, name, pin }`.
- **Kid, parent-launched:** parent (logged in) calls `POST /auth/student/launch`
  with `{ student_id }` → a student token for that child.

## How it maps to the frontend

| Frontend seam | Endpoint |
|---------------|----------|
| `services/analyticsLogger.ts` | `POST /events`, `GET /events` |
| `curriculum/useCurriculumTree.ts` | `GET/PUT /curriculum` |
| the question deck | `GET/PUT /questions` |
| `ai-generator/openaiService.ts` | `POST /ai/generate` (encrypted/server-side key) |
