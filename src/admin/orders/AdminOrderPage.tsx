import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, ExternalLink, Phone } from 'lucide-react';
import { mediaUrl, paiseToRupees } from '@/lib/api';
import { sizeLabel } from '@/data/products';
import { formatPrice } from '@/lib/format';
import { OrderStatusBadge, formatDateTime } from '@/components/orders/OrderBits';
import { adminApi, type AdminOrderDetail } from '../adminApi';
import { AdminButton, AdminPage, Badge, Card, Dialog, ErrorBox, Loading, TextArea, TextField, errorMessage, useLoad } from '../ui';

function ShipDialog({ orderNumber, onClose, onDone }: { orderNumber: string; onClose: () => void; onDone: (d: AdminOrderDetail) => void }) {
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await adminApi.orders.ship(orderNumber, { courier, trackingNumber, trackingUrl }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Ship ${orderNumber}`} footer={
      <>
        <AdminButton variant="outline" onClick={onClose}>Cancel</AdminButton>
        <AdminButton onClick={save} busy={busy} disabled={!courier.trim() || !trackingNumber.trim()}>Mark as shipped</AdminButton>
      </>
    }>
      <div className="space-y-5">
        <TextField label="Courier" value={courier} onChange={setCourier} placeholder="e.g. Delhivery, Blue Dart, India Post" maxLength={80} />
        <TextField label="Tracking number" value={trackingNumber} onChange={setTrackingNumber} maxLength={80} />
        <TextField label="Tracking link (optional)" value={trackingUrl} onChange={setTrackingUrl} placeholder="https://…" maxLength={500} hint="The customer gets a “Track package” button." />
        <p className="text-xs text-graphite">The customer sees the courier and tracking number on their order page straight away.</p>
        {error && <ErrorBox error={error} />}
      </div>
    </Dialog>
  );
}

function CancelDialog({ detail, onClose, onDone }: { detail: AdminOrderDetail; onClose: () => void; onDone: (d: AdminOrderDetail) => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = detail.order.status === 'confirmed';
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await adminApi.orders.cancel(detail.order.orderNumber, reason));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Cancel ${detail.order.orderNumber}`} footer={
      <>
        <AdminButton variant="outline" onClick={onClose}>Keep the order</AdminButton>
        <AdminButton variant="danger" onClick={save} busy={busy} disabled={!reason.trim()}>
          {paid ? `Cancel and refund ${formatPrice(paiseToRupees(detail.order.total))}` : 'Cancel order'}
        </AdminButton>
      </>
    }>
      <div className="space-y-4 text-sm">
        <p>
          {paid
            ? 'This order is paid. Cancelling puts the pieces back in stock and refunds the full amount through Razorpay. This can’t be undone.'
            : 'This order hasn’t been paid. Cancelling releases the reserved pieces.'}
        </p>
        <TextArea label="Reason (shown to the customer)" value={reason} onChange={setReason} rows={3} maxLength={300} placeholder="e.g. Sorry, this size was damaged in our warehouse." />
        {error && <ErrorBox error={error} />}
      </div>
    </Dialog>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard?.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} aria-label={label} className="inline-flex items-center gap-1 text-xs text-graphite hover:text-ink">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function AdminOrderPage() {
  const { orderNumber = '' } = useParams();
  const loaded = useLoad((signal) => adminApi.orders.get(orderNumber, signal), [orderNumber]);
  const [dialog, setDialog] = useState<'ship' | 'cancel' | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = loaded.data;

  const deliver = async () => {
    if (!window.confirm('Mark this order as delivered?')) return;
    setDelivering(true);
    setError(null);
    try {
      loaded.setData(await adminApi.orders.deliver(orderNumber));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDelivering(false);
    }
  };

  const a = d?.order.shippingAddress;
  const addressText = a ? [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, `+91 ${a.phone}`].filter(Boolean).join('\n') : '';

  return (
    <AdminPage title={orderNumber} description={<Link to="/admin/orders" className="hover:underline">← All orders</Link>}
      actions={d && (
        <>
          {d.canShip && <AdminButton onClick={() => setDialog('ship')}>Mark as shipped</AdminButton>}
          {d.canDeliver && <AdminButton onClick={deliver} busy={delivering}>Mark as delivered</AdminButton>}
          {d.canCancel && <AdminButton variant="danger" onClick={() => setDialog('cancel')}>Cancel order</AdminButton>}
        </>
      )}>
      {loaded.error ? (
        <ErrorBox error={loaded.error} onRetry={loaded.reload} />
      ) : !d ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {error && <ErrorBox error={error} />}
          <div className="flex flex-wrap items-center gap-3 border border-rule bg-paper px-5 py-3 text-sm">
            <OrderStatusBadge status={d.order.status} />
            <span className="text-graphite">Placed {formatDateTime(d.order.placedAt)}</span>
            {d.order.paidAt && <span className="text-graphite">· Paid {formatDateTime(d.order.paidAt)}</span>}
            {d.order.status === 'confirmed' && <span className="font-medium">· Ready to pack and ship</span>}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card title="Items" padded={false}>
                <ul className="divide-y divide-rule">
                  {d.order.items.map((item) => (
                    <li key={item.sku} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <div className="h-16 w-12 shrink-0 overflow-hidden bg-newsprint">
                        {item.imageUrl && <img src={mediaUrl(item.imageUrl)} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{item.productName}</p>
                        <p className="text-xs text-graphite">{item.colorName} · Size {sizeLabel(item.size)} · {item.sku}</p>
                      </div>
                      <span className="text-graphite">× {item.quantity}</span>
                      <span className="w-20 text-right tabular-nums">{formatPrice(paiseToRupees(item.lineTotal))}</span>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 border-t border-rule px-5 py-4 text-sm">
                  <div className="flex justify-between"><dt className="text-graphite">Subtotal</dt><dd className="tabular-nums">{formatPrice(paiseToRupees(d.order.subtotal))}</dd></div>
                  <div className="flex justify-between"><dt className="text-graphite">Shipping</dt><dd className="tabular-nums">{d.order.shipping.amountPaise === 0 ? 'Free' : formatPrice(paiseToRupees(d.order.shipping))}</dd></div>
                  <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPrice(paiseToRupees(d.order.total))}</dd></div>
                </dl>
              </Card>

              <Card title="Timeline" padded={false}>
                <ol className="divide-y divide-rule">
                  {d.history.map((e, i) => (
                    <li key={i} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[1fr_auto] sm:gap-6">
                      <div>
                        <p>{e.message}</p>
                        <p className="text-xs text-graphite">{e.actor}</p>
                      </div>
                      <span className="text-xs text-graphite">{formatDateTime(e.at)}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="Customer">
                <p className="text-sm font-medium">{d.customerName}</p>
                <a href={`mailto:${d.customerEmail}`} className="block break-all text-sm text-graphite hover:text-ink">{d.customerEmail}</a>
              </Card>
              <Card title="Deliver to" actions={<CopyButton text={addressText} label="Copy address" />}>
                <address className="whitespace-pre-line text-sm not-italic leading-relaxed">{addressText}</address>
                {a && <a href={`tel:+91${a.phone}`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-graphite hover:text-ink"><Phone className="h-3.5 w-3.5" /> Call customer</a>}
              </Card>
              {d.order.shipment && (
                <Card title="Shipment">
                  <p className="text-sm">{d.order.shipment.courier}</p>
                  <p className="font-mono text-xs">{d.order.shipment.trackingNumber}</p>
                  {d.order.shipment.trackingUrl && (
                    <a href={d.order.shipment.trackingUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs text-graphite hover:text-ink">
                      <ExternalLink className="h-3.5 w-3.5" /> Tracking page
                    </a>
                  )}
                </Card>
              )}
              <Card title="Payment">
                {d.payments.length === 0 ? (
                  <p className="text-sm text-graphite">No payment started.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {d.payments.map((p) => (
                      <li key={p.razorpayOrderId}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular-nums">{formatPrice(paiseToRupees(p.amount))}</span>
                          <Badge tone={p.status === 'paid' ? 'good' : p.status === 'refunded' ? 'alert' : 'muted'}>{p.status === 'created' ? 'Not paid' : p.status}</Badge>
                        </div>
                        <p className="mt-1 break-all font-mono text-[0.65rem] text-graphite">{p.razorpayPaymentId ?? p.razorpayOrderId}</p>
                        {p.refundId && <p className="break-all font-mono text-[0.65rem] text-graphite">Refund {p.refundId}</p>}
                        {p.failureReason && <p className="text-xs text-graphite">Last attempt failed: {p.failureReason}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {d && dialog === 'ship' && <ShipDialog orderNumber={orderNumber} onClose={() => setDialog(null)} onDone={(x) => { loaded.setData(x); setDialog(null); }} />}
      {d && dialog === 'cancel' && <CancelDialog detail={d} onClose={() => setDialog(null)} onDone={(x) => { loaded.setData(x); setDialog(null); }} />}
    </AdminPage>
  );
}
