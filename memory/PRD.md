# Zantia Formação — Product Requirements (PRD)

> Aplicação de formação técnica interna inspirada em zantia.com, organizada em 5 gavetões e 31+ gavetinhas com hierarquia até 3 níveis. Web + Mobile (Expo Router). Português + Inglês + Francês + Espanhol.

## Objetivos
- Plataforma única de consulta e formação para colaboradores e parceiros (instaladores) Zantia.
- Conteúdo gerido pelo admin: imagens, vídeos, PDFs, especificações técnicas e quizzes.
- Gestão de utilizadores com aprovação manual, papéis admin/formando e pontuação de quizzes.
- Notificações automáticas via Telegram (gratuito) — admin recebe novos registos, formandos recebem aprovação/mensagens.

## Funcionalidades implementadas
1. **Catálogo dinâmico** com gavetões e gavetinhas (aninhamento ilimitado), com hero editável e seletor de idioma.
2. **Gestão de conteúdo** (admin): imagens (base64 + dimensões sugeridas), vídeos (YouTube/Vimeo embed), PDFs, specs, quizzes.
3. **Quiz interativo** com auto-correção e gravação automática para formandos aprovados.
4. **Multi-idioma** (PT/EN/FR/ES) persistido em AsyncStorage.
5. **JWT Auth** com bcrypt; AuthContext + authFetch.
6. **Aprovação manual de utilizadores**: registo cria `status=pending`. Admin aprova/rejeita/promove/despromove a partir do painel `/admin` (separadores Pendentes / Utilizadores).
7. **Perfil do utilizador** (`/perfil`): editar nome/telemóvel/password, ver pontuação total e histórico de quizzes, ligar Telegram via deep-link.
8. **Telegram Bot** `@ApoioZantiaBot`:
   - Webhook recebe `/start <token>` e liga `chat_id` ao utilizador.
   - Notificação automática ao admin quando há novo registo (com nome/email/telemóvel).
   - Notificação ao utilizador quando aprovado/rejeitado/promovido/despromovido.
9. **Imagens base64** em MongoDB; upload via expo-image-picker; PDFs via expo-document-picker.

## Stack
- **Backend**: FastAPI + Motor (MongoDB) + PyJWT + bcrypt + httpx (Telegram API).
- **Frontend**: Expo Router (React Native), AsyncStorage, expo-image-picker, expo-document-picker, expo-linking, react-native-safe-area-context, @expo/vector-icons.
- **Database**: MongoDB local.
- **Auth**: JWT (HS256), 7 dias.

## Modelo de dados (Mongo)
- `users`: `{id, email, password_hash, name, phone, role, status, score_total, telegram_chat_id, telegram_start_token, created_at}`
- `gavetoes`: `{id, title, subtitle, image_url, quiz[], order}`
- `gavetinhas`: `{id, gavetao_id, parent_gavetinha_id, title, description, specs, images[], videos[], pdfs[], quiz[], order, updated_at}`
- `quiz_attempts`: `{id, user_id, entity_type, entity_id, entity_title, score, total, completed_at}`
- `settings`: `{_id:"site", hero_image, hero_title, hero_subtitle}`

## API
Todos prefixados com `/api`:
- Públicos: `GET /gavetoes`, `GET /gavetoes/{id}`, `GET /gavetinhas/{id}`, `GET /gavetinhas/{id}/children`, `GET /settings`
- Auth pública: `POST /auth/register` (phone obrigatório), `POST /auth/login`
- Auth (token): `GET /auth/me`, `PUT /auth/me`, `GET /auth/telegram-link`, `POST /auth/quiz-attempts`, `GET /auth/quiz-attempts/me`
- Admin: `GET /auth/users`, `POST /auth/users/{id}/action`, CRUD `gavetoes` & `gavetinhas`, `PUT /settings`
- Webhook: `POST /telegram/webhook`

## Próximas iterações (backlog)
- **Chat bidirecional** Admin ↔ Formando (app + Telegram).
- **i18n completo** dentro de Admin / Gavetinha details / Quiz.
- **Histórico detalhado** com gráfico no perfil.
- **Notificações push** quando admin envia mensagem direta.
