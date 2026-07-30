# Koda — dev & container tasks. Run `make` (or `make help`) to list targets.

.DEFAULT_GOAL := help
.PHONY: help dev-local up down build logs restart clean api-shell mongo-shell seed seed-grade1 seed-grade1-missed seed-grade1-local seed-grade1-missed-local seed-grade2-science seed-grade2-science-local seed-docker

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ── Local (no containers) ─────────────────────────────────────────────────────
dev-local: ## Run MongoDB + backend + frontend as local processes (Ctrl+C stops all)
	@bash scripts/dev.sh

seed: ## Seed/reset the initial admin account (local venv)
	@cd backend && ./.venv/bin/python seed.py

seed-grade1: ## Seed/reset Grade 1 fixture in the running Docker stack
	docker compose exec -T api python scripts/seed_phase1_grade1.py

seed-grade1-missed: ## Seed Grade 1 with overdue retry/review recommendations in Docker
	docker compose exec -T -e SEED_GRADE1_SCENARIO=missed api python scripts/seed_phase1_grade1.py

seed-grade1-local: ## Seed/reset Grade 1 fixture for make dev-local
	@cd backend && ./.venv/bin/python scripts/seed_phase1_grade1.py

seed-grade1-missed-local: ## Seed Grade 1 with overdue retry/review recommendations locally
	@cd backend && SEED_GRADE1_SCENARIO=missed ./.venv/bin/python scripts/seed_phase1_grade1.py

seed-grade2-science: ## Seed Grade 2 Science and its Grade 1 promotion path in Docker
	docker compose exec -T api python -m scripts.seed_grade2_science

seed-grade2-science-local: ## Seed Grade 2 Science for make dev-local
	@cd backend && ./.venv/bin/python -m scripts.seed_grade2_science

seed-docker: ## Seed/reset the initial admin account (in Docker)
	docker compose run --rm api python seed.py

# ── Docker Compose (mongo + api + web) ────────────────────────────────────────
up: ## Build + start the full stack in Docker (detached)
	docker compose up --build -d
	@echo "  App : http://localhost:3000"
	@echo "  API : http://localhost:8000/docs"

build: ## Build the Docker images without starting
	docker compose build

logs: ## Follow logs from all containers
	docker compose logs -f

restart: ## Recreate containers
	docker compose up -d --force-recreate

down: ## Stop and remove the containers
	docker compose down

clean: ## Stop containers AND delete the Mongo volume (wipes local DB data)
	docker compose down -v

api-shell: ## Open a shell in the running backend container
	docker compose exec api bash

mongo-shell: ## Open a mongosh shell in the running mongo container
	docker compose exec mongo mongosh
