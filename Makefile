SHELL := /bin/bash

.PHONY: help install dev dev-backend dev-frontend build start clean docker-build docker-run compose-up compose-down

help: ## List available make targets
	@grep -E '^[^#[:space:]].*:.*##' Makefile | sort | awk -F ':|##' '{printf "\033[32m%-15s\033[0m %s\n", $$1, $$NF}'

install: ## Install all workspace dependencies
	npm install

dev: ## Run the backend and frontend development scripts
	npm run dev

dev-backend: ## Run only the backend development server
	npm run dev:backend

dev-frontend: ## Run only the frontend development script
	npm run dev:frontend

build: ## Build all workspaces (placeholder scripts)
	npm run build

start: ## Start the backend in production mode (placeholder)
	npm start

clean: ## Remove installed node_modules directories
	rm -rf node_modules backend/node_modules frontend/node_modules shared/node_modules

# Docker helpers -------------------------------------------------------------

docker-build: ## Build the ShrineVTT production image
	docker build -t shrinevtt:latest .

docker-run: ## Run the production image using the local .env file
	docker run --rm -p 8080:8080 --env-file .env -v $(PWD)/data:/app/data shrinevtt:latest

compose-up: ## Launch the app with Docker Compose
	docker compose up --build

compose-down: ## Stop the Docker Compose stack
	docker compose down
