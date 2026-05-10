# Deploy do backend Zantia Formação no Render

Guia completo passo-a-passo para migrar de `mongodb://localhost` + Emergent preview para **Render + MongoDB Atlas**.

---

## 1) MongoDB Atlas (free tier — 512 MB)

1. Conta em <https://cloud.mongodb.com/> (login Google funciona).
2. **Build a Database** → **M0 FREE** → Provider AWS → Region: **Frankfurt (eu-central-1)** ou **Paris** → Cluster name: `zantia` → **Create**.
3. **Database Access** → **Add New Database User**:
   - Username: `zantia`
   - Password: gere uma forte (anote!)
   - Role: **Read and write to any database**
4. **Network Access** → **Add IP Address** → **ALLOW ACCESS FROM ANYWHERE** (`0.0.0.0/0`) → Confirm.
5. **Database** → **Connect** → **Drivers** → Python → copie o URL:
   ```
   mongodb+srv://zantia:<password>@zantia.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=zantia
   ```
   Substitua `<password>` pela password real (URL-encoded se tiver caracteres especiais).

## 2) Push do backend para GitHub

Assumindo que o backend está em `/app/backend/`:

```bash
cd /app/backend
git init
git add .
git commit -m "Initial backend deploy"
git remote add origin https://github.com/<SEU_USER>/zantia-backend.git
git branch -M main
git push -u origin main
```

> ⚠️ Verifique que o `.env` NÃO foi commited (já está em `.gitignore`).

## 3) Criar o serviço no Render

1. Conta em <https://render.com> (login GitHub).
2. **New +** → **Blueprint** → conecte o repo `zantia-backend`.
3. Render deteta o `render.yaml` automaticamente. Confirme.
4. Antes de Deploy, vá a **Environment** e preencha as variáveis com `sync: false`:
   | Chave | Valor |
   |---|---|
   | `MONGO_URL` | (Atlas connection string completo) |
   | `ADMIN_EMAIL` | `macedo.sousa001@gmail.com` |
   | `ADMIN_PASSWORD` | `448225Ms` |
   | `ADMIN_NAME` | `Macedo Sousa` |
   | `ADMIN_PHONE` | `964177779` |
   | `TELEGRAM_BOT_TOKEN` | (token do @ApoioZantiaBot) |
   | `EMERGENT_LLM_KEY` | (chave Emergent) |
5. **Apply**. O primeiro build demora 5–10 min (instala pandas/numpy, etc.).
6. Quando estado = **Live**, copie o URL público (ex.: `https://zantia-api.onrender.com`).

### Build mais rápido (opcional)
Renomeie `requirements.deploy.txt` → `requirements.txt` (apaga o original ou renomeia para `requirements.full.txt`). Build cai de 8 min para ~2 min.

## 4) Atualizar o frontend

No `/app/frontend/.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://zantia-api.onrender.com
```

Faça novo build PWA e push para GitHub Pages:
```bash
cd /app/frontend
yarn build:web
# ... seu fluxo de deploy GitHub Pages
```

## 5) Atualizar o webhook do Telegram

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://zantia-api.onrender.com/api/telegram/webhook"}'
```

Verificar:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```
O campo `url` deve apontar para o novo backend.

## 6) Migrar dados (utilizadores, gavetões, mensagens)

Ver `scripts/migrate_to_atlas.py` na raiz do projeto.

## 7) Cuidados com o free tier

- **Cold start**: após 15 min sem tráfego, o serviço dorme. Próximo pedido demora ~50s.
- **Mitigação fácil**: configure um "keep-alive" gratuito em <https://uptimerobot.com> a fazer ping ao `/api/` a cada 5 min.
- **Atlas M0**: 500 conexões simultâneas, 512 MB storage — sobra para um caso destes.

## 8) Healthcheck

O `render.yaml` aponta para `GET /api/` (que devolve `{"message":"Zantia Formação API"}`). Render marca o serviço unhealthy se isto deixar de responder durante mais de 30s.
