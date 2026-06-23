# Deploy — Capta

## Serviços necessários em produção

| Serviço     | Recomendado           | Alternativa   | Custo               |
| ----------- | --------------------- | ------------- | ------------------- |
| PostgreSQL  | Neon (neon.tech)      | Supabase      | Gratuito            |
| Redis       | Upstash (upstash.com) | Railway Redis | Gratuito            |
| API hosting | Railway (railway.app) | Render        | ~$5/mês             |
| Frontend    | Vercel (vercel.com)   | Netlify       | Gratuito            |
| E-mail      | Resend (resend.com)   | —             | Gratuito até 3k/mês |

## Checklist antes do primeiro deploy

### Segurança

- [ ] Nenhum .env no repositório:
      git log --all --full-history -- "\*\*/.env"
- [ ] ADMIN_API_KEY forte:
      openssl rand -hex 32
- [ ] CORS_ORIGIN configurado com domínio real do frontend

### Banco de dados

- [ ] Criar banco PostgreSQL no Neon ou Supabase
- [ ] Copiar a connection string para DATABASE_URL
- [ ] Rodar migrations em produção:
      npx prisma migrate deploy (não migrate dev)

### Redis

- [ ] Criar instância no Upstash e copiar a URL para REDIS_URL

### E-mail

- [ ] Verificar domínio próprio no Resend para e-mails
      não caírem em spam (Configurações → Domains)
- [ ] Atualizar EMAIL_FROM para usar o domínio verificado

### Variáveis de ambiente adicionais em produção

Além das do .env.example, adicionar:

NODE_ENV=production
NEXT_PUBLIC_API_URL=https://sua-api.railway.app
CORS_ORIGIN=https://seu-frontend.vercel.app

## Como fazer o deploy

### Frontend (Vercel)

1. Acesse vercel.com e conecte o repositório GitHub
2. Configure root directory como: apps/web
3. Adicione todas as variáveis NEXT*PUBLIC*\* no painel da Vercel
4. Deploy automático a cada push na branch master

### API (Railway)

1. Acesse railway.app e conecte o repositório GitHub
2. O build usa o Dockerfile (apps/api/Dockerfile), definido em railway.json
3. Adicione todas as variáveis de ambiente no painel
4. NÃO configure um start command manual no painel: o start vem do railway.json
   (deploy.startCommand = "node apps/api/dist/index.js"). Um start command
   manual sobrescreve o railway.json/Dockerfile e quebra o caminho relativo —
   foi a causa do crash "node dist/index.js failed" (rodava a partir de /app,
   onde dist/ não existe; o dist é gerado em /app/apps/api/dist).
5. Adicione um serviço PostgreSQL e um Redis pelo próprio Railway

### Após o deploy

- [ ] Testar GET https://sua-api.railway.app/health
- [ ] Testar o fluxo completo: cadastro → busca → alerta
- [ ] Configurar domínio personalizado (opcional)
