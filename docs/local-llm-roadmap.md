# Local LLM Roadmap (Free, Self-Hosted)

This project now supports strict model-backed mode so AI responses come from real LLM providers, not rule templates.

## 1) Reality check

- Training a frontier model (GPT/Gemini/Claude class) from scratch is not realistic for a small team without large GPU clusters and a large budget.
- Building a strong product-level assistant for free is realistic by combining:
  - Open-weight models (Qwen, Llama, Mistral)
  - Good prompts and scene-context injection
  - Optional LoRA fine-tuning for your domain

## 2) What was implemented

- Backend strict mode via `AI_REQUIRE_LLM=true`:
  - If model is unavailable, API returns explicit error instead of pretending with canned AI text.
- Backend provider failover (`AI_PROVIDER=auto`):
   - Free providers are prioritized (`groq`, `gemini`) and local Ollama is still supported.
- Frontend analyzer respects strict mode:
  - No rule-based chat fallback unless `VITE_AI_ALLOW_RULE_FALLBACK=true`.
- Docker dev stack includes Ollama service.
- AI status now reports real readiness (`llmReady`) and Ollama model availability.

## 3) Fast path (no Docker): use free cloud models

Set `backend/.env`:

```env
AI_PROVIDER=auto
AI_REQUIRE_LLM=true
GROQ_API_KEY=...
GEMINI_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_MODEL=gemini-2.0-flash
```

Then run backend normally. The API will use a real provider response and fail over between free providers.

## 4) Start local model stack

From repo root:

```powershell
docker compose up -d mongo ollama backend frontend
docker compose exec ollama ollama pull qwen2.5:14b-instruct
```

Optional stronger model (if your GPU/RAM allows):

```powershell
docker compose exec ollama ollama pull qwen2.5:32b-instruct
```

## 5) Verify model is truly active

1. Open `GET /api/ai/status` from your backend and confirm:
   - `strictLLM: true`
   - `llmReady: true`
   - `ollama.modelReady: true`
2. In Studio AI panel, provider should show `ollama` (or `python` if the Python AI service is active).
3. If model stops, chat should now show operational error instead of fake assistant text.

## 6) Free path to improve quality further

1. Build a domain dataset from your own editor interactions:
   - User prompt
   - Scene context snapshot
   - High-quality expected answer
2. Fine-tune with QLoRA (free/open stack):
   - `unsloth` or `transformers + peft`
   - Base model: `Qwen2.5-7B-Instruct` or `Llama-3.1-8B-Instruct`
3. Export adapters and serve with Ollama or vLLM.
4. Add eval harness:
   - 100-200 fixed prompts
   - Score intent match, factual grounding to scene context, and actionability.

## 7) Suggested next build milestone

- Add streaming token responses (`/api/ai/chat/stream`) for real-time typing behavior.
- Add retrieval memory over project docs + scene metadata for longer context consistency.
