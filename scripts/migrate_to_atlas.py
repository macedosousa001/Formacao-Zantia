#!/usr/bin/env python3
"""Migração one-shot: copia todas as coleções da MongoDB local para o Atlas.

Uso:
    SOURCE_URL="mongodb://localhost:27017" \
    SOURCE_DB="test_database" \
    TARGET_URL="mongodb+srv://zantia:PASS@cluster.xxxxx.mongodb.net/" \
    TARGET_DB="zantia_prod" \
    python3 scripts/migrate_to_atlas.py

Flags opcionais:
    --dry-run      apenas conta os documentos por coleção
    --drop-target  apaga as coleções do destino antes de copiar (CUIDADO)
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient

DEFAULT_COLLECTIONS = [
    "users",
    "gavetoes",
    "gavetinhas",
    "settings",
    "quiz_attempts",
    "messages",
]


async def main():
    src_url = os.environ.get("SOURCE_URL")
    src_db_name = os.environ.get("SOURCE_DB", "test_database")
    tgt_url = os.environ.get("TARGET_URL")
    tgt_db_name = os.environ.get("TARGET_DB", "zantia_prod")

    if not src_url or not tgt_url:
        print("ERRO: defina SOURCE_URL e TARGET_URL nas variáveis de ambiente.")
        print("Ex.:")
        print("  export SOURCE_URL=\"mongodb://localhost:27017\"")
        print("  export TARGET_URL=\"mongodb+srv://zantia:PASS@cluster.xxxxx.mongodb.net/\"")
        sys.exit(1)

    dry_run = "--dry-run" in sys.argv
    drop_target = "--drop-target" in sys.argv

    src = AsyncIOMotorClient(src_url)[src_db_name]
    tgt = AsyncIOMotorClient(tgt_url)[tgt_db_name]

    # Use existing collections if present; otherwise fall back to defaults.
    existing = await src.list_collection_names()
    collections = [c for c in DEFAULT_COLLECTIONS if c in existing] or existing

    print(f"\n=== Origem: {src_db_name}  →  Destino: {tgt_db_name} ===")
    print(f"Coleções a processar: {collections}")
    if dry_run:
        print("(modo --dry-run: nada será escrito)\n")
    else:
        print()

    total = 0
    for name in collections:
        src_count = await src[name].count_documents({})
        if dry_run:
            print(f"  • {name}: {src_count} documentos (origem)")
            continue
        if drop_target:
            await tgt[name].drop()
            print(f"  ▸ {name}: destino apagado")
        # Copy in batches
        batch_size = 200
        copied = 0
        async for batch_cursor in _batch(src[name].find({}, {"_id": 1}), batch_size):
            ids = [d["_id"] for d in batch_cursor]
            docs = await src[name].find({"_id": {"$in": ids}}).to_list(batch_size)
            if docs:
                await tgt[name].insert_many(docs, ordered=False)
                copied += len(docs)
        print(f"  ✓ {name}: {copied}/{src_count} copiados")
        total += copied

    if not dry_run:
        # Recreate indexes
        try:
            await tgt.users.create_index("email", unique=True)
            await tgt.quiz_attempts.create_index([("user_id", 1), ("completed_at", -1)])
            print("  ✓ índices recriados")
        except Exception as e:
            print(f"  ! aviso: índices: {e}")
        print(f"\nTOTAL: {total} documentos copiados.")
    else:
        print()


async def _batch(cursor, size):
    """Yield lists of up to `size` docs from an async cursor."""
    buf = []
    async for d in cursor:
        buf.append(d)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


if __name__ == "__main__":
    asyncio.run(main())
