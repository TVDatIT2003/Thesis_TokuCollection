import React, { useContext, useMemo } from 'react';
import { ShopContext } from '../context/ShopContext';

const CartTotal = ({ amountOverride = null }) => {
  const { currency, getCartAmount, delivery_fee } = useContext(ShopContext);

  // Nếu có override (tổng tiền theo lựa chọn) thì dùng, nếu không dùng tổng toàn giỏ
  const amount = useMemo(() => {
    const base = amountOverride !== null ? amountOverride : getCartAmount();
    return Number(base || 0);
  }, [amountOverride, getCartAmount]);

  // Chỉ tính phí ship khi amount > 0
  const shipping = amount > 0 ? Number(delivery_fee ?? 0.8) : 0;
  const total = amount + shipping;

  return (
    <div className="w-full">
      <div className="text-2xl mb-3">CART TOTALS</div>

      <div className="flex justify-between py-2">
        <p>Subtotal</p>
        <p>{currency} {amount.toFixed(2)}</p>
      </div>
      <hr />

      <div className="flex justify-between py-2">
        <p>Shipping Fee</p>
        <p>{currency} {shipping.toFixed(2)}</p>
      </div>
      <hr />

      <div className="flex justify-between py-2 font-semibold">
        <p>Total</p>
        <p>{currency} {total.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default CartTotal;
