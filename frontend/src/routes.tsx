import type { RouteObject } from 'react-router'

import { AppLayout } from './components/AppLayout'
import { RouteError } from './components/RouteError'
import { receiptLoader, receiptsLoader } from './loaders'
import { NotFoundPage } from './pages/NotFoundPage'
import { ReceiptListPage, ReceiptListSkeleton } from './pages/ReceiptListPage'
import { ReceiptPage, ReceiptSkeleton } from './pages/ReceiptPage'
import { UploadPage } from './pages/UploadPage'

// Shared by the browser router (main.tsx) and the memory router in tests.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      {
        // Pathless route: a failing page shows its error inside the layout.
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            element: <ReceiptListPage />,
            loader: receiptsLoader,
            hydrateFallbackElement: <ReceiptListSkeleton />,
          },
          { path: 'upload', element: <UploadPage /> },
          {
            path: 'receipts/:id',
            element: <ReceiptPage />,
            loader: receiptLoader,
            hydrateFallbackElement: <ReceiptSkeleton />,
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
