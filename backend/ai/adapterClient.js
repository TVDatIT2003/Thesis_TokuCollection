// backend/ai/adapterClient.js
import axios from 'axios';

const PY_URL = process.env.AI_PY_URL || 'http://127.0.0.1:8000';
const REQ_TIMEOUT = Number(process.env.AI_PY_TIMEOUT_MS || 300000);
const MAX_NEW_TOKENS = Number(process.env.AI_MAX_NEW_TOKENS || 96);

export async function chatLLM({ system, user, context }) {
  const payload = {
    system,
    user,
    context,
    max_new_tokens: MAX_NEW_TOKENS,
    temperature: 0.0, // deterministic để tránh “seed”
    top_p: 1.0,
  };

  try {
    const { data } = await axios.post(`${PY_URL}/v1/chat`, payload, { timeout: REQ_TIMEOUT });
    return data?.answer || '';
  } catch (err) {
    const data = err?.response?.data;
    const detail = typeof data === 'string'
      ? data
      : (data?.error || data?.detail || err?.message || 'Unknown error from AI service');
    throw new Error(detail);
  }
}
