# backend/ai_service/main.py
# ─────────────────────────────────────────────────────────────────────────────
# Objekta Python AI Service — FastAPI micro-service for high-quality 3D AI.
#
# Replaces the basic JS proxy with:
#  • Structured prompt engineering tailored to 3D scene context
#  • Multi-provider fallback (Groq → Gemini → OpenAI → Anthropic)
#  • Response validation & formatting
#  • Better temperature / token tuning per task type
#
# Run:  uvicorn main:app --host 0.0.0.0 --port 8100 --reload
# ─────────────────────────────────────────────────────────────────────────────

import os, json, re, time, traceback
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import httpx

# Load .env from the backend root (parent of ai_service/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv()  # fallback: reads from cwd

# ═══════════════════════════════════════════════════════════════════════════════
#  App
# ═══════════════════════════════════════════════════════════════════════════════
app = FastAPI(title="Objekta AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
#  System prompts — much richer than the JS version
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT_CHAT = """You are **Objekta AI** — an expert 3D scene assistant embedded inside a browser-based collaborative 3D editor called Objekta (built with Three.js / React Three Fiber).

## Your domain expertise
- Physically-Based Rendering (PBR): metalness/roughness workflows, Fresnel, IOR, GGX BRDF.
- Three.js & WebGL 2.0: BufferGeometry, InstancedMesh, ShaderMaterial, render targets, FBO.
- Scene optimization: draw-call batching, LOD, instancing, texture atlasing, geometry decimation, frustum culling.
- Lighting: punctual lights, environment maps (HDR), area lights, shadow mapping (PCF, VSM), ambient occlusion.
- glTF 2.0 / GLB: extensions (KHR_draco, KHR_meshopt, KHR_texture_basisu), material variants.
- Procedural generation: noise functions, SDF, marching cubes, parametric geometry.
- Post-processing: bloom, SSAO, color grading, depth-of-field, screen-space reflections.

## Response rules
1. **Be conversational first**: When the user sends a greeting (hi, hello, hey), a thank-you, or casual small talk, respond naturally and warmly. Introduce yourself briefly as Objekta AI and offer to help with their 3D scene. Do NOT dump scene data in response to greetings.
2. **Be precise**: give exact numeric values (roughness: 0.35, metalness: 0.9, color: #C0C0C0).
3. **Be concise**: ≤ 250 words unless the user explicitly asks for detail.
4. **Reference scene data**: when scene context is provided AND the user asks about the scene, mention specific object names, triangle counts, materials.
5. **Never hallucinate**: only mention objects/properties that exist in the provided context.
6. **Use bullet points** for lists, **bold** for key terms, and `code` for property names.
7. **Action-oriented**: prefer "do X" over "you could consider X".
8. **Format numbers**: use commas for thousands (1,234,567 triangles).
9. If the scene is empty and the user asks about it, acknowledge it and suggest what to add."""

SYSTEM_PROMPT_DESCRIBE = SYSTEM_PROMPT_CHAT + """

## Task: Scene Description
Describe the current 3D scene like a technical director reviewing a shot.
Cover: objects present, their spatial arrangement, materials & colors, lighting setup, composition quality, and optimization status.
Be vivid but factual — never invent objects that aren't in the scene data."""

SYSTEM_PROMPT_MATERIAL = SYSTEM_PROMPT_CHAT + """

## Task: Material Suggestion
You are suggesting PBR material values for a 3D object. Your response MUST follow this exact format (one value per line):

roughness=<float 0-1>
metalness=<float 0-1>
color=<#hex>
preset=<material name>
description=<one paragraph explaining why these values achieve physical accuracy>

Reference real-world material databases. For example:
- Polished steel: roughness=0.15, metalness=0.95, color=#C8C8C8
- Rough wood: roughness=0.85, metalness=0.0, color=#8B6914
- Car paint: roughness=0.3, metalness=0.1, color=#CC0000 (with clear-coat)"""

SYSTEM_PROMPT_OPTIMIZE = SYSTEM_PROMPT_CHAT + """

## Task: Optimization Analysis
Analyze the scene and provide specific, actionable optimization recommendations.
For each suggestion, give:
- **What**: the specific change
- **Why**: the performance impact
- **How**: concrete steps or values

Target budgets:
- Desktop: < 2M triangles, < 200 draw calls, < 256MB VRAM
- Mobile: < 500K triangles, < 100 draw calls, < 128MB VRAM"""

SYSTEM_PROMPT_NAMES = SYSTEM_PROMPT_CHAT + """

## Task: Name Suggestions
Suggest better descriptive names for 3D objects. Names should be:
- PascalCase, max 30 characters
- Descriptive of shape, purpose, or material
- Professional (like names in a game engine asset browser)

Respond with ONLY a numbered list: 1. SuggestedName"""

# ═══════════════════════════════════════════════════════════════════════════════
#  Pydantic models
# ═══════════════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    role: str  # user | assistant | system
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    sceneContext: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    maxTokens: int = Field(default=1024, ge=64, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    task: Optional[str] = None  # chat | describe | suggest-material | optimize | suggest-names

class DescribeRequest(BaseModel):
    sceneContext: str
    provider: Optional[str] = None

class MaterialRequest(BaseModel):
    objectInfo: object  # can be str or dict from frontend
    sceneContext: Optional[str] = None
    provider: Optional[str] = None

class OptimizeRequest(BaseModel):
    sceneContext: str
    provider: Optional[str] = None

class NamesRequest(BaseModel):
    objects: list[dict]
    provider: Optional[str] = None

class AIResponse(BaseModel):
    success: bool
    text: str
    provider: str
    model: str

# ═══════════════════════════════════════════════════════════════════════════════
#  Provider adapters
# ═══════════════════════════════════════════════════════════════════════════════

TIMEOUT = 45.0

async def _groq_chat(messages: list[dict], *, model: str = "", max_tokens: int = 1024, temperature: float = 0.7) -> dict:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError("GROQ_API_KEY not set")
    model = model or os.getenv("AI_MODEL", "llama-3.3-70b-versatile")
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
        )
        r.raise_for_status()
        data = r.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return {"text": text, "provider": "groq", "model": model}


async def _gemini_chat(messages: list[dict], *, model: str = "", max_tokens: int = 1024, temperature: float = 0.7) -> dict:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set")
    model = model or os.getenv("AI_MODEL", "gemini-2.0-flash")

    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    contents = []
    for m in messages:
        if m["role"] == "system":
            continue
        contents.append({"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]})

    body: dict = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
    }
    if system_parts:
        body["systemInstruction"] = {"parts": [{"text": "\n".join(system_parts)}]}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        data = r.json()
    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    return {"text": text, "provider": "gemini", "model": model}


async def _openai_chat(messages: list[dict], *, model: str = "", max_tokens: int = 1024, temperature: float = 0.7) -> dict:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY not set")
    model = model or os.getenv("AI_MODEL", "gpt-4o-mini")
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
        )
        r.raise_for_status()
        data = r.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return {"text": text, "provider": "openai", "model": model}


async def _anthropic_chat(messages: list[dict], *, model: str = "", max_tokens: int = 1024, temperature: float = 0.7) -> dict:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    model = model or os.getenv("AI_MODEL", "claude-sonnet-4-20250514")

    system_msgs = [m["content"] for m in messages if m["role"] == "system"]
    chat_msgs = [{"role": m["role"] if m["role"] in ("user", "assistant") else "user", "content": m["content"]}
                 for m in messages if m["role"] != "system"]

    body: dict = {"model": model, "max_tokens": max_tokens, "messages": chat_msgs, "temperature": temperature}
    if system_msgs:
        body["system"] = "\n".join(system_msgs)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json=body,
        )
        r.raise_for_status()
        data = r.json()
    text = data.get("content", [{}])[0].get("text", "")
    return {"text": text, "provider": "anthropic", "model": model}


async def _ollama_chat(messages: list[dict], *, model: str = "", max_tokens: int = 1024, temperature: float = 0.7) -> dict:
    model = model or os.getenv("AI_MODEL", "gpt-oss:20b")
    host = (os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434") or "http://127.0.0.1:11434").rstrip("/")

    body = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(f"{host}/api/chat", json=body)
        r.raise_for_status()
        data = r.json()

    text = ((data.get("message") or {}).get("content")) or data.get("response", "")
    return {"text": text, "provider": "ollama", "model": model}


PROVIDER_MAP = {
    "ollama": _ollama_chat,
    "groq": _groq_chat,
    "gemini": _gemini_chat,
    "openai": _openai_chat,
    "anthropic": _anthropic_chat,
}

PROVIDER_KEY_MAP = {
    "ollama": None,
    "groq": "GROQ_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


def _available_providers() -> list[str]:
    available = []
    if os.getenv("AI_PROVIDER", "").lower() == "ollama" or os.getenv("OLLAMA_HOST"):
        available.append("ollama")
    for name, env in PROVIDER_KEY_MAP.items():
        if not env:
            continue
        if os.getenv(env):
            available.append(name)
    return available


async def _chat_with_fallback(
    messages: list[dict],
    *,
    provider: Optional[str] = None,
    model: str = "",
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> dict:
    """Try the requested provider, then fall back through others."""
    forced = provider or os.getenv("AI_PROVIDER", "")
    if forced and forced in PROVIDER_MAP:
        return await PROVIDER_MAP[forced](messages, model=model, max_tokens=max_tokens, temperature=temperature)

    order = ["ollama", "groq", "gemini", "openai", "anthropic"]
    errors = []
    for name in order:
        if name == "ollama":
            if os.getenv("AI_PROVIDER", "").lower() != "ollama" and not os.getenv("OLLAMA_HOST"):
                continue
        else:
            if not os.getenv(PROVIDER_KEY_MAP.get(name, "")):
                continue
        try:
            return await PROVIDER_MAP[name](messages, model=model, max_tokens=max_tokens, temperature=temperature)
        except Exception as e:
            errors.append(f"{name}: {e}")

    if errors:
        raise HTTPException(status_code=502, detail=f"All AI providers failed:\n" + "\n".join(errors))
    raise HTTPException(status_code=503, detail="No AI provider configured. Set AI_PROVIDER=ollama (or OLLAMA_HOST) for local Ollama, or configure cloud API keys.")


# ═══════════════════════════════════════════════════════════════════════════════
#  Helper — build messages with richer prompting
# ═══════════════════════════════════════════════════════════════════════════════

def _build_messages(system_prompt: str, scene_context: Optional[str], user_messages: list[dict]) -> list[dict]:
    out = [{"role": "system", "content": system_prompt}]
    if scene_context:
        out.append({
            "role": "system",
            "content": f"## Current 3D Scene State\n```\n{scene_context}\n```",
        })
    for m in user_messages:
        if m["role"] in ("user", "assistant"):
            out.append({"role": m["role"], "content": m["content"]})
    return out


# Task-specific tuning
TASK_SETTINGS = {
    "chat":             {"system": SYSTEM_PROMPT_CHAT,     "max_tokens": 1024, "temperature": 0.7},
    "describe":         {"system": SYSTEM_PROMPT_DESCRIBE, "max_tokens": 768,  "temperature": 0.6},
    "suggest-material": {"system": SYSTEM_PROMPT_MATERIAL, "max_tokens": 400,  "temperature": 0.4},
    "optimize":         {"system": SYSTEM_PROMPT_OPTIMIZE, "max_tokens": 1024, "temperature": 0.5},
    "suggest-names":    {"system": SYSTEM_PROMPT_NAMES,    "max_tokens": 300,  "temperature": 0.6},
}


# ═══════════════════════════════════════════════════════════════════════════════
#  Routes
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/ai/chat", response_model=AIResponse)
async def chat_endpoint(req: ChatRequest):
    task = req.task or "chat"
    settings = TASK_SETTINGS.get(task, TASK_SETTINGS["chat"])

    msgs_raw = [{"role": m.role, "content": m.content} for m in req.messages]
    messages = _build_messages(
        settings["system"],
        req.sceneContext,
        msgs_raw,
    )

    result = await _chat_with_fallback(
        messages,
        provider=req.provider,
        model=req.model or "",
        max_tokens=req.maxTokens or settings["max_tokens"],
        temperature=req.temperature if req.temperature != 0.7 else settings["temperature"],
    )
    return AIResponse(success=True, **result)


@app.post("/api/ai/describe", response_model=AIResponse)
async def describe_endpoint(req: DescribeRequest):
    messages = _build_messages(
        SYSTEM_PROMPT_DESCRIBE,
        req.sceneContext,
        [{"role": "user", "content": (
            "Describe this 3D scene in detail like a technical director reviewing a shot. "
            "Cover: objects present, spatial arrangement, materials & colors, lighting setup, "
            "composition quality, and optimization status. Be specific about triangle counts, "
            "draw calls, and texture usage."
        )}],
    )
    result = await _chat_with_fallback(messages, provider=req.provider, max_tokens=768, temperature=0.6)
    return AIResponse(success=True, **result)


@app.post("/api/ai/suggest-material", response_model=AIResponse)
async def suggest_material_endpoint(req: MaterialRequest):
    # objectInfo may be a dict or a string — normalize to string
    obj_info = req.objectInfo if isinstance(req.objectInfo, str) else json.dumps(req.objectInfo, indent=2)
    messages = _build_messages(
        SYSTEM_PROMPT_MATERIAL,
        req.sceneContext,
        [{"role": "user", "content": (
            f"Suggest physically-accurate PBR material values for this 3D object:\n\n{obj_info}\n\n"
            "Respond in this EXACT format (one per line):\n"
            "roughness=<0-1>\nmetalness=<0-1>\ncolor=#<hex>\npreset=<name>\n"
            "description=<one paragraph explaining why>"
        )}],
    )
    result = await _chat_with_fallback(messages, provider=req.provider, max_tokens=400, temperature=0.4)
    return AIResponse(success=True, **result)


@app.post("/api/ai/optimize", response_model=AIResponse)
async def optimize_endpoint(req: OptimizeRequest):
    messages = _build_messages(
        SYSTEM_PROMPT_OPTIMIZE,
        req.sceneContext,
        [{"role": "user", "content": (
            "Analyze this scene and provide specific optimization recommendations. "
            "For each suggestion give: What (the change), Why (performance impact), "
            "How (concrete steps). Target desktop and mobile budgets."
        )}],
    )
    result = await _chat_with_fallback(messages, provider=req.provider, max_tokens=1024, temperature=0.5)
    return AIResponse(success=True, **result)


@app.post("/api/ai/suggest-names", response_model=AIResponse)
async def suggest_names_endpoint(req: NamesRequest):
    obj_list = "\n".join(
        f"{i+1}. Current: \"{o.get('name','')}\" | Shape: {o.get('shape','')} | "
        f"Color: {o.get('color','')} | Material: {o.get('surface','')} | Tris: {o.get('tris','')}"
        for i, o in enumerate(req.objects)
    )
    messages = _build_messages(
        SYSTEM_PROMPT_NAMES,
        None,
        [{"role": "user", "content": (
            f"These 3D objects have generic names. Suggest better descriptive PascalCase names "
            f"(max 30 chars each):\n\n{obj_list}\n\nRespond with ONLY a numbered list."
        )}],
    )
    result = await _chat_with_fallback(messages, provider=req.provider, max_tokens=300, temperature=0.6)
    return AIResponse(success=True, **result)


@app.get("/api/ai/status")
async def status_endpoint():
    providers = _available_providers()
    return {
        "success": True,
        "configured": len(providers) > 0,
        "providers": providers,
        "activeProvider": os.getenv("AI_PROVIDER", providers[0] if providers else None),
        "service": "python",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "objekta-ai-python", "providers": _available_providers()}


# ═══════════════════════════════════════════════════════════════════════════════
#  Entrypoint
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_SERVICE_PORT", "8100"))
    print(f"[Objekta AI] Starting Python AI service on port {port}")
    print(f"[Objekta AI] Available providers: {_available_providers()}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
