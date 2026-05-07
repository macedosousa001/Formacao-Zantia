# PRD — Zantia Formação

Plataforma de formação técnica (Expo Router · web + mobile) inspirada na organização do site **zantia.com**, para centralizar imagens, vídeos, PDFs, especificações técnicas e testes de aprendizagem sobre Energia e Climatização.

---

## 1. Visão geral
- **Tipo**: app full-stack React Native (Expo SDK 54) + FastAPI + MongoDB
- **Plataformas**: web (preview / browser) e mobile nativa (Expo Go / build)
- **Idioma principal**: Português (com seletor PT / EN / FR / ES)
- **Estilo**: industrial profissional — Navy `#1A365D` + Red `#D92525` + branco

## 2. Estrutura de conteúdo
5 gavetões (categorias) → gavetinhas (subitens) → sub-gavetinhas (3º nível). Distribuição inicial:

| # | Gavetão | Nº gavetinhas |
|---|---|---|
| 1 | Fotovoltaico | 11 |
| 2 | Bombas de Calor | 7 |
| 3 | Caldeiras | 3 |
| 4 | Ar Condicionado | 9 |
| 5 | Acessórios | 1 |

Todos os títulos são placeholders editáveis. Em cada gavetinha o admin coloca: descrição, especificações técnicas, imagens (base64), vídeos (URL YouTube/Vimeo), PDFs (base64), e quizzes.

## 3. Funcionalidades por papel

### Visitante (sem login)
- Navegar todas as gavetões/gavetinhas e sub-itens
- Ver imagens, vídeos, PDFs
- Fazer quizzes (resultado **não** é gravado)

### Formando (após registo + aprovação)
- Registo com **email + password + nome + telemóvel** (telemóvel obrigatório)
- Após registo entra em estado **`pending`** → não acede a conteúdo até admin aprovar
- Após aprovação:
  - Faz quizzes com resultado guardado
  - Pontuação acumulada visível no header (badge `X pts`)
  - Histórico de tentativas em `/perfil`
  - Editar nome, telefone, password
  - Ligar Telegram através de link `t.me/<bot>?start=<token>` único → recebe notificações
  - (Próxima fase) Chat bidirecional com o admin

### Administrador
- Tudo o que o formando faz +
- CRUD completo: criar/editar/eliminar gavetões e gavetinhas (3 níveis)
- Editar capa de entrada (hero)
- Editar quizzes (criar perguntas com 3 opções, marcar correta)
- Aprovar / Rejeitar formandos pendentes
- Promover formando a admin / despromover admin a formando
- Receber notificação Telegram de novos registos
- (Próxima fase) Receber e responder a perguntas dos formandos via Telegram

## 4. Quizzes
- Cada gavetão e gavetinha pode ter `N` perguntas com 3 opções e 1 correta
- Formando aprovado vê "Iniciar teste" → seleciona respostas → "Validar"
- Resultado mostrado com cores (verde correta / vermelho errada)
- Pontuação adicionada ao `score_total` do utilizador
- Tentativas guardadas em `quiz_attempts` (gavetão/gavetinha + score + total + data)

## 5. Idiomas (i18n)
Seletor visível no header com bandeiras 🇵🇹 🇬🇧 🇫🇷 🇪🇸. Persistência via AsyncStorage. Ficheiro `src/i18n.tsx` com dicionário completo nos 4 idiomas.

## 6. Notificações Telegram (gratuito)
- Bot criado pelo admin no `@BotFather` → token guardado em `.env`
- Webhook em `/api/telegram/webhook` recebe `/start <token>` e liga `chat_id` ao utilizador
- Eventos que disparam mensagem:
  - Novo registo de formando → admins recebem
  - Aprovação / Rejeição / Promoção → utilizador recebe
  - (Próxima fase) Mensagem de chat → outro lado recebe

## 7. Dados pessoais e RGPD
- Telemóvel armazenado em texto plano (MongoDB)
- Password com bcrypt
- JWT HS256, 7 dias, AsyncStorage / Bearer
- Sempre permitir alteração de dados via `PUT /api/auth/me`

## 8. Modelo de dados (MongoDB)

### users
```
{
  id, email, password_hash, name, phone,
  role: "admin" | "formando",
  status: "pending" | "approved" | "rejected",
  score_total,
  telegram_chat_id, telegram_start_token,
  created_at
}
```

### gavetoes
```
{ id, title, subtitle, image_url, quiz: [QuizQuestion], order }
```

### gavetinhas
```
{
  id, gavetao_id, parent_gavetinha_id (nullable),
  title, description, specs,
  images: [base64], videos: [url], pdfs: [{name, data}],
  quiz: [QuizQuestion],
  order, updated_at
}
```

### settings (single doc `_id="site"`)
```
{ hero_image, hero_title, hero_subtitle }
```

### quiz_attempts
```
{ id, user_id, entity_type, entity_id, entity_title, score, total, completed_at }
```

## 9. Endpoints (resumo)

### Públicos
- `GET /api/gavetoes` · `/api/gavetoes/{id}`
- `GET /api/gavetinhas/{id}` · `/api/gavetinhas/{id}/children`
- `GET /api/settings`

### Autenticação
- `POST /api/auth/register` (cria pending, exige telemóvel)
- `POST /api/auth/login`
- `GET /api/auth/me` · `PUT /api/auth/me` (editar perfil)
- `GET /api/auth/telegram-link` (link único)
- `POST /api/auth/quiz-attempts` (autenticado, aprovado)
- `GET /api/auth/quiz-attempts/me` (histórico)

### Admin
- `GET /api/auth/users` (lista todos)
- `POST /api/auth/users/{id}/action` (`approve` | `reject` | `promote` | `demote`)
- Mutações em gavetões/gavetinhas/settings (PUT/POST/DELETE)

### Telegram
- `POST /api/telegram/webhook` (recebe `/start <token>` do utilizador)

## 10. Conta de administrador (seeded)
- Email: `macedo.sousa001@gmail.com`
- Password: `448225Ms`
- Telemóvel: `964177779`
- Configurada via env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE`

## 11. Roadmap futuro
- ✅ Autenticação JWT + papéis
- ✅ Aprovação manual de formandos
- ✅ Notificações Telegram
- ⏳ Frontend completo de aprovação + perfil + ligar Telegram (próxima volta)
- ⏳ Chat bidirecional formando ↔ admin via app + Telegram
- ⏳ Painel de estatísticas/ranking de formandos
- ⏳ Conteúdo multilíngue (campos `description_pt`, `description_en` etc.)
- ⏳ App store builds (iOS/Android via Emergent publish button)

## 12. Tecnologias
- **Frontend**: Expo SDK 54, Expo Router, React Native Web, TypeScript, AsyncStorage, expo-image-picker, expo-document-picker, react-native-webview
- **Backend**: FastAPI (async), Motor (MongoDB), Pydantic, bcrypt, PyJWT, httpx (Telegram)
- **Storage**: MongoDB (imagens/PDFs em base64)
- **Notificações**: Telegram Bot API (gratuito)
