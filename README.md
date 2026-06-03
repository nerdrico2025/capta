# Capta — Agregador de Oportunidades para o Terceiro Setor

## Sobre

Plataforma que centraliza editais do Transferegov, SALIC, fundações privadas
e leis de incentivo fiscal para organizações da sociedade civil brasileiras.

## Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Fastify, TypeScript, Prisma ORM
- **Banco:** PostgreSQL + Redis
- **IA:** OpenAI gpt-4o-mini (resumos em linguagem simples)
- **E-mail:** Resend
- **Infra:** Docker Compose, Turborepo

## Pré-requisitos

- Node.js 22+
- Docker Desktop ou OrbStack

## Setup local

```bash
# 1. Clone o repositório
git clone https://github.com/nerdrico2025/capta.git
cd capta

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edite os arquivos .env com suas chaves

# 4. Suba o banco e o cache
docker-compose up -d

# 5. Rode as migrations
cd packages/db && npx prisma migrate dev

# 6. Popule com dados de exemplo
npm run seed

# 7. Inicie o projeto completo
npm run dev
```

## Variáveis de ambiente necessárias

| Variável            | Onde obter                         |
| ------------------- | ---------------------------------- |
| `DATABASE_URL`      | Gerado pelo Docker Compose         |
| `REDIS_URL`         | Gerado pelo Docker Compose         |
| `OPENAI_API_KEY`    | platform.openai.com                |
| `RESEND_API_KEY`    | resend.com                         |
| `EMAIL_FROM`        | Domínio verificado no Resend       |
| `ADMIN_SECRET`      | Gere um token seguro               |
| `VAPID_PUBLIC_KEY`  | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |

## Rodando os testes

```bash
npm test
```

## Estrutura do projeto

```
capta/
├── apps/
│   ├── api/          # Backend Fastify
│   └── web/          # Frontend Next.js
├── packages/
│   ├── db/           # Prisma schema + migrations + seed
│   └── shared/       # Tipos e utilitários compartilhados
├── docker-compose.yml
└── turbo.json
```

## Fontes de dados

| Fonte        | Tipo                     | Frequência |
| ------------ | ------------------------ | ---------- |
| Transferegov | Governo Federal          | Diária     |
| SALIC        | Lei Rouanet              | Diária     |
| GIFE         | Fundações privadas       | Semanal    |
| ABC          | Cooperação internacional | Semanal    |

## Funcionalidades

- Ingestão automatizada de editais de múltiplas fontes
- Enriquecimento por IA com resumos em linguagem simples
- Indicador de compatibilidade por CNPJ da organização
- Alertas por e-mail e push (PWA) para novas oportunidades
- Painel de submissão para institutos parceiros
- Exportação de resultados em PDF e CSV
- Pipeline de validação e deduplicação de dados

## Licença

MIT
