# syntax=docker/dockerfile:1
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /srv

# Dependencies first, so editing a router does not reinstall them.
COPY pyproject.toml ./
COPY app/__init__.py app/__init__.py
COPY app/art_defaults.json app/art_defaults.json
COPY app/skill_defaults.json app/skill_defaults.json
RUN pip install --no-cache-dir -e ".[dev]"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
