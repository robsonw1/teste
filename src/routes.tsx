import { createBrowserRouter } from 'react-router-dom';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/admin/Dashboard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Index />,
  },
  {
    path: '/admin',
    element: <Dashboard />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);