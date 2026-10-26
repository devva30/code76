import { useEffect, useState } from 'react';
import type { OrderStatus } from '@/lib/api';
import { BRAND } from '@/config/brand';
import { cx } from '@/lib/format';

const LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const orderStatusLabel = (status: OrderStatus) => LABELS[status];

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const tone =
    status === 'pending_payment'
      ? 'border-stamp text-[rgb(var(--c-stamp))]'
      : status === 'cancelled' || status === 'expired'
        ? 'border-rule text-graphite'
        : 'border-ink bg-ink text-paper';
  return (
    <span className={cx('inline-flex h-6 items-center border px-2 font-mono text-[0.6rem] font-medium uppercase tracking-[0.1em]', tone, className)}>
      {LABELS[status]}
    </span>
  );
}

const dateTime = new Intl.DateTimeFormat(BRAND.locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const time = new Intl.DateTimeFormat(BRAND.locale, { hour: 'numeric', minute: '2-digit' });

/** e.g. "22 Oct 2026, 4:15 pm" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
/** e.g. "4:45 pm" */
export const formatTime = (iso: string) => time.format(new Date(iso));

/** Live "mm:ss" until a moment; null once it has passed. */
export function useCountdown(untilIso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!untilIso) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [untilIso]);
  if (!untilIso) return null;
  const ms = new Date(untilIso).getTime() - now;
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
