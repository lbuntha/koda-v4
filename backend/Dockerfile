# Koda backend — FastAPI + MongoDB (Beanie). Build context: ./backend
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; wheels cover pydantic-core/argon2/motor.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY seed.py ./seed.py

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
