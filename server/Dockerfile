# syntax=docker/dockerfile:1
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /srv

# Library recordings are normalized to the same compact 48 kbps mono M4A used
# by bundled skill audio before they are sent to durable object storage.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Dependencies first, so editing a router does not reinstall them.
COPY pyproject.toml ./
COPY app/__init__.py app/__init__.py
COPY app/art_defaults.json app/art_defaults.json
COPY app/skill_defaults.json app/skill_defaults.json
RUN pip install --no-cache-dir -e ".[dev]"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
