import { data, type LoaderFunctionArgs } from 'react-router'

import { getReceipt, getReceipts } from './api'

// Route loaders fetch before the page renders; the request signal cancels the fetch when the
// user navigates away mid-load.

export function receiptsLoader({ request }: LoaderFunctionArgs) {
  return getReceipts(request.signal)
}

export function receiptLoader({ params, request }: LoaderFunctionArgs) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id < 1) {
    throw data('Receipt not found', { status: 404 })
  }
  return getReceipt(id, request.signal)
}
