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
from datetime import datetime, timezone, timedelta


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
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    country: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    password: Optional[str] = None


class AdminUserAction(BaseModel):
    action: str  # "approve" | "reject" | "promote" | "demote"


class UserOut(BaseModel):
    id: str
    email: str
    name: str = ""
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    country: str = ""
    role: str = "formando"
    status: str = "approved"  # pending | approved | rejected
    score_total: int = 0
    telegram_linked: bool = False
    telegram_start_token: str = ""
    last_seen: Optional[datetime] = None


def user_to_out(u: dict) -> "UserOut":
    return UserOut(
        id=u["id"],
        email=u["email"],
        name=u.get("name", ""),
        first_name=u.get("first_name", ""),
        last_name=u.get("last_name", ""),
        phone=u.get("phone", ""),
        country=u.get("country", ""),
        role=u.get("role", "formando"),
        status=u.get("status", "approved"),
        score_total=u.get("score_total", 0),
        telegram_linked=bool(u.get("telegram_chat_id")),
        telegram_start_token=u.get("telegram_start_token", ""),
        last_seen=u.get("last_seen"),
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
    user = await resolver(request)
    # Touch last_seen for online-tracking (best effort, don't block on failures).
    try:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_seen": datetime.now(timezone.utc)}},
        )
    except Exception:
        pass
    return user


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
    # Mark online on successful login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_seen": datetime.now(timezone.utc)}},
    )
    user["last_seen"] = datetime.now(timezone.utc)
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
    first_name = (payload.first_name or "").strip()
    last_name = (payload.last_name or "").strip()
    country = (payload.country or "").strip()
    if not first_name:
        raise HTTPException(status_code=400, detail="Indique o primeiro nome")
    if not last_name:
        raise HTTPException(status_code=400, detail="Indique o apelido")
    if not country:
        raise HTTPException(status_code=400, detail="Indique o país")
    full_name = f"{first_name} {last_name}".strip() or (payload.name or email.split("@")[0])
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já registado")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": full_name,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "country": country,
        "role": "formando",  # public registration always creates trainees
        "status": "pending",  # requires admin approval
        "telegram_start_token": telegram_bot.generate_start_token(),
        "telegram_chat_id": None,
        "created_at": datetime.now(timezone.utc),
        "last_seen": datetime.now(timezone.utc),
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
                f"Nome: {first_name} {last_name}\n"
                f"País: {country}\n"
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
    if payload.first_name is not None and payload.first_name.strip():
        update["first_name"] = payload.first_name.strip()
    if payload.last_name is not None and payload.last_name.strip():
        update["last_name"] = payload.last_name.strip()
    if "first_name" in update or "last_name" in update:
        fn = update.get("first_name", user.get("first_name", ""))
        ln = update.get("last_name", user.get("last_name", ""))
        update["name"] = f"{fn} {ln}".strip() or user.get("name", "")
    elif payload.name is not None and payload.name.strip():
        update["name"] = payload.name.strip()
    if payload.country is not None:
        update["country"] = payload.country.strip()
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


# ----- Stats / Leaderboard / Online users -----
stats_router = APIRouter(prefix="/api/auth")


def _short_name(u: dict) -> str:
    fn = (u.get("first_name") or "").strip()
    ln = (u.get("last_name") or "").strip()
    if fn and ln:
        return f"{fn} {ln[0]}."
    return u.get("name") or u.get("email", "?").split("@")[0]


@stats_router.get("/online-users")
async def online_users(_: dict = Depends(admin_only_dep)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    users = await db.users.find(
        {"last_seen": {"$gte": cutoff}},
        {"_id": 0, "password_hash": 0},
    ).sort("last_seen", -1).to_list(200)
    return {
        "online_count": len(users),
        "users": [
            {
                "id": u["id"],
                "name": _short_name(u),
                "email": u["email"],
                "country": u.get("country", ""),
                "role": u.get("role", "formando"),
                "last_seen": u.get("last_seen"),
            }
            for u in users
        ],
    }


@stats_router.get("/leaderboard")
async def leaderboard(user: dict = Depends(current_user_dep)):
    """Public ranking visible to any authed user. Hides emails."""
    users = await db.users.find(
        {"status": "approved", "role": "formando"},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "name": 1, "email": 1,
         "country": 1, "score_total": 1},
    ).to_list(1000)

    # Compute per-user attempt aggregates
    pipeline = [
        {"$match": {}},
        {"$group": {
            "_id": "$user_id",
            "tests_taken": {"$sum": 1},
            "score_sum": {"$sum": "$score"},
            "total_sum": {"$sum": "$total"},
        }},
    ]
    aggs = {}
    async for row in db.quiz_attempts.aggregate(pipeline):
        aggs[row["_id"]] = row

    rows = []
    for u in users:
        a = aggs.get(u["id"], {"tests_taken": 0, "score_sum": 0, "total_sum": 0})
        avg = (a["score_sum"] / a["total_sum"] * 100) if a["total_sum"] else 0
        rows.append({
            "user_id": u["id"],
            "name": _short_name(u),
            "country": u.get("country", ""),
            "score_total": u.get("score_total", 0),
            "tests_taken": a["tests_taken"],
            "average_percent": round(avg, 1),
            "is_me": u["id"] == user["id"],
        })

    # Sort by score_total desc, then tests_taken desc
    rows.sort(key=lambda r: (r["score_total"], r["tests_taken"]), reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    me = next((r for r in rows if r["is_me"]), None)
    total_attempts = sum(r["tests_taken"] for r in rows)
    total_score = sum(r["score_total"] for r in rows)
    avg_score = total_score / len(rows) if rows else 0
    avg_attempts = total_attempts / len(rows) if rows else 0

    return {
        "ranking": rows[:20],  # top 20
        "me": me,
        "total_users": len(rows),
        "average_score": round(avg_score, 1),
        "average_tests_taken": round(avg_attempts, 1),
    }


@stats_router.get("/my-evolution")
async def my_evolution(user: dict = Depends(current_user_dep)):
    """Returns my attempt timeline + global average per attempt index for comparison."""
    my_attempts = await db.quiz_attempts.find(
        {"user_id": user["id"]},
        {"_id": 0},
    ).sort("completed_at", 1).to_list(500)

    my_points = []
    cumulative_pct = 0.0
    cumulative_score = 0
    cumulative_total = 0
    for i, a in enumerate(my_attempts):
        pct = (a["score"] / a["total"] * 100) if a["total"] else 0
        cumulative_score += a["score"]
        cumulative_total += a["total"]
        cumulative_pct = (cumulative_score / cumulative_total * 100) if cumulative_total else 0
        my_points.append({
            "index": i + 1,
            "date": a["completed_at"],
            "title": a.get("entity_title", "Teste"),
            "score": a["score"],
            "total": a["total"],
            "percent": round(pct, 1),
            "cumulative_percent": round(cumulative_pct, 1),
        })

    # Global average per attempt index (ordinal): position-by-position average
    pipeline = [
        {"$sort": {"user_id": 1, "completed_at": 1}},
        {"$group": {
            "_id": "$user_id",
            "items": {"$push": {"score": "$score", "total": "$total"}},
        }},
    ]
    user_lists: List[List[dict]] = []
    async for row in db.quiz_attempts.aggregate(pipeline):
        user_lists.append(row["items"])

    max_len = max((len(lst) for lst in user_lists), default=0)
    global_points = []
    for i in range(max_len):
        sum_s = 0
        sum_t = 0
        n = 0
        for lst in user_lists:
            if i < len(lst):
                sum_s += lst[i]["score"]
                sum_t += lst[i]["total"]
                n += 1
        pct = (sum_s / sum_t * 100) if sum_t else 0
        global_points.append({
            "index": i + 1,
            "percent": round(pct, 1),
            "users_at_or_beyond": n,
        })

    # Per-gavetão averages (mine vs global)
    gavetoes = await db.gavetoes.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(100)
    by_gavetao = []
    for g in gavetoes:
        cursor_my = db.quiz_attempts.find(
            {"user_id": user["id"], "$or": [
                {"entity_id": g["id"]},
                {"entity_type": "gavetao", "entity_id": g["id"]},
            ]},
            {"_id": 0, "score": 1, "total": 1},
        )
        my_s = 0
        my_t = 0
        async for a in cursor_my:
            my_s += a["score"]
            my_t += a["total"]
        my_pct = (my_s / my_t * 100) if my_t else None

        cursor_all = db.quiz_attempts.find(
            {"$or": [
                {"entity_id": g["id"]},
                {"entity_type": "gavetao", "entity_id": g["id"]},
            ]},
            {"_id": 0, "score": 1, "total": 1},
        )
        all_s = 0
        all_t = 0
        async for a in cursor_all:
            all_s += a["score"]
            all_t += a["total"]
        all_pct = (all_s / all_t * 100) if all_t else None

        by_gavetao.append({
            "gavetao_id": g["id"],
            "title": g["title"],
            "my_percent": round(my_pct, 1) if my_pct is not None else None,
            "global_percent": round(all_pct, 1) if all_pct is not None else None,
        })

    return {
        "my_points": my_points,
        "global_points": global_points,
        "by_gavetao": by_gavetao,
    }


app.include_router(stats_router)


# ----- Telegram webhook -----
telegram_router = APIRouter(prefix="/api/telegram")


@telegram_router.post("/webhook")
async def telegram_webhook(request: Request):
    """Receives Telegram updates. Handles /start <token> to link chat,
    plus free-text messages from linked users -> stored as chat messages."""
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
                    "Pode escrever aqui para falar com o administrador.",
                )
                return {"ok": True}
        await telegram_bot.send_message(
            chat_id,
            "👋 Bem-vindo ao Bot Zantia Formação!\n\n"
            "Para ligar a sua conta, abra a aplicação, vá ao Perfil e toque em <b>Ligar Telegram</b>.",
        )
        return {"ok": True}

    # ===== Free-text message from a linked user → save as chat message =====
    if not text:
        return {"ok": True}
    sender = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not sender:
        await telegram_bot.send_message(
            chat_id,
            "⚠️ A sua conta Telegram não está ligada à plataforma Zantia.\n"
            "Use /start &lt;código&gt; (obtenha o link no Perfil da app).",
        )
        return {"ok": True}

    # Find admin recipient
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        return {"ok": True}

    # Save message: sender = telegram user, recipient = admin (if non-admin sender) or first admin
    if sender["id"] == admin["id"]:
        # Admin replied via Telegram. We can't tell which formando — ask them to use the app.
        await telegram_bot.send_message(
            chat_id,
            "ℹ️ Para responder a um formando específico, use o chat na app web.",
        )
        return {"ok": True}

    message = {
        "id": str(uuid.uuid4()),
        "from_user_id": sender["id"],
        "to_user_id": admin["id"],
        "from_role": sender.get("role", "formando"),
        "from_name": sender.get("name", ""),
        "text": text,
        "source": "telegram",
        "sent_at": datetime.now(timezone.utc),
        "read_at": None,
        "ai_suggestion": None,
        "ai_confident": False,
    }
    # Generate AI suggestion (best-effort)
    try:
        ai = await _generate_ai_suggestion(text, sender)
        if ai:
            message["ai_suggestion"] = ai["suggestion"]
            message["ai_confident"] = ai.get("confident", False)
    except Exception as e:
        logger.warning("AI suggestion error: %s", e)
    await db.messages.insert_one(message)

    # Notify admin via Telegram (if admin has chat linked)
    if admin.get("telegram_chat_id"):
        try:
            ai_block = ""
            if message["ai_suggestion"]:
                conf_emoji = "✅" if message["ai_confident"] else "⚠️"
                ai_block = (
                    f"\n\n{conf_emoji} <b>Sugestão AI:</b>\n<i>{message['ai_suggestion'][:400]}</i>"
                )
            await telegram_bot.send_message(
                admin["telegram_chat_id"],
                f"💬 <b>Nova mensagem de {sender.get('name','?')}</b>\n\n{text[:300]}"
                f"{ai_block}\n\n<i>Responda na app web (Admin → Chat) para o formando receber.</i>",
            )
        except Exception:
            pass

    # ACK to formando
    await telegram_bot.send_message(
        chat_id,
        "✓ Mensagem recebida. O administrador vai responder em breve.",
    )
    return {"ok": True}


app.include_router(telegram_router)


# ===== Chat (bidirectional Admin <-> Formando) =====
chat_router = APIRouter(prefix="/api/chat")

# Lazy import of AI assistant
async def _generate_ai_suggestion(message_text: str, sender: dict) -> dict:
    """Returns dict {suggestion, confident, reason} or None on failure."""
    try:
        from ai_assistant import suggest_reply
        # Build context from DB
        gavetoes = await db.gavetoes.find({}, {"_id": 0, "id": 1, "title": 1, "subtitle": 1}).to_list(20)
        gavetinhas = await db.gavetinhas.find(
            {}, {"_id": 0, "title": 1, "description": 1, "specs": 1}
        ).to_list(80)
        # Recent history (last 6 messages with this user)
        admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        admin = await db.users.find_one({"email": admin_email})
        history = []
        if admin:
            recent = await db.messages.find(
                {"$or": [
                    {"from_user_id": sender["id"], "to_user_id": admin["id"]},
                    {"from_user_id": admin["id"], "to_user_id": sender["id"]},
                ]},
                {"_id": 0, "from_user_id": 1, "from_role": 1, "text": 1},
            ).sort("sent_at", -1).limit(6).to_list(6)
            history = [
                {"role": h.get("from_role", "formando"), "text": h.get("text", "")}
                for h in reversed(recent)
            ]
        result = await suggest_reply(
            user_message=message_text,
            user_name=sender.get("name", ""),
            history=history,
            gavetoes=gavetoes,
            gavetinhas=gavetinhas,
        )
        return result
    except Exception as e:
        logger.warning("AI suggestion failed: %s", e)
        return None


class MessageIn(BaseModel):
    to_user_id: str
    text: str


@chat_router.post("/send")
async def send_message(payload: MessageIn, user: dict = Depends(current_user_dep)):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    target = await db.users.find_one({"id": payload.to_user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Destinatário não encontrado")

    # Permission: formandos can only message admins; admins can message anyone
    if user.get("role") != "admin" and target.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas pode enviar mensagens ao administrador")

    message = {
        "id": str(uuid.uuid4()),
        "from_user_id": user["id"],
        "to_user_id": target["id"],
        "from_role": user.get("role", "formando"),
        "from_name": user.get("name", ""),
        "text": text,
        "source": "app",
        "sent_at": datetime.now(timezone.utc),
        "read_at": None,
        "ai_suggestion": None,
        "ai_confident": False,
    }
    # If the sender is a formando (writing to admin from the app), generate AI suggestion
    if user.get("role") != "admin":
        try:
            ai = await _generate_ai_suggestion(text, user)
            if ai:
                message["ai_suggestion"] = ai["suggestion"]
                message["ai_confident"] = ai.get("confident", False)
        except Exception as e:
            logger.warning("AI suggestion (app msg) failed: %s", e)
    await db.messages.insert_one(message)

    # Forward to recipient's Telegram if linked
    if target.get("telegram_chat_id"):
        try:
            sender_label = (
                f"<b>{user.get('name','Admin')}</b>" if user.get("role") == "admin"
                else f"<b>{user.get('name','Formando')}</b>"
            )
            await telegram_bot.send_message(
                target["telegram_chat_id"],
                f"💬 {sender_label}:\n\n{text}",
            )
        except Exception:
            pass

    return {"ok": True, "message": {**message, "_id": None}}


@chat_router.get("/conversations")
async def list_conversations(user: dict = Depends(current_user_dep)):
    """Returns list of conversations.
    For admin: list of all formandos that ever sent/received a message OR are approved.
    For formando: just the admin contact."""
    if user.get("role") == "admin":
        # Get all formandos with last-message info
        formandos = await db.users.find(
            {"role": "formando"},
            {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "name": 1, "email": 1,
             "country": 1, "status": 1, "telegram_chat_id": 1, "last_seen": 1},
        ).to_list(500)
        rows = []
        for f in formandos:
            last = await db.messages.find_one(
                {"$or": [
                    {"from_user_id": f["id"], "to_user_id": user["id"]},
                    {"from_user_id": user["id"], "to_user_id": f["id"]},
                ]},
                sort=[("sent_at", -1)],
            )
            unread = await db.messages.count_documents({
                "from_user_id": f["id"],
                "to_user_id": user["id"],
                "read_at": None,
            })
            rows.append({
                "user_id": f["id"],
                "name": f.get("name") or f.get("email", "?"),
                "first_name": f.get("first_name", ""),
                "last_name": f.get("last_name", ""),
                "country": f.get("country", ""),
                "status": f.get("status", ""),
                "telegram_linked": bool(f.get("telegram_chat_id")),
                "last_seen": f.get("last_seen"),
                "last_message": last["text"] if last else None,
                "last_at": last["sent_at"] if last else None,
                "last_from": last["from_user_id"] if last else None,
                "unread": unread,
            })
        # Sort by last_at desc, then unread desc
        rows.sort(key=lambda r: (r["last_at"] or datetime.min.replace(tzinfo=timezone.utc), r["unread"]), reverse=True)
        return rows

    # Formando: just admin contact
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin = await db.users.find_one(
        {"email": admin_email},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "telegram_chat_id": 1},
    )
    if not admin:
        return []
    last = await db.messages.find_one(
        {"$or": [
            {"from_user_id": admin["id"], "to_user_id": user["id"]},
            {"from_user_id": user["id"], "to_user_id": admin["id"]},
        ]},
        sort=[("sent_at", -1)],
    )
    unread = await db.messages.count_documents({
        "from_user_id": admin["id"],
        "to_user_id": user["id"],
        "read_at": None,
    })
    return [{
        "user_id": admin["id"],
        "name": admin.get("name") or "Administrador",
        "first_name": admin.get("first_name", ""),
        "last_name": admin.get("last_name", ""),
        "country": "",
        "status": "approved",
        "telegram_linked": bool(admin.get("telegram_chat_id")),
        "last_seen": None,
        "last_message": last["text"] if last else None,
        "last_at": last["sent_at"] if last else None,
        "last_from": last["from_user_id"] if last else None,
        "unread": unread,
    }]


@chat_router.get("/messages/{other_user_id}")
async def get_messages(other_user_id: str, user: dict = Depends(current_user_dep)):
    other = await db.users.find_one({"id": other_user_id}, {"_id": 0, "id": 1, "name": 1, "role": 1})
    if not other:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    # Permission
    if user.get("role") != "admin" and other.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")

    msgs = await db.messages.find(
        {"$or": [
            {"from_user_id": user["id"], "to_user_id": other_user_id},
            {"from_user_id": other_user_id, "to_user_id": user["id"]},
        ]},
        {"_id": 0},
    ).sort("sent_at", 1).to_list(500)

    # Mark messages from `other` to `me` as read
    await db.messages.update_many(
        {"from_user_id": other_user_id, "to_user_id": user["id"], "read_at": None},
        {"$set": {"read_at": datetime.now(timezone.utc)}},
    )
    return {
        "messages": msgs,
        "other": {
            "user_id": other.get("id"),
            "name": other.get("name", ""),
            "role": other.get("role", "formando"),
        },
    }


@chat_router.get("/unread-count")
async def unread_count(user: dict = Depends(current_user_dep)):
    n = await db.messages.count_documents({"to_user_id": user["id"], "read_at": None})
    return {"count": n}


app.include_router(chat_router)

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
