import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import axios from 'axios';
import { toast } from 'react-toastify';

const Orders = () => {
  const { backendUrl, token, currency } = useContext(ShopContext);

  const [orderData, setOrderData] = useState([]);

  // Cancel
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('Ordered wrong product');
  const [otherReason, setOtherReason] = useState('');

  // Refund
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState(null);
  const [refundReason, setRefundReason] = useState('Received damaged item');
  const [refundOther, setRefundOther] = useState('');
  const [refundImages, setRefundImages] = useState([]);
  const [refundVideo, setRefundVideo] = useState(null);
  const MAX_IMAGES = 4;
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Confirm Received (order-level)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmOrderId, setConfirmOrderId] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null); // item để biết productId
  const [isConfirming, setIsConfirming] = useState(false);

  // Review (product-level)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewProductId, setReviewProductId] = useState(null);
  const [reviewOrderId, setReviewOrderId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewImages, setReviewImages] = useState([]);
  const [reviewVideo, setReviewVideo] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Helpers
  const isDelivered = (status) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return s.includes('delivered') || s === 'completed';
  };
  const prettyStatus = (status) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'delivered' || s === 'completed') return 'Delivered successfully';
    const map = {
      'order placed': 'Order Placed',
      packing: 'Packing',
      shipped: 'Shipped',
      'out for delivery': 'Out for delivery',
      'delivered successfully': 'Delivered successfully',
      cancelled: 'Cancelled',
      pending: 'Pending',
    };
    return map[s] || status;
  };

  // Load orders
  const loadOrderData = async () => {
    try {
      if (!token) return;
      const res = await axios.post(`${backendUrl}/api/order/userorders`, {}, { headers: { token } });
      if (!res.data.success) {
        toast.error(res.data.message || 'Failed to load orders');
        return;
      }
      const all = [];
      (res.data.orders || []).forEach((order) => {
        (order.items || []).forEach((item) => {
          all.push({
            ...item,
            orderId: order._id,
            status: order.status,
            payment: order.payment,
            paymentMethod: order.paymentMethod,
            date: order.date,
            userConfirmed: order.userConfirmed ?? false,
            cancelReason: order.cancelReason ?? null,
            refundRequested: order.refundRequested ?? !!order.refundRequest,
            refundStatus: order.refundStatus ?? order.refundRequest?.status ?? 'Pending',
            refundRequest: order.refundRequest ?? null,
          });
        });
      });
      setOrderData(all.reverse());
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  // ----- Confirm -----
  const openConfirm = (orderId, item) => {
    setConfirmOrderId(orderId);
    setConfirmItem(item || null);
    setShowConfirmModal(true);
  };
  const onConfirmReceived = async (orderId) => {
    try {
      setIsConfirming(true);
      const res = await axios.post(
        `${backendUrl}/api/order/confirm`,
        { orderId },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success('Confirmed receipt');
        setShowConfirmModal(false);

        // Mở Review modal ngay sau khi confirm
        const pid = confirmItem?.productId || confirmItem?._id || confirmItem?.id;
        if (pid) {
          setReviewProductId(pid);
          setReviewOrderId(orderId);
          setReviewRating(5);
          setReviewText('');
          setReviewImages([]);
          setReviewVideo(null);
          setShowReviewModal(true);
        }

        await loadOrderData();
      } else {
        toast.error(res.data.message || 'Confirm failed');
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  // ----- Cancel -----
  const openCancel = (id) => {
    setCancelOrderId(id);
    setCancelReason('Ordered wrong product');
    setOtherReason('');
    setShowCancelModal(true);
  };
  const submitCancel = async () => {
    const reason = cancelReason === 'Other' ? otherReason.trim() : cancelReason;
    if (!reason) return toast.error('Please enter the reason to cancel your order');
    try {
      const res = await axios.post(
        `${backendUrl}/api/order/cancel`,
        { orderId: cancelOrderId, reason },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success('Canceled order successfully');
        setShowCancelModal(false);
        await loadOrderData();
      } else toast.error(res.data.message || 'Cancel failed');
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    }
  };

  // ----- Refund -----
  const openRefund = (id) => {
    setRefundOrderId(id);
    setRefundReason('Received damaged item');
    setRefundOther('');
    setRefundImages([]);
    setRefundVideo(null);
    setShowRefundModal(true);
  };
  const onPickImages = (e) => {
    const files = Array.from(e.target.files || []);
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    let next = [...refundImages, ...imgs];
    if (next.length > MAX_IMAGES) {
      toast.warn(`Chỉ được chọn tối đa ${MAX_IMAGES} ảnh. Đã giữ ${MAX_IMAGES} ảnh đầu tiên.`);
      next = next.slice(0, MAX_IMAGES);
    }
    setRefundImages(next); e.target.value = '';
  };
  const onRemoveImageAt = (idx) => setRefundImages((p) => p.filter((_, i) => i !== idx));
  const onPickVideo = (e) => {
    const f = (e.target.files && e.target.files[0]) || null;
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('File video không hợp lệ.'); e.target.value = ''; return; }
    setRefundVideo(f); e.target.value = '';
  };
  const onClearVideo = () => setRefundVideo(null);
  const submitRefund = async () => {
    const reason = refundReason === 'Other' ? refundOther.trim() : refundReason;
    if (!reason) return toast.error('Please enter the reason for refund');
    try {
      setIsSubmittingRefund(true);
      const fd = new FormData();
      fd.append('reason', reason);
      if (refundReason === 'Other' && refundOther) fd.append('otherReason', refundOther);
      refundImages.forEach((f) => fd.append('images', f));
      if (refundVideo) fd.append('video', refundVideo);

      const res = await axios.post(
        `${backendUrl}/api/order/request-refund/${refundOrderId}`,
        fd,
        { headers: { token, 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data?.success) {
        toast.success('Refund request submitted');
        setShowRefundModal(false);
        await loadOrderData();
      } else toast.error(res.data?.message || 'Request refund failed');
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    } finally { setIsSubmittingRefund(false); }
  };

  // ----- Review -----
  const onPickReviewImages = (e) => {
    const files = Array.from(e.target.files || []);
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    let next = [...reviewImages, ...imgs];
    if (next.length > MAX_IMAGES) {
      toast.warn(`Chỉ được chọn tối đa ${MAX_IMAGES} ảnh. Đã giữ ${MAX_IMAGES} ảnh đầu tiên.`);
      next = next.slice(0, MAX_IMAGES);
    }
    setReviewImages(next); e.target.value = '';
  };
  const onRemoveReviewImageAt = (idx) => setReviewImages((p) => p.filter((_, i) => i !== idx));
  const onPickReviewVideo = (e) => {
    const f = (e.target.files && e.target.files[0]) || null;
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('File video không hợp lệ.'); e.target.value = ''; return; }
    setReviewVideo(f); e.target.value = '';
  };
  const onClearReviewVideo = () => setReviewVideo(null);

  const submitReview = async () => {
    if (!reviewProductId || !reviewOrderId) return toast.error('Thiếu thông tin sản phẩm/đơn hàng');
    try {
      setIsSubmittingReview(true);
      const fd = new FormData();
      fd.append('productId', reviewProductId);
      fd.append('orderId', reviewOrderId);
      fd.append('rating', String(reviewRating));
      if (reviewText) fd.append('comment', reviewText);
      reviewImages.forEach((f) => fd.append('images', f));
      if (reviewVideo) fd.append('video', reviewVideo);

      const res = await axios.post(`${backendUrl}/api/review/create`, fd, {
        headers: { token, 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        toast.success('Thanks for your review!');
        setShowReviewModal(false);
      } else {
        toast.error(res.data?.message || 'Submit review failed');
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => { loadOrderData(); /* eslint-disable-next-line */ }, [token]);

  return (
    <div className="border-t pt-16">
      <div className="text-2xl">
        <Title text1={'MY'} text2={'ORDERS'} />
      </div>

      <div>
        {orderData.map((item, index) => (
          <div key={`${item.orderId}-${index}`} className="py-4 border-t border-b text-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left */}
            <div className="flex items-start gap-6 text-sm">
              <img className="w-16 sm:w-20 object-cover" src={item.image?.[0]} alt="" />
              <div>
                <p className="sm:text-base font-medium">{item.name}</p>
                <div className="flex items-center gap-3 mt-1 text-base text-gray-700">
                  <p>{item.price} {currency}</p>
                  <p>Quantity: {item.quantity}</p>
                </div>
                <p className="mt-1">Date <span className="text-gray-400">{item.date ? new Date(item.date).toDateString() : '-'}</span></p>
                <p className="mt-1">Payment <span className="text-gray-400">{item.paymentMethod}</span></p>

                {item.refundRequest && (
                  <div className="mt-2 text-sm">
                    <p><span className="font-medium">Refund:</span> {item.refundRequest.reason}{item.refundRequest.otherReason ? ` - ${item.refundRequest.otherReason}` : ''} ({item.refundRequest.status || 'requested'})</p>
                    {item.refundRequest.images?.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {item.refundRequest.images.map((src, i) => (
                          <img key={i} src={`${backendUrl}${src}`} alt="" className="w-full h-16 object-cover rounded" />
                        ))}
                      </div>
                    )}
                    {item.refundRequest.video && (
                      <video className="mt-2 w-56 rounded" controls src={`${backendUrl}${item.refundRequest.video}`} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="md:w-1/2 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <p className="text-sm md:text-base">{prettyStatus(item.status)}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={loadOrderData} className="border px-4 py-2 text-sm font-medium rounded-sm">Track Order</button>

                {isDelivered(item.status) && item.status !== 'Cancelled' && item.status !== 'Completed' && !item.userConfirmed && (
                  <button
                    onClick={() => openConfirm(item.orderId, item)}
                    className="px-4 py-2 text-sm rounded-sm bg-green-600 text-white hover:bg-green-700"
                  >
                    Received the order
                  </button>
                )}

                {!isDelivered(item.status) && item.status !== 'Cancelled' && (
                  <button onClick={() => openCancel(item.orderId)} className="px-4 py-2 text-sm rounded-sm bg-red-600 text-white hover:bg-red-700">
                    Cancel Order
                  </button>
                )}

                {isDelivered(item.status) && item.status !== 'Cancelled' && !item.refundRequested && !item.refundRequest && (
                  <button onClick={() => openRefund(item.orderId)} className="px-4 py-2 text-sm rounded-sm bg-amber-600 text-white hover:bg-amber-700">
                    Request a refund
                  </button>
                )}

                {(item.refundRequested || item.refundRequest) && (
                  <span className="text-sm text-amber-600">
                    Refund requested ({item.refundStatus || item.refundRequest?.status || 'Pending'})
                  </span>
                )}
              </div>
            </div>

            {String(item.status).toLowerCase().trim() === 'cancelled' && item.cancelReason && (
              <p className="text-red-600 text-sm">Reason: {item.cancelReason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-5 w-[90%] max-w-md">
            <h3 className="text-lg font-semibold mb-3">Select reason for cancellation</h3>
            <select className="w-full border p-2 rounded" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
              <option value="Ordered wrong product">Ordered wrong product</option>
              <option value="Delivery time is too long">Delivery time is too long</option>
              <option value="Found a better price">Found a better price</option>
              <option value="Changed my mind">Changed my mind</option>
              <option value="Other">Other</option>
            </select>
            {cancelReason === 'Other' && (
              <textarea className="w-full border p-2 rounded mt-3" rows={3} placeholder="Enter your reason..." value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded border" onClick={() => setShowCancelModal(false)}>Close</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={submitCancel}>Confirm cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-5 w-[92%] max-w-xl">
            <h3 className="text-lg font-semibold mb-3">Select reason for refund</h3>
            <select className="w-full border p-2 rounded mb-3" value={refundReason} onChange={(e) => setRefundReason(e.target.value)}>
              <option value="Received damaged item">Received damaged item</option>
              <option value="Missing parts/accessories">Missing parts/accessories</option>
              <option value="Wrong item received">Wrong item received</option>
              <option value="Quality not as described">Quality not as described</option>
              <option value="Other">Other</option>
            </select>
            {refundReason === 'Other' && (
              <textarea className="w-full border p-2 rounded mb-3" rows={3} placeholder="Enter your reason..." value={refundOther} onChange={(e) => setRefundOther(e.target.value)} />
            )}

            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Evidence (optional)</p>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Images (max {MAX_IMAGES})</span>
                  <span className="text-xs text-gray-500">{refundImages.length}/{MAX_IMAGES}</span>
                </div>
                <input type="file" accept="image/*" multiple onChange={onPickImages}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:border-0 file:rounded file:bg-gray-100 file:text-gray-700" />
                {refundImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {refundImages.map((f, idx) => (
                      <div key={idx} className="relative group">
                        <img className="w-full h-20 object-cover rounded" src={URL.createObjectURL(f)} alt={`evidence-${idx}`} />
                        <button type="button" onClick={() => onRemoveImageAt(idx)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded px-1 text-xs opacity-0 group-hover:opacity-100" title="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Video (max 1)</span>
                  {refundVideo && <button type="button" onClick={onClearVideo} className="text-xs text-red-600 underline">Remove video</button>}
                </div>
                <input type="file" accept="video/*" onChange={onPickVideo}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:border-0 file:rounded file:bg-gray-100 file:text-gray-700" />
                {refundVideo && <p className="text-xs text-gray-600 mt-1 truncate">Selected: {refundVideo.name}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button className="px-4 py-2 rounded border" onClick={() => setShowRefundModal(false)} disabled={isSubmittingRefund}>Close</button>
              <button className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={submitRefund} disabled={isSubmittingRefund}>
                {isSubmittingRefund ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Received Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-lg p-5 w-[90%] max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-lg font-semibold mb-2">Confirm receipt</h3>
            <p className="text-sm text-gray-700">Confirm you received the products?
              <br />Once confirmed, the order status will be marked as <b>Completed</b>.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded border" onClick={() => setShowConfirmModal(false)} disabled={isConfirming}>Close</button>
              <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                onClick={() => onConfirmReceived(confirmOrderId)} disabled={isConfirming}>
                {isConfirming ? 'Confirming...' : 'Yes, I received'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal (mở sau khi confirm) */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReviewModal(false)}>
          <div className="bg-white rounded-lg p-5 w-[92%] max-w-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-lg font-semibold mb-3">Rate this product</h3>

            {/* Stars */}
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setReviewRating(n)}
                  className={`text-2xl leading-none ${n <= reviewRating ? 'text-yellow-500' : 'text-gray-300'}`} aria-label={`${n} star`}>
                  ★
                </button>
              ))}
              <span className="text-sm text-gray-600 ml-1">{reviewRating}/5</span>
            </div>

            {/* Text */}
            <textarea rows={4} placeholder="Share your thoughts about the product (optional)"
              className="w-full border rounded p-2 mb-3" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />

            {/* Images */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Images (max {MAX_IMAGES})</span>
                <span className="text-xs text-gray-500">{reviewImages.length}/{MAX_IMAGES}</span>
              </div>
              <input type="file" accept="image/*" multiple onChange={onPickReviewImages}
                className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:border-0 file:rounded file:bg-gray-100 file:text-gray-700" />
              {reviewImages.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {reviewImages.map((f, idx) => (
                    <div key={idx} className="relative group">
                      <img className="w-full h-20 object-cover rounded" src={URL.createObjectURL(f)} alt={`review-${idx}`} />
                      <button type="button" onClick={() => onRemoveReviewImageAt(idx)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded px-1 text-xs opacity-0 group-hover:opacity-100" title="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Video (max 1)</span>
                {reviewVideo && <button type="button" onClick={onClearReviewVideo} className="text-xs text-red-600 underline">Remove video</button>}
              </div>
              <input type="file" accept="video/*" onChange={onPickReviewVideo}
                className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:border-0 file:rounded file:bg-gray-100 file:text-gray-700" />
              {reviewVideo && <p className="text-xs text-gray-600 mt-1 truncate">Selected: {reviewVideo.name}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded border" onClick={() => setShowReviewModal(false)} disabled={isSubmittingReview}>Close</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={submitReview} disabled={isSubmittingReview}>
                {isSubmittingReview ? 'Submitting...' : 'Submit review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
