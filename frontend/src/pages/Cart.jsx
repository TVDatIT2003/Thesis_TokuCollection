import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import CartTotal from '../components/CartTotal';
import { assets } from '../assets/assets'; // đảm bảo assets.bin_icon tồn tại
import { useNavigate } from "react-router-dom";

/**
 * Cart page with multi-select checkboxes + modal warning if no selection.
 */
const Cart = () => {
  const { products, currency, cartItems, updateQuantity, navigate } = useContext(ShopContext);

  // ---- Flatten cart to array: [{_id, size, quantity}]
  const [cartData, setCartData] = useState([]);
  useEffect(() => {
    const tmp = [];
    if (cartItems) {
      Object.entries(cartItems).forEach(([productId, sizes]) => {
        Object.entries(sizes || {}).forEach(([size, qty]) => {
          if (qty > 0) tmp.push({ _id: productId, size, quantity: qty });
        });
      });
    }
    setCartData(tmp);
  }, [cartItems]);

  // ---- Selection state
  const keyOf = useCallback((it) => `${it._id}::${it.size}`, []);
  const [selected, setSelected] = useState(new Set());

  // Keep selection valid when data changes
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      const validKeys = new Set(cartData.map(keyOf));
      prev.forEach((k) => validKeys.has(k) && next.add(k));
      return next;
    });
  }, [cartData, keyOf]);

  const toggleOne = (item) => {
    const k = keyOf(item);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const allSelected = cartData.length > 0 && selected.size === cartData.length;
  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === cartData.length ? new Set() : new Set(cartData.map(keyOf))
    );
  };

  const selectedAmount = useMemo(() => {
    if (!selected.size) return 0;
    return cartData.reduce((sum, it) => {
      const k = keyOf(it);
      if (!selected.has(k)) return sum;
      const p = products.find((pr) => pr._id === it._id);
      return sum + ((p?.price || 0) * it.quantity);
    }, 0);
  }, [selected, cartData, products, keyOf]);

  const removeSelected = async () => {
    const toRemove = cartData.filter((it) => selected.has(keyOf(it)));
    for (const it of toRemove) {
      await updateQuantity(it._id, it.size, 0); // set 0 = remove
    }
    setSelected(new Set());
  };

  // ---- Modal: no selection
  const [showNoSelectionModal, setShowNoSelectionModal] = useState(false);
  useEffect(() => {
    document.body.style.overflow = showNoSelectionModal ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showNoSelectionModal]);

  const proceedCheckout = () => {
    if (!selected.size) {
      setShowNoSelectionModal(true);
      return;
    }
    const selectedKeys = Array.from(selected);
    navigate('/place-order', { state: { selectedKeys } });
  };

  return (
    <div className="border-t pt-14">
      <div className="text-2xl mb-3">
        <Title text1={'YOUR'} text2={'CART'} />
      </div>

      {/* Select all */}
      <div className="flex items-center gap-3 mb-4">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
        <span className="text-sm">Select all ({selected.size}/{cartData.length})</span>
      </div>

      {/* Header row (desktop) */}
      <div className="hidden md:grid grid-cols-[1fr_3fr_2fr_1fr] py-2 px-2 text-sm text-gray-500">
        <div></div>
        <p>Product</p>
        <p className="text-center">Quantity</p>
        <p className="text-right">Action</p>
      </div>

      {/* Items */}
      <div>
        {cartData.map((item, index) => {
          const productData = products.find((p) => p._id === item._id);
          if (!productData) return null;
          const checked = selected.has(keyOf(item));

          return (
            <div
              key={`${item._id}-${item.size}-${index}`}
              className="py-4 border-t border-b md:grid md:grid-cols-[1fr_3fr_2fr_1fr] items-center gap-4"
            >
              {/* Checkbox */}
              <div className="flex items-center justify-center">
                <input type="checkbox" checked={checked} onChange={() => toggleOne(item)} />
              </div>

              {/* Product */}
              <div className="flex items-start gap-6 px-2">
                <img className="w-16 sm:w-20 object-cover" src={productData.image[0]} alt={productData.name} />
                <div>
                  <p className="text-xs sm:text-lg font-medium">{productData.name}</p>
                  <div className="flex items-center gap-5 mt-2">
                    <p>{currency}{Number(productData.price).toFixed(2)}</p>
                    <p className="px-2 sm:px-3 sm:py-1 border bg-slate-50">{item.size}</p>
                  </div>
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-center gap-2 my-3 md:my-0">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || Number(v) < 1) return;
                    updateQuantity(item._id, item.size, Number(v));
                  }}
                  className="border text-center w-14 sm:w-20 px-1 py-1"
                />
              </div>

              {/* Remove (icon) */}
              <div className="text-right pr-2">
                <img
                  onClick={() => updateQuantity(item._id, item.size, 0)}
                  className="w-4 mr-4 sm:w-5 cursor-pointer inline-block"
                  src={assets.bin_icon}
                  alt="Remove"
                  title="Remove"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals + actions */}
      <div className="flex justify-end my-10">
        <div className="w-full sm:w-[450px]">
          <CartTotal amountOverride={selected.size ? selectedAmount : 0} />

          <div className="w-full text-end mt-3">
            <div className="flex gap-3 justify-end">
              <button
                disabled={!selected.size}
                onClick={removeSelected}
                className="bg-gray-200 disabled:opacity-50 text-sm px-5 py-3 rounded"
              >
                DELETE SELECTED
              </button>

              <button
                onClick={proceedCheckout}
                className="bg-black text-white text-sm px-8 py-3 rounded"
              >
                {selected.size ? 'PROCEED TO CHECKOUT' : 'PROCEED TO CHECKOUT'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: no selection */}
      {showNoSelectionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowNoSelectionModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-[90%] max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="no-select-title"
          >
            <h3 id="no-select-title" className="text-lg font-semibold mb-2">Notification</h3>
            <p className="text-sm text-gray-700">
              Bạn vẫn chưa chọn sản phẩm nào để mua. <br />
              You have not selected any products to buy yet.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded bg-black text-white"
                onClick={() => setShowNoSelectionModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
