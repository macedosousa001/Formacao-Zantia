# Zantia Formação — Product Requirements (PRD)

> Aplicação de formação técnica interna inspirada em zantia.com, organizada em 5 gavetões e 31+ gavetinhas com hierarquia até 3 níveis. Web + Mobile (Expo Router) + PWA. Português + Inglês + Francês + Espanhol.

## Objetivos
- Plataforma única de consulta e formação para colaboradores e parceiros (instaladores) Zantia.
- Conteúdo gerido pelo admin: imagens, vídeos, PDFs, especificações técnicas e quizzes.
- Gestão de utilizadores com aprovação manual, papéis admin/formando e pontuação de quizzes.
- Notificações & chat via Telegram (gratuito) — admin recebe novos registos, formandos recebem aprovação/mensagens; chat bidireccional ponte App↔Telegram.
- Assistente AI a sugerir respostas ao admin baseadas no catálogo (GPT-5.2 via Emergent LLM key).
- Distribuição gratuita como PWA no GitHub Pages.

## Funcionalidades implementadas

### Catálogo e conteúdo
1. **Catálogo dinâmico** com gavetões e gavetinhas (aninhamento ilimitado), hero editável, seletor de idioma.
2. **Gestão de conteúdo** (admin): imagens (base64 + dimensões sugeridas), vídeos (YouTube/Vimeo embed), PDFs, specs, quizzes.
3. **Quiz interativo** com auto-correção e gravação automática para formandos aprovados.
4. **Multi-idioma** (PT/EN/FR/ES) persistido em AsyncStorage.

### Autenticação e utilizadores
5. **JWT Auth** com bcrypt; AuthContext + authFetch + "Lembrar-me" (email+password guardados).
6. **Registo completo**: First/Last name, Country (seletor com bandeiras), Telemóvel, Email, Password.
7. **Aprovação manual**: registo cria `status=pending`. Admin aprova/rejeita/promove/despromove a partir do painel `/admin` (separadores Pendentes / Utilizadores).
8. **Perfil** (`/perfil`): editar dados pessoais, ver pontuação total, evolução, ligar Telegram via deep-link, terminar sessão.
9. **`last_seen`** atualizado em cada request autenticado → endpoint `/auth/online-users` para o admin ver quem está online (<5 min).

### Estatísticas e gamificação
10. **A minha evolução vs Média da turma** — gráfico SVG cumulativo no Home + Perfil.
11. **Comparação por área** — barras horizontais Eu vs Turma por gavetão.
12. **Ranking público** dos top-20 formandos com chip "#rank de N" para o utilizador.

### Telegram
13. **Bot `@ApoioZantiaBot`**:
    - Webhook recebe `/start <token>` e liga `chat_id` ao utilizador.
    - Notificação automática ao admin quando há novo registo (nome/email/telemóvel/país).
    - Notificação ao utilizador quando aprovado/rejeitado/promovido/despromovido.
    - **Ponte de chat**: mensagens vindas do Telegram são guardadas como `messages` e o admin pode responder a partir da app web — a resposta é encaminhada para o Telegram do formando.

### Chat bidireccional (Admin ↔ Formando)
14. **Lista de conversas** (`/chat`) — admin vê todos os formandos ordenados pela última mensagem com chips (país, status, telegram, badge de não-lidas); formando vê apenas o Administrador.
15. **Sala de chat** (`/chat/[userId]`) — bolhas estilo WhatsApp, polling 4s, marca como lido ao abrir, KeyboardAvoiding, suporte iOS/Android/Web.
16. **Sugestão AI ao admin**: cada mensagem do formando dispara uma chamada ao LLM (GPT-5.2 via `emergentintegrations`) com contexto do catálogo + últimas 6 mensagens. Card violeta acima do composer mostra:
    - Pílula de confiança `✓ Confiante` ou `⚠ Reveja` (marca `[NÃO_SEI]` quando fora do âmbito do catálogo)
    - Ações: **Editar** (carrega no input), **Enviar tal e qual**, **×** (dispensa)

### PWA & Deploy
17. **PWA**: manifest + meta tags (theme-color, apple-touch-icon, apple-mobile-web-app-capable). Service Worker **desativado** (kill-switch) para evitar problemas graves de cache em telemóvel.
18. **GitHub Pages**: build em `/zantia-app/` com `yarn build:web`.
19. **Resilência**: home com timeout 12s + estado de erro com botão "Tentar novamente" em vez de mostrar "0 áreas".

## Stack
- **Backend**: FastAPI + Motor (MongoDB) + PyJWT + bcrypt + httpx (Telegram API) + `emergentintegrations` (LLM).
- **Frontend**: Expo Router (React Native), AsyncStorage, expo-image-picker, expo-document-picker, expo-linking, react-native-safe-area-context, react-native-svg, @expo/vector-icons.
- **Database**: MongoDB (atualmente local; migração para Atlas em curso).
- **Auth**: JWT (HS256), 7 dias.
- **AI**: GPT-5.2 (OpenAI) via Emergent LLM key.
- **Deploy alvo**: Render (backend) + MongoDB Atlas (DB) + GitHub Pages (PWA).

## Modelo de dados (Mongo)
- `users`: `{id, email, password_hash, name, first_name, last_name, country, phone, role, status, score_total, telegram_chat_id, telegram_start_token, last_seen, created_at}`
- `gavetoes`: `{id, title, subtitle, image_url, quiz[], order}`
- `gavetinhas`: `{id, gavetao_id, parent_gavetinha_id, title, description, specs, images[], videos[], pdfs[], quiz[], order, updated_at}`
- `quiz_attempts`: `{id, user_id, entity_type, entity_id, entity_title, score, total, completed_at}`
- `messages`: `{id, from_user_id, to_user_id, from_role, from_name, text, source: "app"|"telegram", sent_at, read_at, ai_suggestion, ai_confident}`
- `settings`: `{_id:"site", hero_image, hero_title, hero_subtitle}`

## API
Todos prefixados com `/api`:
- **Públicos**: `GET /gavetoes`, `GET /gavetoes/{id}`, `GET /gavetinhas/{id}`, `GET /gavetinhas/{id}/children`, `GET /settings`
- **Auth pública**: `POST /auth/register` (first_name/last_name/phone/country obrigatórios), `POST /auth/login`
- **Auth (token)**: `GET /auth/me`, `PUT /auth/me`, `GET /auth/telegram-link`, `POST /auth/quiz-attempts`, `GET /auth/quiz-attempts/me`, `GET /auth/my-evolution`, `GET /auth/leaderboard`
- **Admin**: `GET /auth/users`, `POST /auth/users/{id}/action`, `GET /auth/online-users`, CRUD `gavetoes` & `gavetinhas`, `PUT /settings`
- **Chat (token)**: `GET /chat/conversations`, `GET /chat/messages/{user_id}`, `POST /chat/send`, `GET /chat/unread-count`
- **Webhook**: `POST /telegram/webhook`

## Em curso
- **Migração de backend para Render + MongoDB Atlas** — ficheiros preparados (`backend/render.yaml`, `scripts/migrate_to_atlas.py`, `DEPLOY_RENDER.md`). A aguardar do utilizador: `MONGO_URL` do Atlas e URL do repo GitHub.

## Backlog
- i18n completo nas páginas Chat e Perfil (atualmente principalmente PT).
- Histórico detalhado de tentativas de quiz (lista completa no `/perfil`, atualmente só agregados + chart).
- Notificações push (Web Push API) quando admin envia mensagem.
- Refactor: dividir `server.py` (1200+ linhas) em `routes/` (auth, chat, stats, telegram).
- UptimeRobot ping para evitar cold-start do Render free tier.
