.PHONY: up down dev kill-dev seed migrate reset logs help

# ── Infraestrutura ────────────────────────────────────────────────────────────

up: ## Sobe Postgres + Redis
	@echo "▶  Subindo Postgres e Redis..."
	@docker start capta_postgres 2>/dev/null || \
		docker run -d --name capta_postgres \
			-e POSTGRES_USER=capta \
			-e POSTGRES_PASSWORD=capta \
			-e POSTGRES_DB=capta \
			-p 5432:5432 \
			postgres:16-alpine
	@docker start capta_redis 2>/dev/null || \
		docker run -d --name capta_redis \
			-p 6379:6379 \
			redis:7-alpine
	@echo "⏳ Aguardando Postgres ficar pronto..."
	@until docker exec capta_postgres pg_isready -U capta -q 2>/dev/null; do sleep 1; done
	@echo "✅ Infraestrutura pronta!"

down: ## Para Postgres + Redis
	@echo "⏹  Parando containers..."
	@docker stop capta_postgres capta_redis 2>/dev/null || true
	@echo "✅ Containers parados."

# ── Banco de dados ────────────────────────────────────────────────────────────

migrate: up ## Roda as migrations do Prisma
	@echo "▶  Rodando migrations..."
	@cd packages/db && npx prisma migrate dev --name init
	@echo "✅ Migrations aplicadas!"

seed: up ## Popula o banco com dados de exemplo
	@echo "▶  Populando banco..."
	@npm run db:seed --workspace=packages/db
	@echo "✅ Seed concluído!"

reset: up ## Reseta o banco e repopula do zero
	@echo "⚠️  Resetando banco..."
	@cd packages/db && npx prisma migrate reset --force
	@npm run db:seed --workspace=packages/db
	@echo "✅ Banco resetado e populado!"

# ── Desenvolvimento ───────────────────────────────────────────────────────────

dev: up kill-dev ## Sobe tudo: infra + API + frontend
	@echo "▶  Iniciando API e frontend..."
	@npm run dev

kill-dev: ## Para processos dev anteriores (Next.js / tsx)
	@pkill -f "next dev" 2>/dev/null || true
	@pkill -f "tsx watch" 2>/dev/null || true
	@pkill -f "turbo dev" 2>/dev/null || true
	@sleep 1

# ── Utilitários ───────────────────────────────────────────────────────────────

logs: ## Mostra logs dos containers
	@docker logs -f capta_postgres

studio: ## Abre o Prisma Studio (interface visual do banco)
	@cd packages/db && npx prisma studio

help: ## Lista todos os comandos disponíveis
	@echo ""
	@echo "Comandos disponíveis:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36mmake %-12s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help
