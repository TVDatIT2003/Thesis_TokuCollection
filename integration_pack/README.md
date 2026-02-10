# Toku Adapter Integration Pack

This pack wires your LoRA/PEFT adapter into TokuCollection.

## What's inside
- `ai_service/` — FastAPI microservice that loads **TinyLlama/TinyLlama-1.1B-Chat-v1.0** with your adapter and exposes `/v1/chat`.
- `backend/ai/adapterClient.js` — Node client to call the Python service.
- `PATCH_aiController.diff` — 1‑line import change so your backend uses the adapter for chat.
- `backend/.env.additions` — env var you can add to configure the service URL.

## Quick install

### 1) Start the Python chat service
```bash
cd ai_service
cp .env.example .env   # optional, ADAPTER_DIR defaults to ./adapters/adapter_toku_v1
./run_ai_service.sh    # or run_ai_service.bat on Windows
```
This will serve on `http://localhost:8000` by default.

### 2) Point the Node backend to it
Copy `backend/ai/adapterClient.js` into your project at `backend/ai/adapterClient.js`.

Open `backend/controllers/aiController.js` and change the import:
```diff
-import { embedText, chatLLM } from '../ai/ollamaClient.js';
+import { embedText } from '../ai/ollamaClient.js';
+import { chatLLM } from '../ai/adapterClient.js';
```

Add the env var to `backend/.env` (or your shell):
```
AI_PY_URL=http://localhost:8000
```

Restart the backend.

### 3) Keep your existing embeddings
No changes are needed for embeddings. `embedText` still uses Ollama (`nomic-embed-text`). Your KB remains valid.

## Test
- Health: `GET http://localhost:8000/`
- Chat: `POST http://localhost:8000/v1/chat` with body:
```json
{"system":"You are a shopping assistant.","user":"Xin chào!","context":[{"title":"Shop","text":"Chúng tôi bán figure tokusatsu."}]}
```

If backend RAG is enabled, `/api/ai/chat` will now answer using the adapter.