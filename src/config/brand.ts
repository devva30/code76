/**
 * Brand configuration. The store name, tagline, support email and free-shipping amount come from
 * Admin → Store settings (via liveSettings); everything else here is technical. The logo artwork
 * lives in components/ui/Wordmark.tsx (master file: public/brand/code76-logo.svg).
 */
import { liveSettings } from './liveSettings';

export const BRAND = {
  get name() {
    return liveSettings.storeName;
  },
  get tagline() {
    return liveSettings.tagline;
  },
  get supportEmail() {
    return liveSettings.supportEmail;
  },
  /** In rupees. */
  get freeShippingThreshold() {
    return liveSettings.freeShippingThreshold;
  },
  currency: 'INR',
  locale: 'en-IN',
  storageKeys: {
    cart: 'c76.cart.v1',
    wishlist: 'c76.wishlist.v1',
  },
} as const;
