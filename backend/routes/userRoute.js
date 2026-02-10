import express from 'express';
import { loginUser,registerUser,adminLogin } from '../controllers/userController.js';
import mongoose from 'mongoose';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import productModel from '../models/productModel.js';

// ===== KB Schema (lưu chunk kiến thức + vector) =====
const kbSchema = new mongoose.Schema(
  {
    title: String,
    text: String,                    // 1 chunk nội dung
    tags: [String],
    embedding: { type: [Number], default: [] }, // vector float
    source: { type: String, default: 'kb' }     // 'kb' | 'product'
  },
  { timestamps: true }
);
const KB = mongoose.models.KB || mongoose.model('KB', kbSchema);

// ===== Utilities: Embedding (Ollama), cosine, chunk =====
async function embedText(text) {
  if (!text) return [];
  const r = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
      prompt: text
    })
  });
  const data = await r.json();
  return data?.embedding || [];
}

function cosineSim(a, b) {
  if (!a?.length || !b?.length) return 0;
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-12);
}

// Cắt văn bản dài thành các đoạn ~800–1200 ký tự
function chunkText(text, maxLen = 1200) {
  if (!text) return [];
  const sents = text.split(/(?<=[.!?])\s+/);
  const out = [];
  let buf = '';
  for (const s of sents) {
    if ((buf + ' ' + s).length > maxLen) { if (buf) out.push(buf.trim()); buf = s; }
    else { buf = buf ? buf + ' ' + s : s; }
  }
  if (buf) out.push(buf.trim());
  return out;
}


const userRouter = express.Router();

userRouter.post('/register',registerUser)
userRouter.post('/login',loginUser)
userRouter.post('/admin',adminLogin)

// ===== Nạp/huấn luyện KB từ policy/FAQ (admin) =====
userRouter.post('/kb/upsert', adminAuth, async (req, res) => {
  try {
    const { title, text, tags = [] } = req.body;
    if (!title || !text) return res.json({ success:false, message:'title & text required' });

    const chunks = chunkText(text);
    const embs = await Promise.all(chunks.map(embedText));
    const docs = chunks.map((t, i) => ({ title, text: t, tags, embedding: embs[i], source: 'kb' }));

    await KB.insertMany(docs);
    res.json({ success:true, inserted: docs.length });
  } catch (e) {
    console.error(e);
    res.json({ success:false, message:e.message });
  }
});

// ===== Biến sản phẩm thành kiến thức (admin) =====
userRouter.post('/kb/reindex-products', adminAuth, async (req, res) => {
  try {
    const products = await productModel.find({}).select('name description price stock subCategory');
    const docs = [];
    for (const p of products) {
      const text =
        `${p.name}\nDescription: ${p.description || ''}\n` +
        `Price: ${p.price} USD\nStock: ${p.stock ?? 'N/A'}\nState: ${p.subCategory || ''}`;
      const chunks = chunkText(text, 800);
      for (const c of chunks) {
        const emb = await embedText(c);
        docs.push({ title: `[PRODUCT] ${p.name}`, text: c, tags: ['product'], embedding: emb, source:'product' });
      }
    }
    await KB.deleteMany({ source: 'product' });   // làm sạch index cũ
    await KB.insertMany(docs);
    res.json({ success:true, inserted: docs.length });
  } catch (e) {
    console.error(e);
    res.json({ success:false, message:e.message });
  }
});

// ===== AI Chat (RAG local, không API key) =====
userRouter.post('/ai-chat', authUser, async (req, res) => {
  try {
    const q = (req.body.message || '').trim();
    if (!q) return res.json({ success:false, message:'Empty message' });

    // 1) Embed câu hỏi
    const qEmb = await embedText(q);

    // 2) Tìm top-k context trong KB (cosine similarity)
    const candidates = await KB.find({}).select('title text embedding source').lean();
    const top = candidates
      .map(d => ({ ...d, score: cosineSim(qEmb, d.embedding || []) }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 6);

    const kbContext = top.map((d,i) => `[#${i+1} ${d.source.toUpperCase()}] ${d.title}\n${d.text}`).join('\n\n');

    // 3) (tuỳ chọn) bơm thêm context từ Mongo sản phẩm theo tên
    const tokens = q.split(/\s+/).slice(0,4).join('|');
    const products = await productModel
      .find({ name: { $regex: tokens, $options: 'i' } })
      .limit(5)
      .select('name price stock subCategory');
    const productContext = products.length
      ? 'Products:\n' + products.map(p => `- ${p.name} | ${p.price} USD | stock: ${p.stock ?? 'N/A'} | ${p.subCategory || ''}`).join('\n')
      : '';

    // 4) Prompt hệ thống
    const system = `You are Tokullectibles' ecommerce assistant.
- Answer concisely using ONLY the context.
- If stock is 0 or missing, say "Out of stock".
- If info is missing, say you don't know.
- Follow store policies in context (refund/return/pre-order).`;

    const userPayload = `Context:\n${kbContext || '(no KB matched)'}\n\n${productContext}\n\nUser: ${q}`;

    // 5) Gọi Ollama local
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3',
        prompt: `${system}\n\n${userPayload}\n\nAssistant:`,
        stream: false,
        options: { temperature: 0.2 }
      })
    });
    const data = await r.json();
    const answer = data?.response || 'Sorry, I could not generate a reply.';

    res.json({ success:true, answer });
  } catch (err) {
    console.error(err);
    res.json({ success:false, message: err.message });
  }
});


export default userRouter;