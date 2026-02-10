// backend/ai/adapterClient.js
import axios from 'axios';

const PY_URL = process.env.AI_PY_URL || 'http://localhost:8000';

export async function chatLLM({ system, user, context }) {
  const { data } = await axios.post(`${PY_URL}/v1/chat`, { system, user, context }, { timeout: 120000 });
  return data?.answer || '';
}