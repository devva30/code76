/**
 * Store settings as loaded from the server (Admin → Store settings). Filled in by
 * SiteContentProvider before any page renders; BRAND reads from here, so page titles, labels and
 * the free-shipping amount always match the admin. Starts with the original values.
 */
export const liveSettings = {
  storeName: 'CODE76',
  tagline: 'Everyday, redefined.',
  supportEmail: 'support@code76.example',
  freeShippingThreshold: 2999,
};
