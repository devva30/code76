import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, Lock } from 'lucide-react';
import { ApiError, orderApi, paiseToRupees, type AddressInput, sized } from '@/lib/api';
import { INDIAN_STATES } from '@/lib/indianStates';
import { useAuth } from '@/store/AuthContext';
import { useShop } from '@/store/ShopContext';
import { lineIssueText } from '@/components/layout/CartDrawer';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/FormField';
import { BRAND } from '@/config/brand';
import { sizeLabel } from '@/data/products';
import { formatPrice } from '@/lib/format';

type FieldName = keyof AddressInput;
type Errors = Partial<Record<FieldName, string>>;

/** One id per checkout attempt: resubmitting (double-click, retry) returns the same order, never a second one. */
const newCheckoutKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

/** Accepts "98765 43210", "+91 98765-43210", "09876543210"…; returns the 10 digits. */
const normalisePhone = (raw: string) => {
  let d = raw.replace(/[\s()-]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};

function validate(a: AddressInput): Errors {
  const e: Errors = {};
  if (!a.fullName.trim()) e.fullName = 'Please enter the recipient’s name.';
  if (!/^[6-9]\d{9}$/.test(normalisePhone(a.phone))) e.phone = 'Enter a 10-digit Indian mobile number.';
  if (!a.line1.trim()) e.line1 = 'Please enter the house number and street.';
  if (!a.city.trim()) e.city = 'Please enter the city.';
  if (!a.state) e.state = 'Please choose a state.';
  if (!/^[1-9]\d{5}$/.test(a.pincode.replace(/\s/g, ''))) e.pincode = 'Enter a 6-digit PIN code.';
  return e;
}

function CheckoutSkeleton() {
  return (
    <div className="site-container grid gap-12 pb-24 lg:grid-cols-12 lg:gap-16" aria-busy="true">
      <div className="space-y-8 lg:col-span-7">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse bg-card" />
        ))}
      </div>
      <div className="h-80 animate-pulse bg-newsprint lg:col-span-5" />
    </div>
  );
}

export default function Checkout() {
  const { status, user } = useAuth();
  const { lines, accountCart, refreshCart, notify } = useShop();
  const navigate = useNavigate();
  const id = useId();
  const [address, setAddress] = useState<AddressInput>({ fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [checkoutKey] = useState(newCheckoutKey);

  useEffect(() => {
    document.title = `Checkout — ${BRAND.name}`;
  }, []);

  // Start with the account holder's name; they can change it if the order is a gift.
  useEffect(() => {
    if (user) setAddress((a) => (a.fullName ? a : { ...a, fullName: user.name }));
  }, [user]);

  if (status === 'unavailable') {
    return (
      <>
        <PageIntro eyebrow="Checkout" title={['Checkout']}>Checkout needs the CODE76 server, which isn’t connected in this preview.</PageIntro>
        <div className="site-container pb-24"><ButtonLink to="/cart" variant="outline">Back to your bag</ButtonLink></div>
      </>
    );
  }
  if (status === 'signed-out') return <Navigate to="/account?next=/checkout" replace />;

  const set = (field: FieldName) => (value: string) => {
    setAddress((a) => ({ ...a, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(address);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setPlacing(true);
    try {
      const order = await orderApi.place({ ...address, phone: normalisePhone(address.phone), pincode: address.pincode.replace(/\s/g, '') }, checkoutKey);
      await refreshCart().catch(() => undefined);
      navigate(`/orders/${order.orderNumber}`, { state: { justPlaced: true, payNow: order.canPay } });
    } catch (err) {
      setPlacing(false);
      if (!(err instanceof ApiError)) return setFormError('Something went wrong. Please try again.');
      if (err.code === 'CART_NEEDS_ATTENTION' || err.code === 'CART_EMPTY') {
        await refreshCart().catch(() => undefined);
        setFormError(err.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const byField: Errors = {};
      for (const f of err.fieldErrors) {
        const name = f.field.replace(/^address\./, '') as FieldName;
        if (name in address && !byField[name]) byField[name] = `This ${f.message}.`;
      }
      if (Object.keys(byField).length) return setErrors(byField);
      if (err.status === 0) notify({ title: 'You seem to be offline', body: 'Your order wasn’t placed. Try again when you’re connected.' });
      setFormError(err.message);
    }
  };

  const loadingCart = status === 'loading' || (status === 'signed-in' && !accountCart);
  const cart = accountCart;
  const needsAttention = cart && !cart.readyForCheckout && cart.lines.length > 0;

  const input = (field: FieldName, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      id={`${id}-${field}`}
      value={address[field]}
      onChange={(e) => set(field)(e.target.value)}
      aria-invalid={!!errors[field]}
      aria-describedby={errors[field] ? `${id}-${field}-msg` : undefined}
      className={inputClass}
      {...props}
    />
  );

  return (
    <>
      <PageIntro eyebrow="Checkout" title={['Delivery', <span className="italic">details</span>]} />

      {loadingCart ? (
        <CheckoutSkeleton />
      ) : !cart || lines.length === 0 ? (
        <div className="site-container pb-24">
          <div className="flex flex-col items-center border-y border-rule py-24 text-center">
            <p className="display text-4xl">Your bag is empty.</p>
            <p className="mt-4 max-w-sm text-sm text-graphite">Add a few pieces, then come back here to check out.</p>
            <div className="mt-8"><ButtonLink to="/shop" arrow>Shop all</ButtonLink></div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate aria-label="Checkout" className="site-container grid gap-12 pb-24 md:pb-32 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <AnimatePresence>
              {(formError || needsAttention) && (
                <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-10 border-l-2 border-stamp bg-newsprint px-5 py-4 text-sm">
                  <p className="text-[rgb(var(--c-stamp))]">{formError ?? 'Some items in your bag need attention before you can check out.'}</p>
                  {needsAttention && <Link to="/cart" className="link-underline mt-2 inline-block text-xs text-ink">Review your bag</Link>}
                </motion.div>
              )}
            </AnimatePresence>

            <fieldset className="grid gap-7 sm:grid-cols-2">
              <legend className="eyebrow mb-7">Delivery address</legend>
              <Field id={`${id}-fullName`} label="Full name" error={errors.fullName} className="sm:col-span-2">
                {input('fullName', { autoComplete: 'name', maxLength: 80 })}
              </Field>
              <Field id={`${id}-phone`} label="Mobile number" error={errors.phone} hint="For delivery updates only." className="sm:col-span-2">
                <span className="pr-2 text-base text-graphite" aria-hidden>+91</span>
                {input('phone', {
                  type: 'tel',
                  inputMode: 'tel',
                  autoComplete: 'tel-national',
                  placeholder: '98765 43210',
                  maxLength: 16,
                  // "+91 98765-43210" → "98765 43210": the +91 is already shown in front of the box.
                  onBlur: () => {
                    const digits = normalisePhone(address.phone);
                    if (/^[6-9]\d{9}$/.test(digits)) set('phone')(`${digits.slice(0, 5)} ${digits.slice(5)}`);
                  },
                })}
              </Field>
              <Field id={`${id}-line1`} label="Flat, house no., street" error={errors.line1} className="sm:col-span-2">
                {input('line1', { autoComplete: 'address-line1', maxLength: 120 })}
              </Field>
              <Field id={`${id}-line2`} label="Area, landmark (optional)" className="sm:col-span-2">
                {input('line2', { autoComplete: 'address-line2', maxLength: 120 })}
              </Field>
              <Field id={`${id}-city`} label="City" error={errors.city}>
                {input('city', { autoComplete: 'address-level2', maxLength: 60 })}
              </Field>
              <Field id={`${id}-pincode`} label="PIN code" error={errors.pincode}>
                {input('pincode', { inputMode: 'numeric', autoComplete: 'postal-code', placeholder: '560001', maxLength: 7 })}
              </Field>
              <Field id={`${id}-state`} label="State" error={errors.state} className="sm:col-span-2">
                <select
                  id={`${id}-state`}
                  value={address.state}
                  onChange={(e) => set('state')(e.target.value)}
                  autoComplete="address-level1"
                  aria-invalid={!!errors.state}
                  aria-describedby={errors.state ? `${id}-state-msg` : undefined}
                  className={`${inputClass} cursor-pointer appearance-none ${address.state ? '' : 'text-graphite/70'}`}
                >
                  <option value="" disabled>Choose a state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown strokeWidth={1.25} className="pointer-events-none h-4 w-4 shrink-0" aria-hidden />
              </Field>
            </fieldset>

            <div className="mt-12">
              <p className="eyebrow mb-4">Payment</p>
              <div className="flex gap-4 border border-rule p-5 text-sm leading-relaxed">
                <Clock strokeWidth={1.4} className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--c-stamp))]" aria-hidden />
                <p className="text-graphite">
                  <span className="text-ink">Pay securely with Razorpay: UPI, cards, netbanking or wallets.</span> The payment window opens as soon as you place your order,
                  and your pieces are reserved for 30 minutes while you pay. If it isn’t paid in that time, the order expires and nothing is charged.
                </p>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5" aria-label="Order summary">
            <div className="bg-newsprint p-6 md:p-10 lg:sticky lg:top-[calc(var(--nav-offset,var(--header-h))+2rem)]">
              <h2 className="display text-4xl">Your order</h2>
              <ul className="mt-8 divide-y divide-graphite/15">
                {lines.map((l) => (
                  <li key={l.key} className="flex gap-4 py-4">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-card">
                      {l.image && <img decoding="async" src={sized(l.image, 320)} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute -right-0 -top-0 flex h-5 min-w-5 items-center justify-center bg-ink px-1 font-mono text-[0.6rem] text-paper">{l.qty}</span>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate">{l.product.name}</p>
                      <p className="mt-1 text-xs text-graphite">{l.colorName} · {sizeLabel(l.size)}</p>
                      {lineIssueText(l) && <p className="mt-1 text-xs text-[rgb(var(--c-stamp))]">{lineIssueText(l)}</p>}
                    </div>
                    <p className="shrink-0 text-sm tabular-nums">{formatPrice(l.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="mt-6 space-y-3 border-t border-graphite/25 pt-6 text-sm">
                <div className="flex justify-between">
                  <dt className="text-graphite">Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(paiseToRupees(cart.subtotal))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-graphite">Shipping</dt>
                  <dd className="tabular-nums">{cart.shipping.amountPaise === 0 ? 'Complimentary' : formatPrice(paiseToRupees(cart.shipping))}</dd>
                </div>
                <div className="flex justify-between border-t border-graphite/25 pt-4 text-base">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatPrice(paiseToRupees(cart.total))}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-graphite">Inclusive of all taxes.</p>
              <div className="mt-8">
                <Button type="submit" full arrow disabled={placing || !cart.readyForCheckout}>
                  {placing ? 'Placing your order…' : `Place order — ${formatPrice(paiseToRupees(cart.total))}`}
                </Button>
              </div>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-graphite">
                <Lock strokeWidth={1.4} className="h-3.5 w-3.5" aria-hidden /> Prices and stock are confirmed by our server.
              </p>
            </div>
          </aside>
        </form>
      )}
    </>
  );
}
