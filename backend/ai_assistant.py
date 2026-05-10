"""AI Assistant — gera sugestões de resposta para o admin
usando GPT-5.2 da OpenAI via Emergent universal LLM key.

Modo de operação: o formando envia uma mensagem (via app ou Telegram).
A AI gera uma sugestão de resposta com base no catálogo da Zantia.
A sugestão é apresentada ao admin no chat, que decide aprovar/editar/ignorar.
A AI assinala explicitamente quando NÃO sabe responder com confiança.
"""
import os
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
PROVIDER = "openai"
MODEL = "gpt-5.2"

SYSTEM_PROMPT = """Você é o assistente AI da Zantia Formação, uma plataforma de formação técnica em Portugal especializada em energias renováveis e climatização.

A sua função é sugerir respostas profissionais e prestáveis às mensagens dos formandos para o administrador rever antes de enviar.

REGRAS CRÍTICAS:
1. Responda SEMPRE em Português europeu (pt-PT), com tom profissional, claro e amigável.
2. Use APENAS factos do catálogo de formação fornecido abaixo. Não invente dados, preços, datas, certificações ou contactos que não estejam no catálogo.
3. Se a pergunta for SOBRE matéria do catálogo (ex: como funciona um inversor fotovoltaico, especificações de bombas de calor, conteúdo de um curso), responda com confiança usando o catálogo.
4. Se a pergunta envolver assuntos que NÃO estão no catálogo (preços, datas, marcação, certificados, processos administrativos, tópicos pessoais, opiniões, ou qualquer coisa fora do âmbito técnico), DEVE responder começando exatamente com a tag "[NÃO_SEI]" e depois explicar brevemente porquê.
5. Mantenha respostas concisas (máx 5-6 linhas, salvo quando a pergunta exija detalhe técnico).
6. Não cumprimente o formando pelo nome no início (o admin pode adicionar).
7. Termine com um convite curto a pedir mais detalhe se útil.

FORMATO DA RESPOSTA:
- Comece direto com a resposta (sem "Olá", "Caro formando", etc.)
- Se for [NÃO_SEI], comece com essa tag literal e depois explique
"""


def _build_context(gavetoes: List[dict], gavetinhas: List[dict]) -> str:
    """Build a compact textual catalog from DB rows."""
    parts: List[str] = []
    parts.append("=== CATÁLOGO ZANTIA FORMAÇÃO ===\n")
    parts.append("ÁREAS PRINCIPAIS:")
    for g in gavetoes[:10]:
        parts.append(f"- {g.get('title','')}: {g.get('subtitle','')}")
    parts.append("\nCURSOS / TÓPICOS:")
    for ga in gavetinhas[:60]:
        title = ga.get("title", "")
        desc = ga.get("description", "") or ""
        specs = ga.get("specs", "") or ""
        line = f"- {title}"
        if desc:
            line += f"\n  Descrição: {desc[:300]}"
        if specs:
            line += f"\n  Especificações: {specs[:200]}"
        parts.append(line)
    return "\n".join(parts)


async def suggest_reply(
    user_message: str,
    user_name: str,
    history: Optional[List[Dict[str, str]]] = None,
    gavetoes: Optional[List[dict]] = None,
    gavetinhas: Optional[List[dict]] = None,
) -> Dict[str, Any]:
    """Returns dict {suggestion: str, confident: bool, reason: str}.
    confident = True iff response does NOT start with [NÃO_SEI].
    """
    if not EMERGENT_LLM_KEY:
        return {
            "suggestion": "[NÃO_SEI] LLM key não configurada.",
            "confident": False,
            "reason": "missing_key",
        }
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        logger.error("emergentintegrations import failed: %s", e)
        return {
            "suggestion": "[NÃO_SEI] Biblioteca de AI indisponível.",
            "confident": False,
            "reason": "import_failed",
        }

    catalog = _build_context(gavetoes or [], gavetinhas or [])
    system = SYSTEM_PROMPT + "\n\n" + catalog

    # Build conversation context (last 6 turns)
    history_text = ""
    if history:
        for h in history[-6:]:
            role = "Formando" if h.get("role") == "formando" else "Admin"
            history_text += f"{role}: {h.get('text','')}\n"
    if history_text:
        history_text = f"\n\n=== HISTÓRICO RECENTE ===\n{history_text}"

    prompt_text = f"Mensagem do formando ({user_name}): {user_message}{history_text}"

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"zantia-suggest-{user_name[:20]}",
            system_message=system,
        ).with_model(PROVIDER, MODEL)
        response = await chat.send_message(UserMessage(text=prompt_text))
        text = (response or "").strip()
    except Exception as e:
        logger.error("LLM call failed: %s", e)
        return {
            "suggestion": "[NÃO_SEI] A AI está temporariamente indisponível. Por favor, responda manualmente.",
            "confident": False,
            "reason": f"llm_error: {e}",
        }

    if not text:
        return {
            "suggestion": "[NÃO_SEI] (resposta vazia)",
            "confident": False,
            "reason": "empty",
        }

    confident = not text.upper().startswith("[NÃO_SEI]") and not text.upper().startswith("[NAO_SEI]")
    return {
        "suggestion": text,
        "confident": confident,
        "reason": "ok" if confident else "uncertain",
    }
