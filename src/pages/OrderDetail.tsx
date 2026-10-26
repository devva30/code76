import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock, RotateCcw, Truck } from 'lucide-react';
import { ApiError, mediaUrl, orderApi, paiseToRupees, paymentApi, type OrderDetailDto, sized } from '@/lib/api';
import { PaymentDismissed, payWithRazorpay } from '@/lib/razorpay';
import { useAuth } from '@/store/AuthContext';
import { useShop } from '@/store/ShopContext';
import { OrderStatusBadge, formatDateTime, formatTime, useCountdown } from '@/components/orders/OrderBits';
import { CatalogueError } from '@/components/product/CatalogueStates';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button, ButtonLink } from '@/components/ui/Button';
import { BRAND } from '@/config/brand';
import { sizeLabel } from '@/data/products';
import { EASE } from '@/lib/motion';
import { formatPrice } from '@/lib/format';
import NotFound from './NotFound';

interface PanelProps {
  order: OrderDetailDto;
  onCancel: () => void;
  cancelling: boolean;
  onPay: () => void;
  paying: boolean;
  payError: string | null;
}

function StatusPanel({ order, onCancel, cancelling, onPay, paying, payError }: PanelProps) {
  const countdown = useCountdown(order.status === 'pending_payment' ? order.expiresAt : null);
  const total = formatPrice(paiseToRupees(order.total));

  if (order.status === 'pending_payment') {
    return (
      <div className="border border-stamp/40 bg-newsprint p-6 md:p-8">
        <div className="flex gap-4">
          <Clock strokeWidth={1.4} className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--c-stamp))]" aria-hidden />
          <div className="min-w-0 text-sm leading-relaxed">
            <p className="text-ink">Awaiting payment</p>
            <p className="mt-1 text-graphite">
              Your pieces are reserved until <span className="text-ink">{order.expiresAt ? formatTime(order.expiresAt) : 'soon'}</span>
              {countdown ? <> (<span className="font-mono tabular-nums text-ink" aria-live="off">{countdown}</span> left)</> : ' (finishing up)'}.
              {order.canPay
                ? ' Pay securely with UPI, cards, netbanking or wallets through Razorpay.'
                : ' Online payment isn’t available right now.'}{' '}
              If it isn’t paid in time, the order expires and nothing is charged.
            </p>
            <AnimatePresence>
              {payError && (
                <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-[rgb(var(--c-stamp))]">
                  {payError}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="mt-5 flex flex-wrap gap-3">
              {order.canPay && (
                <Button onClick={onPay} disabled={paying || cancelling} arrow className="h-11 px-6">
                  {paying ? 'Opening payment…' : `Pay ${total}`}
                </Button>
              )}
              <Button variant="outline" onClick={onCancel} disabled={cancelling || paying} className="h-11 px-5">
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (order.status === 'shipped' || order.status === 'delivered') {
    const s = order.shipment;
    return (
      <div className="flex gap-4 border border-ink/15 bg-newsprint p-6 md:p-8 text-sm leading-relaxed">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
          {order.status === 'delivered' ? <Check strokeWidth={2} className="h-3.5 w-3.5" aria-hidden /> : <Truck strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden />}
        </span>
        <div>
          <p className="text-ink">
            {order.status === 'delivered'
              ? `Delivered${s?.deliveredAt ? ` on ${formatDateTime(s.deliveredAt)}` : ''}. Enjoy!`
              : `On its way. Shipped${s ? ` on ${formatDateTime(s.shippedAt)}` : ''}.`}
          </p>
          {s && (
            <p className="mt-1 text-graphite">
              {s.courier} · tracking number <span className="font-mono text-ink">{s.trackingNumber}</span>
            </p>
          )}
          {s?.trackingUrl && order.status === 'shipped' && (
            <a href={s.trackingUrl} target="_blank" rel="noreferrer noopener" className="mt-4 inline-block">
              <Button variant="outline" className="h-10 px-5">Track package</Button>
            </a>
          )}
        </div>
      </div>
    );
  }
  if (order.status === 'confirmed') {
    return (
      <div className="flex gap-4 border border-ink/15 bg-newsprint p-6 md:p-8 text-sm leading-relaxed">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
          <Check strokeWidth={2} className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div>
          <p className="text-ink">Paid{order.paidAt ? ` on ${formatDateTime(order.paidAt)}` : ''}.</p>
          <p className="mt-1 text-graphite">Your order is confirmed and we’re getting it ready. We’ll add tracking here once it ships.</p>
        </div>
      </div>
    );
  }
  const refundNote = ' Refunds usually reach your account within 5–7 working days.';
  const message =
    order.status === 'expired'
      ? order.refunded
        ? 'Your payment arrived after the hold ended and these pieces had sold out, so we refunded it in full.' + refundNote
        : 'The payment window passed, so this order expired and its pieces went back on sale. Nothing was charged.'
      : order.status === 'cancelled'
        ? order.cancelReason
          ? `We cancelled this order: ${order.cancelReason}` + (order.refunded ? ' Your payment has been refunded in full.' + refundNote : ' Nothing was charged.')
          : order.refunded
            ? 'You cancelled this order. A payment that came through afterwards was refunded in full.' + refundNote
            : 'You cancelled this order. Nothing was charged.'
        : null;
  if (!message) return null;
  return (
    <p className="flex gap-3 border-l-2 border-rule pl-4 text-sm text-graphite">
      {order.refunded && <RotateCcw strokeWidth={1.4} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      {message}
    </p>
  );
}

/** One order: status, what was ordered, where it's going, what it costs. */
export default function OrderDetail() {
  const { orderNumber = '' } = useParams();
  const { state } = useLocation() as { state: { justPlaced?: boolean; payNow?: boolean } | null };
  const { status } = useAuth();
  const { notify } = useShop();
  const [order, setOrder] = useState<OrderDetailDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const autoOpened = useRef(false);
  const countdown = useCountdown(order?.status === 'pending_payment' ? order.expiresAt : null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setError(null);
      return orderApi
        .get(orderNumber, signal)
        .then(setOrder)
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong.'));
        });
    },
    [orderNumber],
  );

  useEffect(() => {
    document.title = `Order ${orderNumber} — ${BRAND.name}`;
    if (status !== 'signed-in') return;
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [status, orderNumber, load]);

  // When the hold runs out, check back shortly after for the server's "expired".
  useEffect(() => {
    if (order?.status !== 'pending_payment' || countdown !== null) return;
    const t = window.setTimeout(() => void load(), 15000);
    return () => window.clearTimeout(t);
  }, [order?.status, countdown, load]);

  /**
   * Pay: ask our server for a Razorpay session, open Razorpay's window, then send the signed result
   * back so the server can check it with Razorpay before confirming the order.
   */
  const pay = useCallback(async () => {
    if (!order) return;
    setPaying(true);
    setPayError(null);
    try {
      const session = await paymentApi.start(order.orderNumber);
      const result = await payWithRazorpay(session, setPayError);
      setPayError(null);
      const updated = await paymentApi.verify(order.orderNumber, {
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });
      setOrder(updated);
      if (updated.status === 'confirmed') notify({ title: 'Payment received', body: `Order ${updated.orderNumber} is confirmed.` });
    } catch (err) {
      if (err instanceof PaymentDismissed) return; // closed the window: keep any "attempt failed" message visible
      setPayError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      if (err instanceof ApiError && ['PAYMENT_WINDOW_CLOSED', 'ORDER_NOT_PAYABLE', 'PAYMENT_VERIFICATION_FAILED'].includes(err.code)) void load();
    } finally {
      setPaying(false);
    }
  }, [order, notify, load]);

  // Straight after checkout, open the payment window without an extra click.
  useEffect(() => {
    if (state?.payNow && order?.canPay && !autoOpened.current) {
      autoOpened.current = true;
      void pay();
    }
  }, [state?.payNow, order?.canPay, pay]);

  if (status === 'unavailable') return <NotFound />;
  if (status === 'signed-out') return <Navigate to={`/account?next=/orders/${encodeURIComponent(orderNumber)}`} replace />;
  if (error?.status === 404 || error?.status === 400) return <NotFound />;

  const cancel = async () => {
    if (!order || !window.confirm('Cancel this order? Your reserved pieces will go back on sale.')) return;
    setCancelling(true);
    try {
      setOrder(await orderApi.cancel(order.orderNumber));
      notify({ title: 'Order cancelled', body: order.orderNumber });
    } catch (err) {
      notify({ title: 'Couldn’t cancel the order', body: err instanceof ApiError ? err.message : 'Please try again.' });
      void load();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <PageIntro eyebrow="Order" title={[orderNumber]}>
        {order && (
          <span className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <span>Placed {formatDateTime(order.placedAt)}</span>
          </span>
        )}
      </PageIntro>

      <section className="site-container pb-24 md:pb-36">
        <AnimatePresence>
          {state?.justPlaced && order && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="mb-10 flex items-start gap-4"
            >
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stamp text-paper">
                <Check strokeWidth={1.5} className="h-4 w-4" />
              </span>
              <div>
                <p className="display text-3xl">{order.status === 'confirmed' ? 'Order confirmed. Thank you!' : 'Order placed. Thank you!'}</p>
                <p className="mt-1 text-sm text-graphite">Keep your order number handy: {orderNumber}.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <CatalogueError error={error} onRetry={() => void load()} title="Couldn’t load this order." />
        ) : !order ? (
          <div aria-busy="true" className="grid gap-10 lg:grid-cols-12">
            <div className="h-64 animate-pulse bg-card lg:col-span-7" />
            <div className="h-64 animate-pulse bg-newsprint lg:col-span-5" />
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="space-y-10 lg:col-span-7">
              <StatusPanel order={order} onCancel={cancel} cancelling={cancelling} onPay={() => void pay()} paying={paying} payError={payError} />
              <div>
                <p className="eyebrow border-b border-ink pb-4">Items</p>
                <ul className="divide-y divide-rule">
                  {order.items.map((item) => (
                    <li key={item.sku} className="grid grid-cols-[80px_1fr_auto] gap-5 py-5">
                      <Link to={`/product/${item.productSlug}`} className="block aspect-[4/5] overflow-hidden bg-card">
                        {item.imageUrl && <img decoding="async" src={sized(mediaUrl(item.imageUrl), 320)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </Link>
                      <div className="min-w-0 text-sm">
                        <Link to={`/product/${item.productSlug}`} className="hover:underline">{item.productName}</Link>
                        <p className="mt-1 text-xs text-graphite">{item.colorName} · {sizeLabel(item.size)} · Qty {item.quantity}</p>
                        <p className="mt-1 text-xs text-graphite">{formatPrice(paiseToRupees(item.unitPrice))} each</p>
                      </div>
                      <p className="text-sm tabular-nums">{formatPrice(paiseToRupees(item.lineTotal))}</p>
                    </li>
                  ))}
                </ul>
              </div>
              {order.timeline.length > 0 && (
                <div>
                  <p className="eyebrow border-b border-ink pb-4">History</p>
                  <ol className="divide-y divide-rule">
                    {order.timeline.map((e, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                        <span>{e.message}</span>
                        <span className="shrink-0 text-xs text-graphite">{formatDateTime(e.at)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <aside className="space-y-8 lg:col-span-5" aria-label="Order summary">
              <div className="bg-newsprint p-6 md:p-8">
                <p className="eyebrow mb-4">Delivering to</p>
                <address className="text-sm not-italic leading-relaxed">
                  {order.shippingAddress.fullName}<br />
                  {order.shippingAddress.line1}<br />
                  {order.shippingAddress.line2 && <>{order.shippingAddress.line2}<br /></>}
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}<br />
                  <span className="text-graphite">+91 {order.shippingAddress.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}</span>
                </address>
              </div>
              <div className="bg-newsprint p-6 md:p-8">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-graphite">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(paiseToRupees(order.subtotal))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-graphite">Shipping</dt>
                    <dd className="tabular-nums">{order.shipping.amountPaise === 0 ? 'Complimentary' : formatPrice(paiseToRupees(order.shipping))}</dd>
                  </div>
                  <div className="flex justify-between border-t border-graphite/25 pt-4 text-base">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatPrice(paiseToRupees(order.total))}</dd>
                  </div>
                </dl>
              </div>
              <ButtonLink to="/orders" variant="outline" full>All orders</ButtonLink>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
