import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

import Shop from '@/pages/Shop';
import Product from '@/pages/Product';
import About from '@/pages/About';
import Cart from '@/pages/Cart';
import Account from '@/pages/Account';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Checkout from '@/pages/Checkout';
import Offers from '@/pages/Offers';


const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/shop', element: <Shop /> },
      { path: '/collections/:handle', element: <Shop /> },
      { path: '/product/:slug', element: <Product /> },
      { path: '/about', element: <About /> },
      { path: '/offers', element: <Offers /> },
      { path: '/cart', element: <Cart /> },
      { path: '/account', element: <Account /> },
      { path: '/checkout', element: <Checkout /> },
      { path: '/orders', element: <Orders /> },
      { path: '/orders/:orderNumber', element: <OrderDetail /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  // The admin panel has its own layout and is only downloaded when an admin opens it.
  { path: '/admin/*', lazy: async () => ({ Component: (await import('@/admin/AdminApp')).default }) },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
