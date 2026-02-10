// backend/ai/ollamaClient.js
import axios from 'axios';

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED_MODEL = process.env.AI_EMBED_MODEL || 'nomic-embed-text';
const CHAT_MODEL  = process.env.AI_MODEL || 'llama3';

export async function embedText(text) {
  const { data } = await axios.post(`${OLLAMA}/api/embeddings`, {
    model: EMBED_MODEL,
    prompt: text
  });
  return data.embedding; // Float32 array (JS number[])
}

export async function chatLLM({ system, user, context }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  // “context” đưa vào dưới dạng system để LLM bám vào dữ kiện
  if (context && context.length) {
    messages.push({
      role: 'system',
      content:
        "You are a helpful e-commerce assistant. Use ONLY the context below to answer. If not found, say you don't know.\n\n" +
        context.map((c, i) => `#${i+1} ${c.title}\n${c.text}`).join("\n\n")
    });
  }
  messages.push({ role: 'user', content: user });

  const { data } = await axios.post(`${OLLAMA}/api/chat`, {
    model: CHAT_MODEL,
    messages,
    stream: false
  });

  // Ollama trả về {message:{content}}
  return data?.message?.content || '';
}
