import { BRAND } from '@/config/brand';

const inr = new Intl.NumberFormat(BRAND.locale, {
  style: 'currency',
  currency: BRAND.currency,
  maximumFractionDigits: 0,
});

export const formatPrice = (value: number) => inr.format(value);

/** Whole-number discount percentage, e.g. 15 for 15% off. */
export const discountPercent = (price: number, compareAt?: number) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
