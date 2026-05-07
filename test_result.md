#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Zantia Formação - training app with hierarchical content (gavetões/gavetinhas), media uploads,
  interactive quizzes with scoring, multi-language (PT/EN/FR/ES), JWT auth with admin/formando roles,
  manual user approval workflow, and Telegram bot integration for admin notifications & user linking.

backend:
  - task: "Auth - register with phone + status=pending + Telegram notify admin"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/auth/register now requires phone (>=6 chars), creates user with status='pending', generates telegram_start_token, and sends a Telegram notification to admin if admin's chat is linked. Returns AuthResponse with extended UserOut (status, phone, telegram_linked, telegram_start_token)."
      - working: true
        agent: "testing"
        comment: "PASS. Register with valid phone returns UserOut with status=pending, phone echoed back, telegram_start_token=non-empty 16-char string, telegram_linked=false. Missing phone -> 400 'Telemóvel inválido (mínimo 6 dígitos)'. Short phone (<6) -> 400 same message. Email/password validation also working. access_token returned."

  - task: "Auth - login blocks rejected users + returns extended UserOut"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/auth/login now returns 403 for status='rejected' users and returns full UserOut payload via user_to_out helper."
      - working: true
        agent: "testing"
        comment: "PASS. Admin login -> 200 role=admin status=approved with full UserOut. Pending user login -> 200 status=pending. After admin sets action=reject, that user's login -> 403 with detail 'A sua conta foi rejeitada pelo administrador' (contains 'rejeitada'). UserOut payload includes phone, status, telegram_linked, telegram_start_token, score_total."

  - task: "Auth - PUT /api/auth/me to update profile"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "PUT /api/auth/me accepts {name, phone, password} optionally and updates the authenticated user. Validates min length for phone and password."
      - working: true
        agent: "testing"
        comment: "PASS. PUT /auth/me with {name:'Novo Nome', phone:'912000000'} -> 200 returns updated UserOut with new name and phone. PUT with {password:'abc'} -> 400 'Palavra-passe muito curta (mínimo 6)'. GET /auth/me with admin token returns all UserOut fields."

  - task: "Auth - GET /api/auth/telegram-link returns t.me URL"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Returns {url: 'https://t.me/ApoioZantiaBot?start=<token>', bot_username, token, linked} so user can deep-link Telegram. Generates token if missing."
      - working: true
        agent: "testing"
        comment: "PASS. Authenticated GET returns url='https://t.me/ApoioZantiaBot?start=<token>', bot_username='ApoioZantiaBot', token=user's telegram_start_token, linked=false."

  - task: "Auth - POST /api/auth/users/{id}/action (approve|reject|promote|demote)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Admin-only. Performs the action and notifies the target user via Telegram if their chat is linked."
      - working: true
        agent: "testing"
        comment: "PASS. GET /auth/users without token -> 401. With non-admin token -> 403 'Permissão insuficiente'. With admin token -> 200 list including new pending user. approve -> status=approved (verified via /auth/users). reject -> status=rejected (verified via login 403). promote -> role=admin & status=approved. demote -> role=formando. Bad user_id -> 404. Invalid action -> 400 'Ação inválida'."

  - task: "Telegram webhook - POST /api/telegram/webhook /start <token> linking"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Receives Telegram updates. On '/start <token>', looks up user by telegram_start_token and saves the chat_id, then sends a confirmation message. Webhook URL has been registered with Telegram (bot username ApoioZantiaBot)."
      - working: true
        agent: "testing"
        comment: "PASS. /start (no token) -> 200 {ok:true}. /start <valid_token> with chat.id=99999 -> 200, then GET /auth/me for that user reports telegram_linked=true. Webhook is silent on unknown commands."

  - task: "Quiz attempts blocks pending users"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/auth/quiz-attempts now returns 403 if user.status != 'approved' and not admin."
      - working: true
        agent: "testing"
        comment: "PASS. POST /auth/quiz-attempts as pending user -> 403 'Conta pendente de aprovação'. As approved user -> 200 with persisted attempt and incremented score_total."

  - task: "seed_admin updates ADMIN_PHONE and forces status=approved"
    implemented: true
    working: true
    file: "/app/backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "On startup, seed_admin now also writes phone, sets status=approved (or backfills it), and backfills status=approved on any legacy user that lacks it."
      - working: true
        agent: "testing"
        comment: "PASS. After login as admin, UserOut shows phone='964177779' and status='approved', confirming seed_admin populates phone from ADMIN_PHONE env and forces status=approved on the existing admin record."

frontend:
  - task: "Login screen - phone field on register"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/login.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added Telemóvel field (required, >=6) in register mode; passes phone to register()."

  - task: "Home screen - pending banner + login/profile/logout in header"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Header now shows Entrar btn when logged out, or user badge (with score pill, profile link, logout). Admin link is restricted to admins. Pending status shows yellow banner with link Telegram + edit profile actions."

  - task: "Profile screen /perfil with edit, telegram link, history"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/perfil.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New screen: edit name/phone/password, link Telegram via t.me URL (Linking.openURL), show stats and history of quiz attempts."

  - task: "Admin panel - tabs Gavetões / Pendentes / Utilizadores"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Three tabs. Pending tab lists status=pending users with Aprovar/Rejeitar. Users tab lists all with chips (role/status/telegram/score) and contextual actions (promote/demote/approve/reactivate)."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Backend rewritten to fully support manual user approval flow + Telegram bot integration.
      New/updated endpoints: register (now needs phone + creates pending user), login (blocks rejected),
      PUT /me, /telegram-link, /users/{id}/action, /telegram/webhook.
      Webhook is already registered against https://api.telegram.org -> /api/telegram/webhook (bot @ApoioZantiaBot).
      Admin credentials: macedo.sousa001@gmail.com / 448225Ms.
      Please test:
      1) Register a new formando with phone -> expect status=pending in response.
      2) Login as formando with status=pending -> still ok, just status=pending.
      3) Login admin and call GET /api/auth/users (should return list including the new pending user).
      4) POST /api/auth/users/{pending_id}/action with {action:"approve"} -> user status becomes approved.
      5) Try POST /api/auth/users/{x}/action without admin token -> 403.
      6) GET /api/auth/telegram-link as authenticated user -> returns t.me URL with start token.
      7) POST /api/telegram/webhook with body {"message":{"chat":{"id":12345},"text":"/start <invalid_token>"}} -> 200 ok, no crash.
      8) POST /api/telegram/webhook with body {"message":{"chat":{"id":99999},"text":"/start <valid_token>"}} where valid_token is a user's telegram_start_token -> next /api/auth/me for that user should return telegram_linked=true.
      9) POST /api/auth/quiz-attempts as a pending user -> 403.
      10) Login as a rejected user -> 403.
  - agent: "testing"
    message: |
      Backend retest complete — ALL 28 scenarios PASS (see /app/backend_test.py).
      Verified:
      • register requires phone>=6 (rejects empty/short with 400); returns UserOut with status=pending, phone, telegram_start_token, telegram_linked=false, plus access_token.
      • admin login -> 200 role=admin status=approved phone=964177779 (seed_admin populated phone correctly and forced status=approved).
      • pending user login -> 200 status=pending. rejected user login -> 403 ("rejeitada").
      • GET /auth/me returns full extended UserOut. PUT /auth/me updates name+phone, rejects short password (400).
      • GET /auth/telegram-link returns {url:"https://t.me/ApoioZantiaBot?start=<token>", bot_username:"ApoioZantiaBot", token, linked:false}.
      • GET /auth/users: 401 no-token, 403 non-admin, 200 admin (lists pending user). Action endpoint: approve/reject/promote/demote all working; bad id -> 404, invalid action -> 400.
      • Quiz attempts blocked for pending (403) and accepted for approved (200).
      • Telegram webhook /start with no/invalid token returns 200 ok; /start <valid_token> sets telegram_chat_id and subsequent /auth/me reports telegram_linked=true.
      • GET /api/gavetoes still returns 5 categories with nested gavetinhas.
      Note: Backend logs show 400 "chat not found" warnings from Telegram when notifying admin/user with synthetic chat_ids — expected and handled gracefully (try/except).
      No further backend testing needed.