# Zantia Formação — Guia de Publicação Gratuita (PWA)

A app já está configurada como **Progressive Web App (PWA)**. Isto significa que pode ser instalada no telemóvel/desktop diretamente do browser, sem precisar de loja Apple/Google. Abaixo está como exportar e publicar **gratuitamente**.

## 1. Construir a versão web

A partir de `/app/frontend/`:

```bash
yarn build:web
```

Isto gera uma pasta `dist/` com:
- HTML estático (cada rota do expo-router fica como ficheiro `.html`)
- Bundle JS otimizado
- Service Worker (`/sw.js`)
- Manifest PWA (`/manifest.webmanifest`)
- Ícones e assets

## 2. Configurar a URL do backend

O frontend lê o backend via `EXPO_PUBLIC_BACKEND_URL` (ver `frontend/.env`). Antes de fazer build para produção:

1. Garante que tens o backend a correr publicamente (Railway, Fly.io, Render, etc.).
2. No `.env`, define o URL público: `EXPO_PUBLIC_BACKEND_URL=https://seu-backend.com`.
3. Volta a executar `yarn build:web`.

> **No ambiente Emergent**, o backend já está exposto em `https://renewable-skills-hub.preview.emergentagent.com/api/*`, e o `.env` já está configurado.

## 3. Publicar gratuitamente — opções recomendadas

### Opção A — Cloudflare Pages (recomendado, mais generoso)
- Conta gratuita: 500 builds/mês, bandwidth ilimitado, edge worldwide.
- 1) `npm i -g wrangler`
- 2) `wrangler pages deploy dist --project-name=zantia-formacao`
- 3) URL ficará tipo `https://zantia-formacao.pages.dev`.

### Opção B — Netlify
- Conta gratuita: 100 GB bandwidth/mês.
- 1) `npm i -g netlify-cli`
- 2) `netlify deploy --dir=dist --prod`
- Ou drag-and-drop da pasta `dist/` em https://app.netlify.com/drop.

### Opção C — Vercel
- Conta gratuita: 100 GB bandwidth/mês.
- 1) `npm i -g vercel`
- 2) `cd frontend && vercel --prod` (apontar a `dist/` quando perguntar).
- Ou conectar repositório GitHub em vercel.com (auto-deploy on push).

### Opção D — GitHub Pages
- Gratuito, sem limites práticos.
- 1) Cria um repo `zantia-formacao`.
- 2) Faz push da pasta `dist/` para a branch `gh-pages`:
  ```bash
  cd dist
  git init && git checkout -b gh-pages
  git add . && git commit -m "deploy"
  git remote add origin git@github.com:USER/zantia-formacao.git
  git push -u origin gh-pages --force
  ```
- 3) No GitHub, Settings → Pages → Branch `gh-pages`. URL: `https://USER.github.io/zantia-formacao/`.

## 4. Backend gratuito (opcional)

Se quiseres replicar o backend (FastAPI + MongoDB) também gratuito:
- **Render Free** — 512 MB RAM, 750h/mês (suspende após inatividade).
- **Railway** — $5 grátis/mês, MongoDB add-on.
- **Fly.io** — 3 VMs grátis com 256 MB cada.
- **MongoDB Atlas Free** — 512 MB de DB para sempre.

Variáveis a configurar no host:
```
MONGO_URL=mongodb+srv://...
DB_NAME=zantia
JWT_SECRET=<random_64chars>
ADMIN_EMAIL=macedo.sousa001@gmail.com
ADMIN_PASSWORD=448225Ms
ADMIN_NAME=Macedo Sousa
ADMIN_PHONE=964177779
TELEGRAM_BOT_TOKEN=<seu_token>
```

E re-registar o webhook do Telegram apontando ao novo URL:
```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://novo-backend.com/api/telegram/webhook"
```

## 5. Instalar como app no telemóvel

Depois de publicada:
- **Android (Chrome)**: visita o site → menu (⋮) → "Adicionar ao ecrã principal" / "Instalar app".
- **iOS (Safari)**: visita o site → botão Partilhar → "Adicionar ao ecrã principal".
- **Desktop (Chrome/Edge)**: aparece um ícone de instalar (⊕) na barra de endereço.

A app funcionará offline (cache automático via Service Worker) e abrirá em modo standalone (sem barra do browser).

## Notas técnicas
- O Service Worker (`/sw.js`) faz cache-first dos assets estáticos e network-first das navegações; nunca faz cache do `/api/*` (sempre dados frescos).
- O manifest define `theme_color: #D92525` (vermelho Zantia) e `background_color: #1A365D` (navy).
- Os ícones são renderizados a partir de `assets/images/icon.png` (precisa ser pelo menos 512×512 para boa qualidade no Android).
