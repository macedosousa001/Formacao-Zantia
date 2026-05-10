# Resumo da Migração Backend → Render + Atlas

Este documento agrega tudo o que foi preparado para migrar o backend para um host estável.

## Ficheiros criados

| Ficheiro | Propósito |
|---|---|
| `backend/render.yaml` | Render Blueprint declarando o serviço web (Python 3.11, Frankfurt, plan free) |
| `backend/Procfile` | Alternativa de start command (Heroku-style) |
| `backend/runtime.txt` | Pína a versão de Python (3.11.10) |
| `backend/requirements.deploy.txt` | Versão slim das deps (~15 pacotes vs 124) para builds rápidos no Render |
| `backend/.gitignore` | Não commitar `.env`, caches, etc. |
| `backend/.env.example` | Template das variáveis a configurar no Render |
| `backend/DEPLOY_RENDER.md` | Guia passo-a-passo completo |
| `scripts/migrate_to_atlas.py` | Migra users/gavetões/messages do Mongo local para Atlas |
| `scripts/set_telegram_webhook.sh` | Atualiza o webhook do Telegram para o novo URL |

## Sequência recomendada

```
[1] Criar cluster M0 no Atlas → obter MONGO_URL
[2] Migrar dados:
      SOURCE_URL="mongodb://localhost:27017" SOURCE_DB="test_database" \
      TARGET_URL="<atlas-url>" TARGET_DB="zantia_prod" \
      python3 scripts/migrate_to_atlas.py
[3] Push do backend para GitHub
[4] Render → New + → Blueprint → conectar repo → preencher env vars → Apply
[5] Aguardar build (~5–10 min) → obter URL público
[6] Atualizar /app/frontend/.env
        EXPO_PUBLIC_BACKEND_URL=https://zantia-api.onrender.com
[7] Rebuild PWA + push GitHub Pages
[8] BOT_TOKEN=... BACKEND_URL=... ./scripts/set_telegram_webhook.sh
[9] Testar fluxos: registo, login, quiz, chat, telegram, AI suggestion
```

## Variáveis de ambiente (obrigatórias no Render)

```
MONGO_URL              → connection string Atlas
DB_NAME                → zantia_prod
JWT_SECRET             → auto-gerado pelo Render (Blueprint)
ADMIN_EMAIL            → macedo.sousa001@gmail.com
ADMIN_PASSWORD         → (admin password atual)
ADMIN_NAME             → Macedo Sousa
ADMIN_PHONE            → 964177779
TELEGRAM_BOT_TOKEN     → 8555377937:AAHR... (token atual do @ApoioZantiaBot)
EMERGENT_LLM_KEY       → sk-emergent-... (chave atual)
```

## Custos

- **Render Free**: 750h/mês. Cold-start ~50s após 15 min idle (mitigado com UptimeRobot).
- **Atlas M0**: grátis para sempre. 512 MB / 500 conexões.
- **Total**: €0

## Dados pendentes do utilizador

- [ ] `MONGO_URL` do cluster Atlas
- [ ] URL do repositório GitHub (ex.: `github.com/macedo/zantia-backend.git`)
- [ ] Confirmação para migrar dados existentes (Sim/Não)
