// backend/controllers/aiController.js
import { getTable } from '../ai/lance.js';
import { embedText } from '../ai/ollamaClient.js';
import { chatLLM } from '../ai/adapterClient.js';
import { v4 as uuidv4 } from 'uuid';

/* ----------------- Helpers ----------------- */

// Tag an toàn (một số bản ghi tags là string, một số là mảng)
function hasTag(rec, regex) {
  const raw = rec?.tags;
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
  return arr.some(t => typeof t === 'string' && regex.test(t));
}

// Load toàn bộ KB (không cần embedding) – dùng cho “chính sách” để tránh lỗi service
async function loadKBItems() {
  const table = await getTable();
  if (typeof table.toArray === 'function') {
    return await table.toArray();
  }
  const items = [];
  for await (const batch of table.toBatches?.() || []) {
    items.push(...batch.toArray());
  }
  return items;
}

// Làm sạch nhẹ để tránh thành “seed / see d”
function cleanAnswer(s) {
  let t = String(s || '');

  // Gỡ tag kỹ thuật nếu có
  t = t.replace(/^\s*\[(SYSTEM|CONTEXT|USER|ASSISTANT)\].*$/gim, '').trim();

  // Gỡ câu dẫn lịch sự đầu câu (2 vòng cho “Sure. Here’s …”)
  const lead = /^(?:\s*(?:sure|okay|ok|of course|here'?s|here\s+(?:is|are)|below\s+(?:is|are)|the\s+revised\s+version|revised\s+version|dưới\s+đây\s+là|sau\s+đây\s+là|đây\s+là)\s*[:\-–]?\s*)/i;
  for (let i = 0; i < 2; i++) t = t.replace(lead, '').trim();

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && String(s || '').trim().length > 2) return String(s).trim();
  return t;
}

// Ghép tiếp nối nhưng chống trùng lặp đuôi/đầu
function mergeNoOverlap(prev, cont) {
  const a = String(prev || '');
  const b = String(cont || '');
  if (!a || !b) return (a + ' ' + b).trim();
  const max = Math.min(200, a.length, b.length);
  for (let k = max; k >= 20; k--) {
    if (a.slice(-k) === b.slice(0, k)) return (a + b.slice(k)).trim();
  }
  return (a + ' ' + b).trim();
}

// Phát hiện output ngắn đáng ngờ kiểu “seed / see d”
function looksLikeSeed(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return false;
  if (/^s?e{2}\s*d[\.!?]*$/.test(t)) return true;   // seed, see d
  if (t.length <= 4 && /^[a-z]+$/.test(t)) return true;
  return false;
}

/* ----------------- KB APIs ----------------- */

export const upsertKB = async (req, res) => {
  try {
    let { id, title, text, tags = [] } = req.body;

    title = String(title || '').normalize('NFC');
    text  = String(text  || '').normalize('NFC');

    if (!title.trim() || !text.trim()) {
      return res.json({ success: false, message: 'title & text required' });
    }
    if (!Array.isArray(tags)) tags = [];
    tags = tags.filter(t => typeof t === 'string');

    const table = await getTable();
    if (id) await table.delete({ where: `id == '${id}'` });

    const embedding = await embedText(`${title}\n${text}`);
    const doc = { id: id || uuidv4(), title, text, tags, embedding, createdAt: new Date().toISOString() };
    await table.add([doc]);

    return res.json({ success: true, message: 'KB upserted', id: doc.id });
  } catch (e) {
    console.error(e);
    return res.json({ success: false, message: e.message });
  }
};

export const listKB = async (_req, res) => {
  try {
    const items = await loadKBItems();
    return res.json({ success: true, items });
  } catch (e) {
    console.error(e);
    return res.json({ success: false, message: e.message });
  }
};

export const deleteKB = async (req, res) => {
  try {
    const { id } = req.params;
    const table = await getTable();
    await table.delete({ where: `id == '${id}'` });
    return res.json({ success: true, message: 'KB deleted' });
  } catch (e) {
    console.error(e);
    return res.json({ success: false, message: e.message });
  }
};

/* ----------------- Chat RAG ----------------- */

export const chatRAGHandler = async (req, res) => {
  try {
    const { message, product } = req.body || {};
    const userMsg = typeof message === 'string' ? message.trim() : '';
    if (!userMsg) return res.json({ success: false, message: 'message is required' });

    const qLower = userMsg.toLowerCase();

    const wantRefund   = /đổi trả|hoàn tiền|refund|return/.test(qLower);
    const askPolicy    = /chính sách|policy/.test(qLower);
    const shippingInfo = /vận chuyển|ship|giao hàng|delivery/.test(qLower);
    const warrantyInfo = /bảo hành|warranty/.test(qLower);
    const paymentInfo  = /thanh toán|payment|pay/.test(qLower);

    /* 1) Shortcut tồn kho -> không gọi LLM */
    const askStock = /(còn hàng|hết hàng|còn không|còn ko|còn k|available|in stock|out of stock)/i.test(qLower);
    if (askStock && product && typeof product === 'object') {
      const name = product.name || product.title || 'sản phẩm này';
      const rawStock = product.stock ?? product.stockQty ?? product.quantity ?? product.remain ?? null;

      let stockNumber = null;
      if (typeof rawStock === 'number') stockNumber = rawStock;
      else if (typeof rawStock === 'string' && rawStock.trim() !== '' && !Number.isNaN(Number(rawStock))) {
        stockNumber = Number(rawStock);
      }

      let status = '';
      if (stockNumber !== null) status = stockNumber > 0 ? `còn ${stockNumber} sản phẩm trong kho` : 'hiện đang hết hàng';
      else if (typeof product.inStock === 'boolean') status = product.inStock ? 'còn hàng' : 'hiện đang hết hàng';
      else if (product.stockText) {
        const txt = String(product.stockText).toLowerCase();
        const m = txt.match(/(\d+)/);
        if (/out of stock|hết hàng|sold out/.test(txt)) status = 'hiện đang hết hàng';
        else if (m && Number(m[1]) > 0) status = `còn ${Number(m[1])} sản phẩm trong kho`;
        else if (/in stock|còn hàng|available/.test(txt)) status = 'còn hàng';
      }
      if (!status) status = 'hiện không rõ tình trạng tồn kho. Bạn có thể liên hệ CSKH để kiểm tra thêm.';

      return res.json({
        success: true,
        answer: `Sản phẩm ${name} đang trong tình trạng ${status}.`,
        contextUsed: { product, reason: 'stock_shortcut' }
      });
    }

    /* 2) CÂU HỎI “CHÍNH SÁCH” – bỏ qua embedding để tránh mọi lỗi, quét KB thuần */
    if (askPolicy) {
      let bestText = '';
      try {
        const items = await loadKBItems();

        let candidates = items.filter(r => r && typeof r.title === 'string' && typeof r.text === 'string');

        if (wantRefund)   candidates = candidates.filter(r => hasTag(r, /refund|return|doi-tra/i));
        else if (shippingInfo) candidates = candidates.filter(r => hasTag(r, /ship|van-chuyen|giao-hang|delivery/i));
        else if (warrantyInfo) candidates = candidates.filter(r => hasTag(r, /warranty|bao-hanh/i));
        else if (paymentInfo)  candidates = candidates.filter(r => hasTag(r, /payment|thanh-toan/i));

        if (!candidates.length) {
          // fallback: ưu tiên title có từ “policy/chính sách”
          candidates = items.filter(r => /policy|chính\s*sách/i.test(r?.title || ''));
        }
        if (!candidates.length) candidates = items;

        const MAX = 2000;
        for (const r of candidates) {
          if (typeof r.text === 'string' && r.text.length > bestText.length) {
            bestText = r.text;
          }
        }
        if (bestText) {
          return res.json({
            success: true,
            answer: String(bestText).normalize('NFC').slice(0, MAX).trim(),
            contextUsed: candidates.slice(0, 3).map(r => ({ title: r.title, text: r.text })),
            mode: 'direct_policy_no_embed'
          });
        }
      } catch (e) {
        console.warn('Policy lookup failed, using hard fallback:', e?.message || e);
      }

      // Hard fallback theo nhóm chính sách
      let fallback;
      if (shippingInfo) {
        fallback = `Chính sách vận chuyển:
- Giao hàng toàn quốc qua đối tác vận chuyển.
- Thời gian giao 2–7 ngày tùy địa chỉ; có mã theo dõi đơn hàng.
- Phí ship hiển thị ở bước thanh toán hoặc theo bảng phí của đối tác.
- Vui lòng liên hệ CSKH nếu cần hỗ trợ cập nhật trạng thái.`;
      } else if (wantRefund) {
        fallback = `Chính sách đổi trả:
- Đổi trả trong 7 ngày kể từ ngày nhận hàng (giữ nguyên tem/mác).
- Sản phẩm lỗi do NSX: hỗ trợ đổi mới hoặc hoàn tiền theo quy định.
- Không áp dụng đổi trả với hàng đã sử dụng, hư hại do người dùng.
- Liên hệ CSKH để được hướng dẫn chi tiết.`;
      } else if (warrantyInfo) {
        fallback = `Chính sách bảo hành:
- Bảo hành theo quy định của nhà sản xuất (nếu có).
- Yêu cầu hóa đơn/phiếu mua khi tiếp nhận bảo hành.
- Liên hệ CSKH để xác nhận thời hạn và điểm tiếp nhận.`;
      } else if (paymentInfo) {
        fallback = `Chính sách thanh toán:
- Hỗ trợ thẻ quốc tế, ví điện tử và COD (nếu khả dụng).
- Thanh toán an toàn, mã hóa qua cổng thanh toán đối tác.
- Hóa đơn điện tử/biên lai được gửi về email sau khi thanh toán.`;
      } else {
        fallback = `Chính sách chung:
- Các chính sách đổi trả, vận chuyển, bảo hành, thanh toán được áp dụng theo quy định hiện hành.
- Vui lòng liên hệ CSKH để nhận hướng dẫn phù hợp.`;
      }
      return res.json({ success: true, answer: fallback, contextUsed: [], mode: 'policy_hard_fallback' });
    }

    /* 3) Truy vấn KB bình thường (embed + search) cho các câu khác */
    let context = [];
    try {
      const table = await getTable();
      const qvec  = await embedText(userMsg);

      const rows = await table.search(qvec).limit(8).select(['title','text','tags']).toArray();
      let picked = rows.filter(r => r && typeof r.title === 'string' && typeof r.text === 'string');

      if (wantRefund)   picked = picked.filter(r => hasTag(r, /refund|return|doi-tra/i));
      if (shippingInfo) picked = picked.filter(r => hasTag(r, /ship|van-chuyen|giao-hang|delivery/i));
      if (warrantyInfo) picked = picked.filter(r => hasTag(r, /warranty|bao-hanh/i));
      if (paymentInfo)  picked = picked.filter(r => hasTag(r, /payment|thanh-toan/i));
      if (!picked.length) picked = rows;

      context = picked.slice(0, 3).map(r => ({ title: r.title, text: r.text }));
    } catch (err) {
      console.warn('RAG disabled:', err?.message || err);
    }

    /* 4) Gọi LLM */
    let system = `
Bạn là CSKH của TokuCollection.
- LUÔN trả lời bằng TIẾNG VIỆT, ngắn gọn (<= 3 câu), đúng trọng tâm.
- Chỉ dùng thông tin trong CONTEXT cho: đổi trả/hoàn tiền, vận chuyển, bảo hành, thanh toán.
- Nếu CONTEXT chưa đủ, hãy hỏi lại 1 câu làm rõ.
`.trim();

    let answer;
    try {
      answer = await chatLLM({ system, user: userMsg, context });
      answer = cleanAnswer(answer);
    } catch (err) {
      return res.json({ success: false, message: String(err?.message || err) });
    }

    // Nếu output quá ngắn/“seed” => xin phép người dùng
    if (looksLikeSeed(answer)) {
      return res.json({
        success: true,
        answer: 'Xin lỗi, mình chưa lấy được thông tin đầy đủ. Bạn có thể hỏi cụ thể hơn không?',
        contextUsed: context
      });
    }

    // Auto-continue 1 vòng nếu chưa kết thúc câu
    const endPunct = /[\.!\?…]\s*$/;
    if (!endPunct.test((answer || '').trim())) {
      const tail = (answer || '').trim().slice(-280);
      try {
        const cont = await chatLLM({
          system: '',
          user:
            `Viết TIẾP phần còn dang dở, chỉ phần tiếp nối (không lặp lại, không kèm lời dẫn).\n\n` +
            `[ĐÃ CÓ]\n${tail}\n\n[TIẾP TỤC]`,
          context
        });
        const cleanCont = cleanAnswer(cont);
        if (cleanCont && !looksLikeSeed(cleanCont)) answer = mergeNoOverlap(answer, cleanCont);
      } catch { /* ignore */ }
    }

    return res.json({ success: true, answer, contextUsed: context });

  } catch (e) {
    console.error(e);
    return res.json({ success: false, message: e.message });
  }
};
