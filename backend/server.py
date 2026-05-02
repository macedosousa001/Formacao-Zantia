from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Zantia Formação API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Gavetinha(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    gavetao_id: str
    title: str
    description: str = ""
    images: List[str] = []  # base64 data URIs or http URLs
    videos: List[str] = []  # YouTube/Vimeo or direct URLs
    order: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GavetinhaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None


class Gavetao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: str = ""
    image_url: str = ""
    order: int = 0


class GavetaoUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None


class GavetaoWithChildren(Gavetao):
    gavetinhas: List[Gavetinha] = []


# ---------- Seed data ----------
SEED_DATA = [
    {
        "id": "g1",
        "title": "Fotovoltaico",
        "subtitle": "Energia solar e autoconsumo",
        "image_url": "https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=800&q=80",
        "order": 1,
        "gavetinhas": [
            "Painéis Solares", "Inversores String", "Microinversores", "Otimizadores",
            "Baterias de Lítio", "Estruturas de Fixação", "Cabos CC/CA", "Proteções CC",
            "Monitorização", "Carregadores EV", "Kits Autoconsumo"
        ]
    },
    {
        "id": "g2",
        "title": "Bombas de Calor",
        "subtitle": "Aquecimento e AQS eficiente",
        "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "order": 2,
        "gavetinhas": [
            "Split Ar-Água", "Monobloco", "AQS", "Piscina",
            "Alta Temperatura", "Geotérmica", "Acessórios BC"
        ]
    },
    {
        "id": "g3",
        "title": "Caldeiras",
        "subtitle": "Gás, gasóleo e biomassa",
        "image_url": "https://images.unsplash.com/photo-1585412727339-54e4bae3bbf9?w=800&q=80",
        "order": 3,
        "gavetinhas": [
            "Caldeiras a Gás", "Caldeiras a Gasóleo", "Caldeiras a Pellets"
        ]
    },
    {
        "id": "g4",
        "title": "Ar Condicionado",
        "subtitle": "Climatização residencial e comercial",
        "image_url": "https://images.unsplash.com/photo-1617861648989-76a572012089?w=800&q=80",
        "order": 4,
        "gavetinhas": [
            "Mural Split", "Multi-Split", "Cassete", "Conduta",
            "Consola", "Teto", "Portátil", "VRF/VRV", "Unidades Exteriores"
        ]
    },
    {
        "id": "g5",
        "title": "Acessórios",
        "subtitle": "Componentes e consumíveis",
        "image_url": "https://images.unsplash.com/photo-1581092918484-8313ea1cd5b5?w=800&q=80",
        "order": 5,
        "gavetinhas": [
            "Acessórios Gerais"
        ]
    }
]


async def seed_database():
    """Seed 5 gavetões + 31 gavetinhas if empty."""
    count = await db.gavetoes.count_documents({})
    if count > 0:
        return

    logger.info("Seeding database...")
    for g in SEED_DATA:
        gavetao = Gavetao(
            id=g["id"],
            title=g["title"],
            subtitle=g["subtitle"],
            image_url=g["image_url"],
            order=g["order"],
        )
        await db.gavetoes.insert_one(gavetao.model_dump())
        for idx, title in enumerate(g["gavetinhas"]):
            gavetinha = Gavetinha(
                gavetao_id=g["id"],
                title=title,
                description=f"Informação sobre {title}. Edite este conteúdo no modo administração.",
                images=[],
                videos=[],
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


@api_router.get("/gavetoes", response_model=List[GavetaoWithChildren])
async def list_gavetoes():
    gavetoes = await db.gavetoes.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    result = []
    for g in gavetoes:
        children = await db.gavetinhas.find(
            {"gavetao_id": g["id"]}, {"_id": 0}
        ).sort("order", 1).to_list(200)
        g["gavetinhas"] = children
        result.append(g)
    return result


@api_router.get("/gavetoes/{gavetao_id}", response_model=GavetaoWithChildren)
async def get_gavetao(gavetao_id: str):
    g = await db.gavetoes.find_one({"id": gavetao_id}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Gavetão não encontrado")
    children = await db.gavetinhas.find(
        {"gavetao_id": gavetao_id}, {"_id": 0}
    ).sort("order", 1).to_list(200)
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


@api_router.get("/gavetinhas/{gavetinha_id}", response_model=Gavetinha)
async def get_gavetinha(gavetinha_id: str):
    g = await db.gavetinhas.find_one({"id": gavetinha_id}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Gavetinha não encontrada")
    return g


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


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await seed_database()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
