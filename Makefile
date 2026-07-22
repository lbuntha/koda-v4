# Koda — dev & container tasks. Run `make` (or `make help`) to list targets.

.DEFAULT_GOAL := help
.PHONY: help dev-local up down build logs restart clean api-shell mongo-shell

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ── Local (no containers) ─────────────────────────────────────────────────────
dev-local: ## Run MongoDB + backend + frontend as local processes (Ctrl+C stops all)
	@bash scripts/dev.sh

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
