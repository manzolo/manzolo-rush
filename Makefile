# MANZOLO RUSH — comandi di sviluppo, verifica e distribuzione.
# `make` o `make help` elenca i target.

SHELL := /bin/bash
.DEFAULT_GOAL := help

PORT        ?= 8000
DOCKER_PORT ?= 8080
IMAGE       ?= manzolo-rush
TAG         ?= latest
COMPOSE     ?= docker compose
PYTHON      ?= python3
NODE        ?= node
SHEET       ?= assets/raw/spritesheet.png
GRID_COLS   ?= 4
GRID_ROWS   ?= 5
NAMES       ?= main
PREFIX      ?=

.PHONY: help serve open check test verify sprites sprites-preview \
        build up down restart logs shell run stop ps image-size clean distclean \
        deploy deploy-logs

## ------------------------------------------------------------ sviluppo

help: ## Mostra questo aiuto
	@echo "MANZOLO RUSH — target disponibili:"; echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo; echo "Variabili: PORT=$(PORT) DOCKER_PORT=$(DOCKER_PORT) IMAGE=$(IMAGE):$(TAG)"

serve: ## Avvia il server statico locale (PORT=8000)
	@echo "→ http://localhost:$(PORT)"
	$(PYTHON) -m http.server $(PORT) --bind 0.0.0.0

open: ## Apre il gioco nel browser predefinito (serve già avviato)
	@xdg-open "http://localhost:$(PORT)" >/dev/null 2>&1 || open "http://localhost:$(PORT)"

## ------------------------------------------------------------ verifica

check: ## Controllo sintattico di tutti i moduli JS
	$(NODE) tests/check.mjs

test: ## Test di logica (node --test)
	$(NODE) --test tests/*.test.mjs

verify: check test ## check + test

bump: ## Nuova versione, commit, tag e push: parte la pubblicazione su Pages (PARTE=patch|minor|major)
	@./scripts/bump.sh $(or $(PARTE),patch)

check-public: ## Prima di pubblicare: niente prompt, fogli grezzi, segreti o host privati in tutta la storia
	@./scripts/check-public.sh --self-test
	@./scripts/check-public.sh

## ------------------------------------------------------------ asset

sprites: ## Ritaglia uno sheet (SHEET=..., GRID_COLS/ROWS, NAMES=preset, PREFIX=erika_)
	$(PYTHON) tools/slice_sprites.py --sheet $(SHEET) --cols $(GRID_COLS) --rows $(GRID_ROWS) --names $(NAMES) --prefix "$(PREFIX)"

sprites-preview: sprites ## Rigenera gli sprite e apre l'anteprima
	@xdg-open assets/sprites/preview.png >/dev/null 2>&1 || open assets/sprites/preview.png

## ------------------------------------------------------------ docker

build: ## Costruisce l'immagine Docker
	docker build -t $(IMAGE):$(TAG) .

up: ## Avvia il container con docker compose (DOCKER_PORT=8080)
	$(COMPOSE) up -d --build
	@echo "→ http://localhost:$(DOCKER_PORT)"

down: ## Ferma e rimuove il container
	$(COMPOSE) down

restart: down up ## Riavvia il container

logs: ## Segue i log del container
	$(COMPOSE) logs -f

ps: ## Stato del container
	$(COMPOSE) ps

shell: ## Shell dentro il container
	$(COMPOSE) exec manzolo-rush sh

run: build ## Esegue l'immagine senza compose (usa e getta)
	docker run --rm -it -p $(DOCKER_PORT):80 --name $(IMAGE)-run $(IMAGE):$(TAG)

stop: ## Ferma il container avviato con `make run`
	-docker stop $(IMAGE)-run

image-size: ## Dimensione dell'immagine
	@docker image ls $(IMAGE):$(TAG) --format '{{.Repository}}:{{.Tag}}  {{.Size}}'

## ------------------------------------------------------------ deploy su un server proprio

# Host e indirizzo stanno in deploy.local.mk, fuori da git, per esempio:
#   DEPLOY_HOST = root@mio-server
#   DEPLOY_URL  = https://rush.esempio
-include deploy.local.mk
DEPLOY_DIR  ?= /root/manzolo-rush

deploy: verify ## Pubblica su un server con Docker (DEPLOY_HOST in deploy.local.mk): copia, build e riavvio
	@test -n "$(DEPLOY_HOST)" || { echo "manca DEPLOY_HOST: scrivilo in deploy.local.mk"; exit 2; }
	ssh $(DEPLOY_HOST) 'mkdir -p $(DEPLOY_DIR)'
	tar -czf - Dockerfile nginx.conf index.html style.css src assets/sprites assets/audio docker-compose.homeserver.yml \
	  | ssh $(DEPLOY_HOST) 'cd $(DEPLOY_DIR) && rm -rf src assets && tar -xzf - && mv docker-compose.homeserver.yml docker-compose.yml && docker compose up -d --build && docker image prune -f >/dev/null'
	@echo "→ $(DEPLOY_URL)"

deploy-logs: ## Log del container sul server di deploy
	@test -n "$(DEPLOY_HOST)" || { echo "manca DEPLOY_HOST: scrivilo in deploy.local.mk"; exit 2; }
	ssh $(DEPLOY_HOST) 'cd $(DEPLOY_DIR) && docker compose logs -f --tail 50'

## ------------------------------------------------------------ pulizia

clean: ## Rimuove file temporanei e log
	rm -f codex.log
	find . -name '__pycache__' -type d -prune -exec rm -rf {} +

distclean: clean down ## clean + container + immagine Docker
	-docker image rm $(IMAGE):$(TAG)
