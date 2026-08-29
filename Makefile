# Koda — local development.
#
#   make dev-local       the whole stack in Docker: app + Mongo
#   make dev-local-api   …and the FastAPI service, once server/ exists
#   make down            stop it
#
# Run it beside a host `npm run dev` by moving the port:
#   APP_PORT=3002 make dev-local

COMPOSE ?= docker compose

# Read for the URLs printed below, and for nothing else — compose reads .env
# by itself. Deliberately *not* exported: an environment variable outranks
# .env in compose's own precedence, so exporting a default here is what made
# `make dev-local` bind 3001 no matter what .env said. A value passed on the
# command line (`APP_PORT=3002 make dev-local`) is already in the environment
# and still reaches compose, which is the override that was wanted.
-include .env

APP_PORT ?= 3001
API_PORT ?= 8000
MONGO_PORT ?= 27017

.DEFAULT_GOAL := help

## help: list the targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | awk -F': ' '{printf "  \033[1m%-16s\033[0m %s\n", $$1, $$2}'

## dev-local: build and run the whole stack — app, API and Mongo
dev-local:
	# --renew-anon-volumes: node_modules lives in an anonymous volume, and a
	# stale one would shadow a dependency added since the last build.
	$(COMPOSE) up --build -d --renew-anon-volumes
	@echo
	@echo "  Koda        http://localhost:$(APP_PORT)"
	@echo "  API         http://localhost:$(API_PORT)/v1/health"
	@echo "  API docs    http://localhost:$(API_PORT)/v1/docs"
	@echo "  Mongo       mongodb://localhost:$(MONGO_PORT)"
	@echo "  Logs        make logs · make logs-api"
	@echo

## logs-api: follow the API's output
logs-api:
	$(COMPOSE) logs -f api

## test-api: run the API's tests against the compose Mongo
test-api:
	$(COMPOSE) run --rm api pytest -q

## lint-api: ruff over the service
lint-api:
	$(COMPOSE) run --rm api ruff check app tests

## migrate: apply every index
migrate:
	$(COMPOSE) exec api python -m app.cli migrate

## prod-local: build the production image and serve the built app
prod-local:
	$(COMPOSE) -f docker-compose.yml run --rm --build --service-ports \
		-e NODE_ENV=production app node dist/server.cjs

## logs: follow the app's output
logs:
	$(COMPOSE) logs -f app

## ps: what is running
ps:
	$(COMPOSE) ps

## shell: a shell inside the app container
shell:
	$(COMPOSE) exec app sh

## mongo-shell: a mongosh session against the local database
mongo-shell:
	$(COMPOSE) exec mongo mongosh koda

## down: stop the stack, keep the database
down:
	$(COMPOSE) down

## clean: stop the stack and delete the database volume
clean:
	$(COMPOSE) down -v

.PHONY: help dev-local prod-local logs logs-api test-api lint-api migrate ps shell mongo-shell down clean
