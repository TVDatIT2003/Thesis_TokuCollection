// frontend/src/components/AiChatWidget.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { ShopContext } from '../context/ShopContext';

// lọc output bot để chặn "seed/see d" và chuỗi quá ngắn
function sanitizeBot(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (/^s?e{2}\s*d[.!?]*$/i.test(t)) return '';
  if (t.length <= 3) return '';
  return t;
}

// 1) Gọi API để lấy sản phẩm theo id (fallback nếu không có window.__tokuCurrentProduct)
async function fetchProductById(backendUrl, id) {
  const tryGet = async (url) => {
    try {
      const { data } = await axios.get(url);
      return data?.product || data?.data || data;
    } catch {
      return null;
    }
  };
  return (
    (await tryGet(`${backendUrl}/api/product/single/${id}`)) ||
    (await tryGet(`${backendUrl}/api/product/${id}`)) ||
    null
  );
}

function parseProductIdFromPath(pathname) {
  const m = pathname.match(/\/product\/([^/]+)/i);
  return m ? m[1] : null;
}

const AiChatWidget = () => {
  const { backendUrl, token, currency } = useContext(ShopContext);
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState([
    {
      role: 'assistant',
      content:
        'Xin chào! Mình là trợ lý TokuCollection. Bạn muốn tìm sản phẩm hay hỏi về chính sách đổi trả, vận chuyển...?',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const [productCtx, setProductCtx] = useState(null);

  useEffect(() => {
    const id = parseProductIdFromPath(location.pathname);

    if (id && typeof window !== 'undefined' && window.__tokuCurrentProduct) {
      const p = window.__tokuCurrentProduct;
      const stockNum =
        typeof p.stock === 'number'
          ? p.stock
          : typeof p.stock === 'string' && !Number.isNaN(Number(p.stock))
          ? Number(p.stock)
          : 0;

      setProductCtx({
        id: p._id || p.id || id,
        name: p.name || p.title,
        price: typeof p.price === 'number' ? p.price : Number(p.price) || p.price,
        currency,
        stock: stockNum,
        inStock: stockNum > 0,
        stockText: stockNum > 0 ? `Còn ${stockNum} sản phẩm` : 'Hết hàng',
        url: window.location.href,
        variants: Array.isArray(p.sizes) ? p.sizes.map((s) => s?.name).filter(Boolean) : [],
      });
      return;
    }

    (async () => {
      if (!id) {
        setProductCtx(null);
        return;
      }
      const p = await fetchProductById(backendUrl, id);
      if (!p) {
        setProductCtx(null);
        return;
      }

      const stockNum =
        typeof p.stock === 'number'
          ? p.stock
          : typeof p.stock === 'string' && !Number.isNaN(Number(p.stock))
          ? Number(p.stock)
          : 0;

      setProductCtx({
        id: p._id || p.id || id,
        name: p.name || p.title,
        price: typeof p.price === 'number' ? p.price : Number(p.price) || p.price,
        currency,
        stock: stockNum,
        inStock: stockNum > 0,
        stockText: stockNum > 0 ? `Còn ${stockNum} sản phẩm` : 'Hết hàng',
        url: typeof window !== 'undefined' ? window.location.href : '',
        variants: Array.isArray(p.sizes) ? p.sizes.map((s) => s?.name).filter(Boolean) : [],
      });
    })();
  }, [location.pathname, backendUrl, currency]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMsgs((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const payload = { message: text };

      if (productCtx) {
        payload.product = productCtx;
      } else if (typeof window !== 'undefined' && window.__tokuCurrentProduct) {
        const p = window.__tokuCurrentProduct;
        payload.product = {
          id: p._id || p.id,
          name: p.name || p.title,
          price: p.price,
          currency,
          inStock:
            typeof p.inStock === 'boolean'
              ? p.inStock
              : Array.isArray(p.sizes)
              ? p.sizes.some((s) => s?.inStock)
              : undefined,
          stockText: p.inStock ? 'Còn hàng' : 'Hết hàng',
          url: window.location.href,
          variants: Array.isArray(p.sizes) ? p.sizes.map((s) => s?.name).filter(Boolean) : [],
        };
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const { data } = await axios.post(`${backendUrl}/api/ai/chat`, payload, { headers });

      const raw = (data && (data.answer || data.message)) || '';
      const botText = sanitizeBot(raw) || 'Xin lỗi, hệ thống đang bận. Bạn thử hỏi cụ thể hơn nhé.';
      setMsgs((prev) => [...prev, { role: 'assistant', content: String(botText) }]);
    } catch (err) {
      setMsgs((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Hệ thống đang bận. Bạn thử lại trong giây lát nhé.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) send();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 rounded-full shadow-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        aria-label="Toggle chat"
      >
        {open ? 'Ẩn trợ lý' : 'TokuCollection Assistant'}
      </button>

      {open && (
        <div className="w-[380px] sm:w-[500px] h-[480px] bg-white border shadow-2xl rounded-2xl flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">TokuCollection Assistant</div>
            <div className="text-xs text-gray-500">
              {productCtx ? 'Đang ở trang sản phẩm' : 'Hỏi đáp chung'}
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'assistant' ? '' : 'justify-end'}`}>
                <div
                  className={
                    'rounded-2xl px-4 py-2 shadow ' +
                    (m.role === 'assistant' ? 'bg-gray-100 text-gray-900' : 'bg-blue-600 text-white')
                  }
                  style={{ wordBreak: 'break-word' }}
                >
                  <div className="whitespace-pre-wrap break-words max-w-[85%]">{m.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex">
                <div className="rounded-2xl px-4 py-2 shadow bg-gray-100 text-gray-500">Đang nhập…</div>
              </div>
            )}
          </div>

          <div className="p-3 border-t flex items-end gap-2">
            <textarea
              className="flex-1 resize-none rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap"
              rows={1}
              placeholder="Nhập câu hỏi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              onClick={send}
              disabled={!canSend}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                canSend ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiChatWidget;
