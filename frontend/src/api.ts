// Types mirror the backend response schemas (backend/app/api/schemas.py).
// Amounts are decimal strings ("3.49"), so no precision is lost on the way.

export type Category =
  | 'bakery'
  | 'dairy'
  | 'meat'
  | 'fruits_vegetables'
  | 'drinks'
  | 'sweets_snacks'
  | 'alcohol'
  | 'household_chemicals'
  | 'cosmetics'
  | 'clothing'
  | 'home'
  | 'other'

export type ReceiptStatus = 'ok' | 'needs_review'

export interface ReceiptItem {
  id: number
  raw_name: string
  quantity: string
  unit_price: string
  total_price: string
  discount: string
  category: Category
}

export interface ReceiptSummary {
  id: number
  store_name: string
  purchase_date: string
  total: string
  status: ReceiptStatus
  created_at: string
  item_count: number
}

export interface Receipt {
  id: number
  store_name: string
  store_nip: string | null
  purchase_date: string
  total: string
  status: ReceiptStatus
  created_at: string
  items: ReceiptItem[]
}

/** The API answered with an error status. */
export class ApiError extends Error {
  readonly status: number
  /** The `detail` of the error body: a message, or an object with a machine-readable code. */
  readonly detail: unknown

  constructor(status: number, message: string, detail: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// The dev server (and later the reverse proxy) forwards /api to the backend.
const API_BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    const detail = await errorDetail(response)
    throw new ApiError(response.status, errorMessage(response, detail), detail)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

async function errorDetail(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json()
    return body && typeof body === 'object' && 'detail' in body ? body.detail : null
  } catch {
    return null // Not JSON, e.g. an error page from a proxy.
  }
}

function errorMessage(response: Response, detail: unknown): string {
  if (typeof detail === 'string') {
    return detail
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String(detail.message)
  }
  return response.statusText || `HTTP ${response.status}`
}

/**
 * The fields ("purchase_date", "total") that the photos did not show, when the API refused
 * a receipt as incomplete; null for any other error.
 */
export function missingReceiptFields(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return null
  }
  const { detail } = error
  if (
    detail &&
    typeof detail === 'object' &&
    'code' in detail &&
    detail.code === 'incomplete_receipt' &&
    'missing' in detail &&
    Array.isArray(detail.missing)
  ) {
    return detail.missing.map(String)
  }
  return null
}

export function getReceipts(signal?: AbortSignal): Promise<ReceiptSummary[]> {
  return request('/receipts', { signal })
}

export function getReceipt(id: number, signal?: AbortSignal): Promise<Receipt> {
  return request(`/receipts/${id}`, { signal })
}

/** Upload the photos of one receipt; a long receipt comes in parts, top to bottom. */
export function uploadReceipt(photos: File[]): Promise<Receipt> {
  const body = new FormData()
  for (const photo of photos) {
    body.append('files', photo)
  }
  return request('/receipts', { method: 'POST', body })
}

// PATCH bodies carry only the fields that changed.
export type ReceiptChanges = Partial<
  Pick<Receipt, 'store_name' | 'store_nip' | 'purchase_date' | 'total'>
>
export type ReceiptItemChanges = Partial<
  Pick<ReceiptItem, 'raw_name' | 'quantity' | 'unit_price' | 'total_price' | 'discount' | 'category'>
>

export function updateReceipt(id: number, changes: ReceiptChanges): Promise<Receipt> {
  return request(`/receipts/${id}`, jsonRequest('PATCH', changes))
}

export function updateReceiptItem(
  receiptId: number,
  itemId: number,
  changes: ReceiptItemChanges,
): Promise<ReceiptItem> {
  return request(`/receipts/${receiptId}/items/${itemId}`, jsonRequest('PATCH', changes))
}

export function deleteReceiptItem(receiptId: number, itemId: number): Promise<void> {
  return request(`/receipts/${receiptId}/items/${itemId}`, { method: 'DELETE' })
}
