import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from '@/store/AuthContext';
import { SiteContentProvider } from '@/store/SiteContent';
import { ShopProvider } from '@/store/ShopContext';
import { SmoothScroll } from '@/lib/SmoothScroll';
import './index.css';


if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SmoothScroll>
      <SiteContentProvider>
        <AuthProvider>
          <ShopProvider>
            <App />
          </ShopProvider>
        </AuthProvider>
      </SiteContentProvider>
    </SmoothScroll>
  </StrictMode>,
);
