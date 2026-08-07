# Koda backend — FastAPI + MongoDB (Beanie). Build context: repository root.
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; wheels cover pydantic-core/argon2/motor.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/scripts ./scripts
COPY backend/seed.py ./seed.py
COPY shared/technique-thumbnails.json ./shared/technique-thumbnails.json

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
