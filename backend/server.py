from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Local imports after dotenv
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user_factory, get_optional_user, require_role, seed_admin,
)
import telegram_bot

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Zantia Formação API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class QuizQuestion(BaseModel):
    question: str
    options: List[str] = []
    correct_index: int = 0


class Gavetinha(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    gavetao_id: str
    parent_gavetinha_id: Optional[str] = None  # None = top-level, else sub-item
    title: str
    description: str = ""
    specs: str = ""
    images: List[str] = []
    videos: List[str] = []
    pdfs: List[dict] = []  # [{name, data}] data = base64 data URI or URL
    quiz: List[QuizQuestion] = []
    order: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GavetinhaCreate(BaseModel):
    gavetao_id: str
    parent_gavetinha_id: Optional[str] = None
    title: str
    description: str = ""


class GavetinhaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    specs: Optional[str] = None
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    pdfs: Optional[List[dict]] = None
    quiz: Optional[List[QuizQuestion]] = None
    order: Optional[int] = None


class Gavetao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: str = ""
    image_url: str = ""
    quiz: List[QuizQuestion] = []
    order: int = 0


class GavetaoCreate(BaseModel):
    title: str
    subtitle: str = ""
    image_url: str = ""


class GavetaoUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    quiz: Optional[List[QuizQuestion]] = None
    order: Optional[int] = None


# ---------- Site Settings ----------
DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&q=80"
DEFAULT_HERO_TITLE = "Energia &\nClimatização"
DEFAULT_HERO_SUBTITLE = "Fotovoltaico · Bombas de Calor · Caldeiras · Ar Condicionado · Acessórios"


class Settings(BaseModel):
    hero_image: str = DEFAULT_HERO_IMAGE
    hero_title: str = DEFAULT_HERO_TITLE
    hero_subtitle: str = DEFAULT_HERO_SUBTITLE


class SettingsUpdate(BaseModel):
    hero_image: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None


# ---------- Auth Models ----------
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""
    phone: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None


class AdminUserAction(BaseModel):
    action: str  # "approve" | "reject" | "promote" | "demote"


class UserOut(BaseModel):
    id: str
    email: str
    name: str = ""
    phone: str = ""
    role: str = "formando"
    status: str = "approved"  # pending | approved | rejected
    score_total: int = 0
    telegram_linked: bool = False
    telegram_start_token: str = ""


def user_to_out(u: dict) -> "UserOut":
    return UserOut(
        id=u["id"],
        email=u["email"],
        name=u.get("name", ""),
        phone=u.get("phone", ""),
        role=u.get("role", "formando"),
        status=u.get("status", "approved"),
        score_total=u.get("score_total", 0),
        telegram_linked=bool(u.get("telegram_chat_id")),
        telegram_start_token=u.get("telegram_start_token", ""),
    )


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str


class QuizAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    entity_type: str  # "gavetoes" or "gavetinhas"
    entity_id: str
    entity_title: str = ""
    score: int
    total: int
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuizAttemptCreate(BaseModel):
    entity_type: str
    entity_id: str
    entity_title: str = ""
    score: int
    total: int


class GavetaoWithChildren(Gavetao):
    gavetinhas: List[Gavetinha] = []


# ---------- Seed data ----------
SEED_DATA = [
    {"id": "g1", "title": "Fotovoltaico", "subtitle": "Energia solar e autoconsumo",
     "image_url": "https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=800&q=80", "order": 1,
     "gavetinhas": ["Painéis Solares", "Inversores String", "Microinversores", "Otimizadores",
                    "Baterias de Lítio", "Estruturas de Fixação", "Cabos CC/CA", "Proteções CC",
                    "Monitorização", "Carregadores EV", "Kits Autoconsumo"]},
    {"id": "g2", "title": "Bombas de Calor", "subtitle": "Aquecimento e AQS eficiente",
     "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", "order": 2,
     "gavetinhas": ["Split Ar-Água", "Monobloco", "AQS", "Piscina", "Alta Temperatura", "Geotérmica", "Acessórios BC"]},
    {"id": "g3", "title": "Caldeiras", "subtitle": "Gás, gasóleo e biomassa",
     "image_url": "https://images.unsplash.com/photo-1585412727339-54e4bae3bbf9?w=800&q=80", "order": 3,
     "gavetinhas": ["Caldeiras a Gás", "Caldeiras a Gasóleo", "Caldeiras a Pellets"]},
    {"id": "g4", "title": "Ar Condicionado", "subtitle": "Climatização residencial e comercial",
     "image_url": "https://images.unsplash.com/photo-1617861648989-76a572012089?w=800&q=80", "order": 4,
     "gavetinhas": ["Mural Split", "Multi-Split", "Cassete", "Conduta", "Consola", "Teto", "Portátil", "VRF/VRV", "Unidades Exteriores"]},
    {"id": "g5", "title": "Acessórios", "subtitle": "Componentes e consumíveis",
     "image_url": "https://images.unsplash.com/photo-1581092918484-8313ea1cd5b5?w=800&q=80", "order": 5,
     "gavetinhas": ["Acessórios Gerais"]},
]


async def seed_database():
    count = await db.gavetoes.count_documents({})
    if count > 0:
        return
    logger.info("Seeding database...")
    for g in SEED_DATA:
        gavetao = Gavetao(id=g["id"], title=g["title"], subtitle=g["subtitle"],
                          image_url=g["image_url"], order=g["order"])
        await db.gavetoes.insert_one(gavetao.model_dump())
        for idx, title in enumerate(g["gavetinhas"]):
            gavetinha = Gavetinha(
                gavetao_id=g["id"], title=title,
                description=f"Informação sobre {title}. Edite este conteúdo no modo administração.",
                order=idx + 1,
            )
            await db.gavetinhas.insert_one(gavetinha.model_dump())
    logger.info("Seed completed.")


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Zantia Formação API"}


@api_router.post("/seed")
async def seed_endpoint():
    await seed_database()
    return {"status": "ok"}


# ----- Settings -----
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    s = await db.settings.find_one({"_id": "site"}, {"_id": 0})
    if not s:
        return Settings()
    return Settings(**s)


@api_router.put("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    await db.settings.update_one(
        {"_id": "site"}, {"$set": update}, upsert=True
    )
    s = await db.settings.find_one({"_id": "site"}, {"_id": 0})
    return Settings(**(s or {}))


# ----- Gavetões -----
@api_router.get("/gavetoes", response_model=List[GavetaoWithChildren])
async def list_gavetoes():
    gavetoes = await db.gavetoes.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    result = []
    for g in gavetoes:
        # Only top-level gavetinhas (no parent)
        children = await db.gavetinhas.find(
            {"gavetao_id": g["id"], "parent_gavetinha_id": None}, {"_id": 0}
        ).sort("order", 1).to_list(500)
        g["gavetinhas"] = children
        result.append(g)
    return result


@api_router.post("/gavetoes", response_model=Gavetao)
async def create_gavetao(payload: GavetaoCreate):
    # Compute next order
    last = await db.gavetoes.find_one({}, sort=[("order", -1)], projection={"_id": 0})
    next_order = (last["order"] + 1) if last else 1
    gavetao = Gavetao(
        title=payload.title,
        subtitle=payload.subtitle,
        image_url=payload.image_url or "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80",
        order=next_order,
    )
    await db.gavetoes.insert_one(gavetao.model_dump())
    return gavetao


@api_router.get("/gavetoes/{gavetao_id}", response_model=GavetaoWithChildren)
async def get_gavetao(gavetao_id: str):
    g = await db.gavetoes.find_one({"id": gavetao_id}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Gavetão não encontrado")
    children = await db.gavetinhas.find(
        {"gavetao_id": gavetao_id, "parent_gavetinha_id": None}, {"_id": 0}
    ).sort("order", 1).to_list(500)
    g["gavetinhas"] = children
    return g


@api_router.put("/gavetoes/{gavetao_id}", response_model=Gavetao)
async def update_gavetao(gavetao_id: str, payload: GavetaoUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    result = await db.gavetoes.find_one_and_update(
        {"id": gavetao_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Gavetão não encontrado")
    return result


@api_router.delete("/gavetoes/{gavetao_id}")
async def delete_gavetao(gavetao_id: str):
    res = await db.gavetoes.delete_one({"id": gavetao_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gavetão não encontrado")
    # Cascade: delete all gavetinhas of this category
    await db.gavetinhas.delete_many({"gavetao_id": gavetao_id})
    return {"status": "deleted"}


# ----- Gavetinhas -----
@api_router.post("/gavetinhas", response_model=Gavetinha)
async def create_gavetinha(payload: GavetinhaCreate):
    # Validate gavetao exists
    g = await db.gavetoes.find_one({"id": payload.gavetao_id})
    if not g:
        raise HTTPException(status_code=404, detail="Gavetão não encontrado")
    # Validate parent exists if provided
    if payload.parent_gavetinha_id:
        parent = await db.gavetinhas.find_one({"id": payload.parent_gavetinha_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Gavetinha pai não encontrada")
    # Compute next order within same parent scope
    query = {"gavetao_id": payload.gavetao_id, "parent_gavetinha_id": payload.parent_gavetinha_id}
    last = await db.gavetinhas.find_one(query, sort=[("order", -1)], projection={"_id": 0})
    next_order = (last["order"] + 1) if last else 1
    gv = Gavetinha(
        gavetao_id=payload.gavetao_id,
        parent_gavetinha_id=payload.parent_gavetinha_id,
        title=payload.title,
        description=payload.description,
        order=next_order,
    )
    await db.gavetinhas.insert_one(gv.model_dump())
    return gv


@api_router.get("/gavetinhas/{gavetinha_id}", response_model=Gavetinha)
async def get_gavetinha(gavetinha_id: str):
    g = await db.gavetinhas.find_one({"id": gavetinha_id}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Gavetinha não encontrada")
    return g


@api_router.get("/gavetinhas/{gavetinha_id}/children", response_model=List[Gavetinha])
async def list_gavetinha_children(gavetinha_id: str):
    children = await db.gavetinhas.find(
        {"parent_gavetinha_id": gavetinha_id}, {"_id": 0}
    ).sort("order", 1).to_list(500)
    return children


@api_router.put("/gavetinhas/{gavetinha_id}", response_model=Gavetinha)
async def update_gavetinha(gavetinha_id: str, payload: GavetinhaUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.gavetinhas.find_one_and_update(
        {"id": gavetinha_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Gavetinha não encontrada")
    return result


@api_router.delete("/gavetinhas/{gavetinha_id}")
async def delete_gavetinha(gavetinha_id: str):
    # Cascade: delete all descendants
    to_delete = [gavetinha_id]
    stack = [gavetinha_id]
    while stack:
        pid = stack.pop()
        kids = await db.gavetinhas.find({"parent_gavetinha_id": pid}, {"_id": 0, "id": 1}).to_list(500)
        for k in kids:
            to_delete.append(k["id"])
            stack.append(k["id"])
    res = await db.gavetinhas.delete_many({"id": {"$in": to_delete}})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gavetinha não encontrada")
    return {"status": "deleted", "count": res.deleted_count}


app.include_router(api_router)

# Auth dependency factory
async def current_user_dep(request: Request):
    resolver = await get_current_user_factory(db)
    return await resolver(request)


async def admin_only_dep(user: dict = Depends(current_user_dep)):
    return require_role(user, ["admin"])


# ----- Auth endpoints -----
auth_router = APIRouter(prefix="/api/auth")


@auth_router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou palavra-passe inválidos")
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="A sua conta foi rejeitada pelo administrador")
    token = create_access_token(user["id"], user["email"], user["role"])
    return AuthResponse(user=user_to_out(user), access_token=token)


@auth_router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Email ou palavra-passe inválidos (mínimo 6 caracteres)")
    phone = (payload.phone or "").strip()
    if len(phone) < 6:
        raise HTTPException(status_code=400, detail="Telemóvel inválido (mínimo 6 dígitos)")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já registado")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name or email.split("@")[0],
        "phone": phone,
        "role": "formando",  # public registration always creates trainees
        "status": "pending",  # requires admin approval
        "telegram_start_token": telegram_bot.generate_start_token(),
        "telegram_chat_id": None,
        "created_at": datetime.now(timezone.utc),
        "score_total": 0,
    }
    await db.users.insert_one(user_doc)

    # Notify admin via Telegram (if linked)
    try:
        admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        admin = await db.users.find_one({"email": admin_email})
        if admin and admin.get("telegram_chat_id"):
            msg = (
                f"🆕 <b>Novo registo</b>\n\n"
                f"Nome: {user_doc['name']}\n"
                f"Email: {user_doc['email']}\n"
                f"Telemóvel: {user_doc['phone']}\n\n"
                f"Aprovação manual necessária."
            )
            await telegram_bot.send_message(admin["telegram_chat_id"], msg)
    except Exception as e:
        logger.warning("Failed admin telegram notify: %s", e)

    token = create_access_token(user_doc["id"], user_doc["email"], user_doc["role"])
    return AuthResponse(user=user_to_out(user_doc), access_token=token)


@auth_router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(current_user_dep)):
    return user_to_out(user)


@auth_router.put("/me", response_model=UserOut)
async def update_me(payload: ProfileUpdate, user: dict = Depends(current_user_dep)):
    update: dict = {}
    if payload.name is not None and payload.name.strip():
        update["name"] = payload.name.strip()
    if payload.phone is not None:
        phone = payload.phone.strip()
        if phone and len(phone) < 6:
            raise HTTPException(status_code=400, detail="Telemóvel inválido")
        update["phone"] = phone
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Palavra-passe muito curta (mínimo 6)")
        update["password_hash"] = hash_password(payload.password)
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return user_to_out(fresh)


@auth_router.get("/telegram-link")
async def telegram_link(user: dict = Depends(current_user_dep)):
    """Returns a t.me URL the user can open to link their Telegram chat."""
    token = user.get("telegram_start_token")
    if not token:
        token = telegram_bot.generate_start_token()
        await db.users.update_one({"id": user["id"]}, {"$set": {"telegram_start_token": token}})
    bot_username = await telegram_bot.get_bot_username()
    if not bot_username:
        raise HTTPException(status_code=500, detail="Telegram bot não configurado")
    return {
        "url": f"https://t.me/{bot_username}?start={token}",
        "bot_username": bot_username,
        "token": token,
        "linked": bool(user.get("telegram_chat_id")),
    }


# ----- Quiz attempts -----
@auth_router.post("/quiz-attempts", response_model=QuizAttempt)
async def submit_quiz_attempt(payload: QuizAttemptCreate, user: dict = Depends(current_user_dep)):
    if user.get("status") != "approved" and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Conta pendente de aprovação")
    attempt = QuizAttempt(
        user_id=user["id"],
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        entity_title=payload.entity_title,
        score=payload.score,
        total=payload.total,
    )
    await db.quiz_attempts.insert_one(attempt.model_dump())
    # Increment user score_total
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"score_total": payload.score}},
    )
    return attempt


@auth_router.get("/quiz-attempts/me")
async def my_attempts(user: dict = Depends(current_user_dep)):
    attempts = await db.quiz_attempts.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("completed_at", -1).to_list(200)
    fresh_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "score_total": 1})
    total_points = fresh_user.get("score_total", 0) if fresh_user else 0
    total_questions = sum(a["total"] for a in attempts)
    avg = (sum(a["score"] for a in attempts) / total_questions * 100) if total_questions else 0
    return {
        "attempts": attempts,
        "score_total": total_points,
        "tests_taken": len(attempts),
        "average_percent": round(avg, 1),
    }


# Admin-only: list all users with stats
@auth_router.get("/users")
async def list_users(_: dict = Depends(admin_only_dep)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


# Admin-only: approve / reject / promote / demote a user
@auth_router.post("/users/{user_id}/action")
async def admin_user_action(user_id: str, payload: AdminUserAction, _: dict = Depends(admin_only_dep)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    action = payload.action
    update: dict = {}
    notice = ""
    if action == "approve":
        update["status"] = "approved"
        notice = "✅ A sua conta foi <b>aprovada</b>! Já pode aceder à plataforma."
    elif action == "reject":
        update["status"] = "rejected"
        notice = "❌ A sua conta foi <b>rejeitada</b>."
    elif action == "promote":
        update["role"] = "admin"
        update["status"] = "approved"
        notice = "🎖️ Foi promovido a <b>administrador</b>."
    elif action == "demote":
        update["role"] = "formando"
        notice = "ℹ️ Passou a ter o papel de <b>formando</b>."
    else:
        raise HTTPException(status_code=400, detail="Ação inválida")

    await db.users.update_one({"id": user_id}, {"$set": update})

    # Notify the user via Telegram if linked
    if target.get("telegram_chat_id") and notice:
        try:
            await telegram_bot.send_message(target["telegram_chat_id"], notice)
        except Exception as e:
            logger.warning("Telegram notify user failed: %s", e)

    fresh = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return {"status": "ok", "user": fresh}


app.include_router(auth_router)


# ----- Telegram webhook -----
telegram_router = APIRouter(prefix="/api/telegram")


@telegram_router.post("/webhook")
async def telegram_webhook(request: Request):
    """Receives Telegram updates. Handles /start <token> to link chat to a user."""
    try:
        data = await request.json()
    except Exception:
        return {"ok": True}
    msg = data.get("message") or data.get("edited_message")
    if not msg:
        return {"ok": True}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()
    if not chat_id:
        return {"ok": True}
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else ""
        if token:
            user = await db.users.find_one({"telegram_start_token": token})
            if user:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"telegram_chat_id": str(chat_id)}},
                )
                await telegram_bot.send_message(
                    chat_id,
                    f"✅ Olá {user.get('name','')}! O seu Telegram está agora ligado à conta Zantia. "
                    "Receberá notificações importantes aqui.",
                )
                return {"ok": True}
        await telegram_bot.send_message(
            chat_id,
            "👋 Bem-vindo ao Bot Zantia Formação!\n\n"
            "Para ligar a sua conta, abra a aplicação, vá ao Perfil e toque em <b>Ligar Telegram</b>.",
        )
        return {"ok": True}
    # Non-command messages: silently ignore for MVP
    return {"ok": True}


app.include_router(telegram_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await seed_database()
    await seed_admin(db)
    await db.users.create_index("email", unique=True)
    await db.quiz_attempts.create_index([("user_id", 1), ("completed_at", -1)])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
