/**
 * Opens Razorpay Checkout, Razorpay's own payment window. Card and UPI details are typed into
 * Razorpay's window and never touch CODE76's code or servers.
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */
import type { PaymentSessionDto } from './api';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error: { description?: string; reason?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Loads Razorpay's script once, the first time someone pays. */
function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Razorpay could not be loaded. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export class PaymentDismissed extends Error {
  constructor() {
    super('Payment window closed.');
    this.name = 'PaymentDismissed';
  }
}

/**
 * Opens the payment window. Resolves with Razorpay's signed result on success; rejects with
 * PaymentDismissed if the customer closes the window. Failed attempts are reported through
 * onAttemptFailed while the window stays open, so the customer can try another method.
 */
export async function payWithRazorpay(session: PaymentSessionDto, onAttemptFailed: (message: string) => void): Promise<RazorpaySuccess> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay could not be loaded. Check your connection and try again.');

  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const checkout = new Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amount.amountPaise,
      currency: session.amount.currency,
      name: session.businessName,
      description: session.description,
      prefill: session.prefill,
      notes: { order_number: session.orderNumber },
      theme: { color: '#282C3F' },
      // Close the window before the order's stock hold runs out.
      timeout: Math.max(60, session.timeoutSeconds - 15),
      handler: (response: RazorpaySuccess) => resolve(response),
      modal: { ondismiss: () => reject(new PaymentDismissed()), confirm_close: true },
    });
    checkout.on('payment.failed', (response) => {
      onAttemptFailed(response.error?.description || 'The payment didn’t go through. You can try again or use another method.');
    });
    checkout.open();
  });
}
