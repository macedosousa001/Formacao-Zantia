"""JWT authentication module for Zantia Formação."""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends
from typing import Optional

JWT_ALGORITHM = "HS256"
ACCESS_TTL = timedelta(days=7)  # Long-lived for app usage


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + ACCESS_TTL,
        "type": "access",
    }
    return jwt.encode(payload, get_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")


async def get_current_user_factory(db):
    """Returns a dependency that resolves the current user from request."""
    async def _resolver(request: Request) -> dict:
        token = extract_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="Não autenticado")
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizador não encontrado")
        return user
    return _resolver


async def get_optional_user(request: Request, db) -> Optional[dict]:
    token = extract_token(request)
    if not token:
        return None
    try:
        payload = decode_token(token)
    except HTTPException:
        return None
    if payload.get("type") != "access":
        return None
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    return user


def require_role(user: dict, allowed: list[str]) -> dict:
    if user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Permissão insuficiente")
    return user


async def seed_admin(db):
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    name = os.environ.get("ADMIN_NAME", "Admin")
    phone = os.environ.get("ADMIN_PHONE", "")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "phone": phone,
            "role": "admin",
            "status": "approved",
            "created_at": datetime.now(timezone.utc),
            "score_total": 0,
        })
    else:
        update = {"name": name}
        # Make sure admin has the new fields and is approved
        if not existing.get("status"):
            update["status"] = "approved"
        if existing.get("status") == "pending":
            update["status"] = "approved"
        if phone and not existing.get("phone"):
            update["phone"] = phone
        if not verify_password(password, existing.get("password_hash", "")):
            update["password_hash"] = hash_password(password)
        await db.users.update_one({"email": email}, {"$set": update})

    # Backfill: any existing users without status become "approved" so we don't break them
    await db.users.update_many(
        {"status": {"$exists": False}},
        {"$set": {"status": "approved"}},
    )
