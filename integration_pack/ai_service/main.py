# ai_service/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os, torch, re
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoConfig
from peft import PeftModel, PeftConfig

ADAPTER_DIR = os.getenv(
    "ADAPTER_DIR",
    os.path.join(os.path.dirname(__file__), "adapters", "adapter_toku_v1"),
)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

peft_cfg = PeftConfig.from_pretrained(ADAPTER_DIR)
BASE_NAME = peft_cfg.base_model_name_or_path

cfg = AutoConfig.from_pretrained(BASE_NAME)
try:
    cfg.attn_implementation = "sdpa"
except Exception:
    pass

tokenizer = AutoTokenizer.from_pretrained(BASE_NAME, use_fast=True)
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_NAME,
    torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
    device_map="auto" if DEVICE == "cuda" else None,
    config=cfg
)
model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
if DEVICE == "cpu":
    model = model.to("cpu")
model.eval()

# warmup
try:
    _in = tokenizer("hello", return_tensors="pt").to(model.device)
    _ = model.generate(**_in, max_new_tokens=8)
except Exception:
    pass

app = FastAPI(title="Toku Adapter Chat Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class KBItem(BaseModel):
    title: Optional[str] = ""
    text: str

class ChatIn(BaseModel):
    user: str
    system: Optional[str] = None
    context: Optional[List[KBItem]] = None
    max_new_tokens: int = 96
    temperature: float = 0.0
    top_p: float = 1.0

def strip_meta(s: str) -> str:
    """Gỡ lời dẫn kiểu 'Sure, here is...' ở đầu và các thẻ SYSTEM/CONTEXT..."""
    t = str(s or "").strip()
    # Gỡ tag kỹ thuật (đầu dòng)
    t = re.sub(r"^\s*\[(SYSTEM|CONTEXT|USER|ASSISTANT)\].*$", "", t,
               flags=re.IGNORECASE | re.MULTILINE).strip()

    # Gỡ lời dẫn (2 vòng cho 'Sure. Here’s ...')
    lead = re.compile(
        r"^\s*(?:sure|okay|ok|of course|here'?s|here\s+(?:is|are)|"
        r"below\s+(?:is|are)|the\s+revised\s+version|revised\s+version|"
        r"dưới\s+đây\s+là|sau\s+đây\s+là|đây\s+là)\s*[:\-–]?\s*",
        re.IGNORECASE
    )
    for _ in range(2):
        t = lead.sub("", t).strip()

    return t

def build_input_ids(system: Optional[str], context: Optional[List[KBItem]], user: str):
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    if context:
        ctx = "\n\n".join([f"#{i+1} {c.title}\n{c.text}" for i, c in enumerate(context)])
        # context như 1 lượt user riêng để tránh coi là hướng dẫn
        msgs.append({"role": "user", "content": f"CONTEXT:\n{ctx}\n(Chỉ dùng khi liên quan)"})
    msgs.append({"role": "user", "content": user})

    try:
        return tokenizer.apply_chat_template(
            msgs, add_generation_prompt=True, return_tensors="pt"
        ).to(model.device)
    except Exception:
        prompt_parts = []
        if system:
            prompt_parts.append(f"<<SYS>>\n{system}\n<</SYS>>")
        if context:
            prompt_parts.append(f"[CONTEXT]\n{ctx}\n")
        prompt_parts.append(f"[INST] {user} [/INST]")
        prompt = "\n\n".join(prompt_parts)
        return tokenizer(prompt, return_tensors="pt").to(model.device)

@app.get("/")
def root():
    return {"ok": True, "base": BASE_NAME, "adapter_dir": ADAPTER_DIR, "device": DEVICE}

@app.post("/v1/chat")
def chat(in_: ChatIn):
    try:
        max_new = min(max(in_.max_new_tokens or 1, 1), 256)
        input_ids = build_input_ids(in_.system, in_.context, in_.user)

        # Giới hạn ngữ cảnh để an toàn
        max_ctx_model = int(getattr(model.config, "max_position_embeddings",
                                    getattr(tokenizer, "model_max_length", 4096)))
        ctx_budget = max(256, max_ctx_model - max_new - 16)
        if input_ids.shape[1] > ctx_budget:
            input_ids = input_ids[:, -ctx_budget:]

        gen = model.generate(
          input_ids,
          max_new_tokens=max_new,
          do_sample=False,
          temperature=0.0,
          top_p=1.0,
          no_repeat_ngram_size=4,
          repetition_penalty=1.1,
          pad_token_id=tokenizer.eos_token_id or tokenizer.pad_token_id,
          eos_token_id=tokenizer.eos_token_id or tokenizer.pad_token_id,
          use_cache=True,
        )
        out = tokenizer.decode(gen[0][input_ids.shape[1]:], skip_special_tokens=True)
        out = strip_meta(out)
        return {"answer": out}
    except Exception as e:
        import traceback
        print("!! chat() error:\n", traceback.format_exc())
        return JSONResponse(status_code=500, content={"error": str(e)})
