# ============================================================================
# ParkFlow Makefile
# ============================================================================
# Common commands for development and deployment
#
# Usage:
#   make help          - Show this help message
#   make dev           - Start development environment
#   make build         - Build all packages
#   make test          - Run all tests
#   make docker-build  - Build Docker images
#   make docker-up     - Start containers (development)
#   make prod-up       - Start containers (production)
# ============================================================================

.PHONY: help dev build test lint clean docker-build docker-up docker-down prod-up prod-down logs backup restore secrets-create secrets-list swarm-deploy

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# ============================================================================
# Help
# ============================================================================
help:
	@echo ""
	@echo "$(CYAN)ParkFlow - 주차장 관리 시스템$(RESET)"
	@echo ""
	@echo "$(GREEN)Development Commands:$(RESET)"
	@echo "  make dev           Start development servers"
	@echo "  make build         Build all packages"
	@echo "  make test          Run all tests"
	@echo "  make lint          Run linters"
	@echo "  make clean         Clean build artifacts"
	@echo ""
	@echo "$(GREEN)Docker Commands (Development):$(RESET)"
	@echo "  make docker-build  Build Docker images"
	@echo "  make docker-up     Start containers"
	@echo "  make docker-down   Stop containers"
	@echo "  make logs          View container logs"
	@echo ""
	@echo "$(GREEN)Docker Commands (Production):$(RESET)"
	@echo "  make prod-build    Build production images"
	@echo "  make prod-up       Start production containers"
	@echo "  make prod-down     Stop production containers"
	@echo "  make prod-logs     View production logs"
	@echo ""
	@echo "$(GREEN)SSL/TLS Commands:$(RESET)"
	@echo "  make ssl-setup     Show SSL setup instructions"
	@echo "  make ssl-up        Start with HTTPS (DOMAIN_NAME=x)"
	@echo "  make ssl-down      Stop SSL containers"
	@echo "  make ssl-renew     Renew SSL certificates"
	@echo ""
	@echo "$(GREEN)Database Commands:$(RESET)"
	@echo "  make backup        Create database backup"
	@echo "  make restore       Restore from backup (FILE=filename)"
	@echo "  make db-shell      Open SQLite shell"
	@echo ""
	@echo "$(GREEN)Monitoring Commands:$(RESET)"
	@echo "  make monitoring-up   Start Prometheus + Grafana"
	@echo "  make monitoring-down Stop monitoring stack"
	@echo "  make metrics         View Prometheus metrics"
	@echo "  make metrics-json    View JSON metrics"
	@echo ""
	@echo "$(GREEN)Docker Swarm Commands:$(RESET)"
	@echo "  make swarm-init      Initialize Docker Swarm"
	@echo "  make secrets-create  Create Docker secrets"
	@echo "  make secrets-list    List Docker secrets"
	@echo "  make swarm-deploy    Deploy to Swarm (production)"
	@echo "  make swarm-status    Check Swarm stack status"
	@echo "  make swarm-remove    Remove Swarm stack"
	@echo ""
	@echo "$(GREEN)Utility Commands:$(RESET)"
	@echo "  make health        Check service health"
	@echo "  make stats         Show service statistics"
	@echo ""

# ============================================================================
# Development Commands
# ============================================================================
dev:
	@echo "$(CYAN)Starting development environment...$(RESET)"
	pnpm dev

build:
	@echo "$(CYAN)Building all packages...$(RESET)"
	pnpm build

test:
	@echo "$(CYAN)Running tests...$(RESET)"
	cd apps/api-server && npx vitest run
	cd packages/pricing-engine && npx vitest run

test-watch:
	@echo "$(CYAN)Running tests in watch mode...$(RESET)"
	pnpm test

lint:
	@echo "$(CYAN)Running linters...$(RESET)"
	pnpm lint

clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf apps/api-server/dist
	rm -rf apps/admin-web/dist
	rm -rf apps/device-agent/dist
	rm -rf packages/shared/dist
	rm -rf packages/pricing-engine/dist
	@echo "$(GREEN)Clean complete!$(RESET)"

# ============================================================================
# Docker Commands (Development)
# ============================================================================
docker-build:
	@echo "$(CYAN)Building Docker images...$(RESET)"
	docker-compose build

docker-up:
	@echo "$(CYAN)Starting containers...$(RESET)"
	docker-compose up -d
	@echo ""
	@echo "$(GREEN)Services started:$(RESET)"
	@echo "  API Server: http://localhost:3000"
	@echo "  Admin Web:  http://localhost:80"
	@echo "  API Docs:   http://localhost:3000/docs"

docker-down:
	@echo "$(YELLOW)Stopping containers...$(RESET)"
	docker-compose down

docker-restart:
	@echo "$(CYAN)Restarting containers...$(RESET)"
	docker-compose restart

logs:
	docker-compose logs -f

logs-api:
	docker-compose logs -f api-server

logs-admin:
	docker-compose logs -f admin-web

# ============================================================================
# Docker Commands (Production)
# ============================================================================
prod-build:
	@echo "$(CYAN)Building production Docker images...$(RESET)"
	docker-compose -f docker-compose.prod.yml build

prod-up:
	@echo "$(CYAN)Starting production containers...$(RESET)"
	@if [ ! -f .env ]; then \
		echo "$(RED)Error: .env file not found!$(RESET)"; \
		echo "Copy .env.example to .env and configure it first."; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml up -d
	@echo ""
	@echo "$(GREEN)Production services started!$(RESET)"

prod-down:
	@echo "$(YELLOW)Stopping production containers...$(RESET)"
	docker-compose -f docker-compose.prod.yml down

prod-restart:
	@echo "$(CYAN)Restarting production containers...$(RESET)"
	docker-compose -f docker-compose.prod.yml restart

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-pull:
	@echo "$(CYAN)Pulling latest images...$(RESET)"
	docker-compose -f docker-compose.prod.yml pull

# ============================================================================
# SSL/TLS Commands
# ============================================================================
ssl-setup:
	@echo "$(CYAN)SSL Setup Helper$(RESET)"
	@echo ""
	@echo "Usage: ./scripts/ssl-setup.sh <domain> <email>"
	@echo "Example: ./scripts/ssl-setup.sh admin.parkflow.io admin@parkflow.io"
	@echo ""
	@echo "Prerequisites:"
	@echo "  1. Domain must point to this server's IP"
	@echo "  2. Ports 80 and 443 must be open"
	@echo ""

ssl-up:
	@echo "$(CYAN)Starting production with SSL...$(RESET)"
	@if [ -z "$(DOMAIN_NAME)" ]; then \
		echo "$(RED)Error: DOMAIN_NAME required$(RESET)"; \
		echo "Usage: DOMAIN_NAME=your-domain.com make ssl-up"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up -d
	@echo ""
	@echo "$(GREEN)HTTPS enabled at https://$(DOMAIN_NAME)$(RESET)"

ssl-down:
	@echo "$(YELLOW)Stopping SSL containers...$(RESET)"
	docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml down

ssl-renew:
	@echo "$(CYAN)Renewing SSL certificates...$(RESET)"
	docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml run --rm certbot renew
	docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml exec admin-web nginx -s reload

# ============================================================================
# Database Commands
# ============================================================================
backup:
	@echo "$(CYAN)Creating database backup...$(RESET)"
	@if docker ps | grep -q parkflow-api; then \
		docker exec parkflow-api node -e "require('./dist/services/backup.js').getBackupService().createBackup('manual').then(r => console.log(r.success ? 'Backup created: ' + r.backup.filename : 'Error: ' + r.error))"; \
	else \
		echo "$(RED)API server is not running$(RESET)"; \
	fi

restore:
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE parameter required$(RESET)"; \
		echo "Usage: make restore FILE=parkflow_2024-01-01T03-00-00.db.gz"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring from backup: $(FILE)$(RESET)"
	@echo "$(RED)WARNING: This will overwrite the current database!$(RESET)"
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker exec parkflow-api node -e "require('./dist/services/backup.js').getBackupService().restoreFromBackup('$(FILE)').then(r => console.log(r.success ? 'Restored!' : 'Error: ' + r.error))"

backup-list:
	@echo "$(CYAN)Available backups:$(RESET)"
	@docker exec parkflow-api ls -la /app/data/backups/ 2>/dev/null || echo "No backups found"

db-shell:
	@echo "$(CYAN)Opening SQLite shell...$(RESET)"
	docker exec -it parkflow-api sqlite3 /app/apps/api-server/data/parkflow.db

# ============================================================================
# Utility Commands
# ============================================================================
health:
	@echo "$(CYAN)Checking service health...$(RESET)"
	@echo ""
	@echo "API Server:"
	@curl -s http://localhost:3000/api/health | jq . 2>/dev/null || echo "$(RED)Not reachable$(RESET)"
	@echo ""
	@echo "Admin Web:"
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:80/health 2>/dev/null || echo "$(RED)Not reachable$(RESET)"

stats:
	@echo "$(CYAN)Service Statistics$(RESET)"
	@echo ""
	@echo "$(GREEN)Docker Containers:$(RESET)"
	@docker ps --filter "name=parkflow" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "$(GREEN)Resource Usage:$(RESET)"
	@docker stats --no-stream --filter "name=parkflow" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

ps:
	docker-compose ps

# ============================================================================
# Monitoring Commands
# ============================================================================
monitoring-up:
	@echo "$(CYAN)Starting monitoring stack (Prometheus + Grafana)...$(RESET)"
	docker network create parkflow-network 2>/dev/null || true
	docker-compose -f docker-compose.monitoring.yml up -d
	@echo ""
	@echo "$(GREEN)Monitoring services started:$(RESET)"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  Grafana:    http://localhost:3001 (admin/admin)"

monitoring-down:
	@echo "$(YELLOW)Stopping monitoring stack...$(RESET)"
	docker-compose -f docker-compose.monitoring.yml down

monitoring-logs:
	docker-compose -f docker-compose.monitoring.yml logs -f

metrics:
	@echo "$(CYAN)Fetching metrics from API server...$(RESET)"
	@curl -s http://localhost:3000/metrics 2>/dev/null | head -50 || echo "$(RED)Metrics endpoint not reachable$(RESET)"

metrics-json:
	@echo "$(CYAN)Fetching JSON metrics...$(RESET)"
	@curl -s http://localhost:3000/metrics/json 2>/dev/null | jq . || echo "$(RED)Metrics endpoint not reachable$(RESET)"

# ============================================================================
# Setup Commands
# ============================================================================
setup:
	@echo "$(CYAN)Setting up development environment...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)Created .env from .env.example$(RESET)"; \
	fi
	pnpm install
	@echo "$(GREEN)Setup complete!$(RESET)"
	@echo "Run 'make dev' to start development servers."

init-db:
	@echo "$(CYAN)Initializing database with seed data...$(RESET)"
	cd apps/api-server && node -e "require('./dist/db/index.js')"
	@echo "$(GREEN)Database initialized!$(RESET)"

# ============================================================================
# Docker Swarm Commands
# ============================================================================
swarm-init:
	@echo "$(CYAN)Initializing Docker Swarm...$(RESET)"
	@docker swarm init 2>/dev/null || echo "$(YELLOW)Swarm already initialized$(RESET)"
	@echo "$(GREEN)Swarm is ready!$(RESET)"

secrets-create:
	@echo "$(CYAN)Creating Docker secrets...$(RESET)"
	@./scripts/create-secrets.sh
	@echo ""
	@echo "$(GREEN)Secrets created!$(RESET)"

secrets-create-force:
	@echo "$(YELLOW)Recreating Docker secrets (deletes existing)...$(RESET)"
	@./scripts/create-secrets.sh --force

secrets-list:
	@echo "$(CYAN)Docker Secrets:$(RESET)"
	@./scripts/create-secrets.sh --list

secrets-delete:
	@echo "$(RED)Deleting all ParkFlow secrets...$(RESET)"
	@./scripts/create-secrets.sh --delete

swarm-deploy:
	@echo "$(CYAN)Deploying to Docker Swarm...$(RESET)"
	@if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then \
		echo "$(RED)Error: Docker Swarm not initialized. Run 'make swarm-init' first.$(RESET)"; \
		exit 1; \
	fi
	@if ! docker secret ls | grep -q jwt_secret; then \
		echo "$(RED)Error: Secrets not created. Run 'make secrets-create' first.$(RESET)"; \
		exit 1; \
	fi
	docker stack deploy -c docker-compose.secrets.yml parkflow
	@echo ""
	@echo "$(GREEN)Deployed! Check status with 'make swarm-status'$(RESET)"

swarm-status:
	@echo "$(CYAN)Swarm Stack Status:$(RESET)"
	@docker stack services parkflow 2>/dev/null || echo "$(YELLOW)Stack not deployed$(RESET)"
	@echo ""
	@echo "$(CYAN)Service Replicas:$(RESET)"
	@docker service ls --filter "label=com.docker.stack.namespace=parkflow" 2>/dev/null || true

swarm-logs:
	@echo "$(CYAN)Swarm Service Logs:$(RESET)"
	docker service logs -f parkflow_api-server 2>/dev/null || echo "$(YELLOW)Service not found$(RESET)"

swarm-remove:
	@echo "$(RED)Removing Swarm stack...$(RESET)"
	@read -p "This will stop all services. Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker stack rm parkflow
	@echo "$(GREEN)Stack removed!$(RESET)"

swarm-scale:
	@if [ -z "$(REPLICAS)" ]; then \
		echo "$(RED)Error: REPLICAS parameter required$(RESET)"; \
		echo "Usage: make swarm-scale REPLICAS=3"; \
		exit 1; \
	fi
	@echo "$(CYAN)Scaling API server to $(REPLICAS) replicas...$(RESET)"
	docker service scale parkflow_api-server=$(REPLICAS)

# ============================================================================
# Alertmanager Commands
# ============================================================================
alertmanager-up:
	@echo "$(CYAN)Starting full monitoring stack with Alertmanager...$(RESET)"
	docker network create parkflow-network 2>/dev/null || true
	docker-compose -f docker-compose.monitoring.yml up -d
	@echo ""
	@echo "$(GREEN)Monitoring services started:$(RESET)"
	@echo "  Prometheus:    http://localhost:9090"
	@echo "  Grafana:       http://localhost:3001 (admin/admin)"
	@echo "  Alertmanager:  http://localhost:9093"

alertmanager-test:
	@echo "$(CYAN)Sending test alert to Alertmanager...$(RESET)"
	@curl -X POST -H "Content-Type: application/json" \
		-d '{"alerts":[{"status":"firing","labels":{"alertname":"TestAlert","severity":"warning"},"annotations":{"summary":"Test alert from Makefile"}}]}' \
		http://localhost:9093/api/v2/alerts 2>/dev/null || echo "$(RED)Alertmanager not reachable$(RESET)"
	@echo ""
	@echo "$(GREEN)Test alert sent! Check Alertmanager UI at http://localhost:9093$(RESET)"
