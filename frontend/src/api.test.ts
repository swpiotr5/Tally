import { describe, expect, it } from 'vitest'

import {
  ApiError,
  deleteReceiptItem,
  getReceipt,
  getReceipts,
  updateReceipt,
  updateReceiptItem,
  uploadReceipt,
} from './api'
import { photo, receipt, summary } from './test/fixtures'
import { jsonResponse, mockFetch } from './test/utils'

describe('api', () => {
  it('fetches the receipt list through the /api prefix', async () => {
    const fetchMock = mockFetch(() => jsonResponse([summary]))

    await expect(getReceipts()).resolves.toEqual([summary])
    expect(fetchMock).toHaveBeenCalledWith('/api/receipts', expect.anything())
  })

  it('fetches a single receipt by id', async () => {
    const fetchMock = mockFetch(() => jsonResponse(receipt))

    await expect(getReceipt(1)).resolves.toEqual(receipt)
    expect(fetchMock).toHaveBeenCalledWith('/api/receipts/1', expect.anything())
  })

  it('throws ApiError with the status and the detail from the response', async () => {
    mockFetch(() => jsonResponse({ detail: 'Receipt not found.' }, 404))

    const error = await getReceipt(7).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'Receipt not found.' })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))

    await expect(getReceipts()).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('uploads the image as multipart form data', async () => {
    const fetchMock = mockFetch(() => jsonResponse(receipt, 201))
    const image = photo()

    await expect(uploadReceipt(image)).resolves.toEqual(receipt)

    const [url, init] = fetchMock.mock.calls[0]
    const body = init?.body
    expect(url).toBe('/api/receipts')
    expect(init?.method).toBe('POST')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(image)
  })

  it('sends item changes as a JSON PATCH', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ ...receipt.items[0], category: 'drinks' }))

    await updateReceiptItem(1, 2, { category: 'drinks', unit_price: '3.79' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/receipts/1/items/2')
    expect(init?.method).toBe('PATCH')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ category: 'drinks', unit_price: '3.79' })
  })

  it('sends header changes as a JSON PATCH', async () => {
    const fetchMock = mockFetch(() => jsonResponse(receipt))

    await updateReceipt(1, { store_nip: null })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/receipts/1')
    expect(JSON.parse(String(init?.body))).toEqual({ store_nip: null })
  })

  it('deletes an item and accepts the empty 204 response', async () => {
    const fetchMock = mockFetch(() => new Response(null, { status: 204 }))

    await expect(deleteReceiptItem(1, 2)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/receipts/1/items/2', { method: 'DELETE' })
  })
})
