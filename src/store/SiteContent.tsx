import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_BASE_URL, mediaUrl, request, type MoneyDto } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { SectionKey, SiteSections, SiteSettings } from '@/content/types';
import { liveSettings } from '@/config/liveSettings';
// The original content, shared with the server: used until the server answers, and as the
// whole content when no server is connected (static preview).
import defaultsJson from '../../server/src/main/resources/content/defaults.json';

const DEFAULTS = defaultsJson as unknown as SiteSections;

const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'CODE76',
  tagline: 'Everyday, redefined.',
  supportEmail: 'support@code76.example',
  freeShippingThreshold: 2999,
  shippingFee: 99,
  maxQuantityPerLine: 10,
};

interface SiteDto {
  settings: {
    storeName: string;
    tagline: string;
    supportEmail: string;
    freeShippingThreshold: MoneyDto;
    shippingFee: MoneyDto;
    maxQuantityPerLine: number;
  };
  content: Partial<Record<SectionKey, Record<string, unknown>>>;
}

interface SiteState {
  sections: SiteSections;
  settings: SiteSettings;
  ready: boolean;
}

const SiteContext = createContext<SiteState>({ sections: DEFAULTS, settings: DEFAULT_SETTINGS, ready: true });

/** Saved content laid over the original, so a field missing on the server never breaks a page. */
function merge(server: SiteDto['content']): SiteSections {
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as SectionKey[]) {
    const saved = server[key];
    if (saved && typeof saved === 'object') out[key] = { ...(DEFAULTS[key] as object), ...saved };
  }
  return out as unknown as SiteSections;
}

/** Loads the website's content and settings once, when the site opens. */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteState>({ sections: DEFAULTS, settings: DEFAULT_SETTINGS, ready: !API_BASE_URL });

  useEffect(() => {
    if (!API_BASE_URL) return;
    let done = false;
    // Never keep shoppers waiting on a slow connection: after 4 s, show the original content.
    const fallback = window.setTimeout(() => {
      if (!done) setState((s) => ({ ...s, ready: true }));
    }, 4000);
    request<SiteDto>('/api/site')
      .then((site) => {
        done = true;
        Object.assign(liveSettings, {
          storeName: site.settings.storeName,
          tagline: site.settings.tagline,
          supportEmail: site.settings.supportEmail,
          freeShippingThreshold: site.settings.freeShippingThreshold.amountPaise / 100,
        });
        setState({
          sections: merge(site.content),
          settings: {
            storeName: site.settings.storeName,
            tagline: site.settings.tagline,
            supportEmail: site.settings.supportEmail,
            freeShippingThreshold: site.settings.freeShippingThreshold.amountPaise / 100,
            shippingFee: site.settings.shippingFee.amountPaise / 100,
            maxQuantityPerLine: site.settings.maxQuantityPerLine,
          },
          ready: true,
        });
      })
      .catch(() => {
        done = true;
        setState((s) => ({ ...s, ready: true }));
      });
    return () => window.clearTimeout(fallback);
  }, []);

  return <SiteContext.Provider value={state}>{children}</SiteContext.Provider>;
}

export function useContent<K extends SectionKey>(key: K): SiteSections[K] {
  return useContext(SiteContext).sections[key];
}

export function useSettings(): SiteSettings {
  return useContext(SiteContext).settings;
}

export function useSiteReady(): boolean {
  return useContext(SiteContext).ready;
}

/** Fills {store}, {year}, {email} and {freeShipping} in admin-written text. */
export function useFill() {
  const s = useSettings();
  return useCallback(
    (text: string) =>
      text
        .split('{store}').join(s.storeName)
        .split('{year}').join(String(new Date().getFullYear()))
        .split('{email}').join(s.supportEmail)
        .split('{freeShipping}').join(formatPrice(s.freeShippingThreshold)),
    [s],
  );
}

/** Image address ready for <img>: uploaded images come from the API server. */
export const img = (url: string) => mediaUrl(url);

/** True for links that leave this site (they open as normal links, not app navigation). */
export const isExternal = (link: string) => /^(https:|mailto:)/.test(link);
