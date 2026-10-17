import { describe, expect, it } from 'vitest'

import { ApiError, getReceipt, getReceipts, uploadReceipt } from './api'
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
})
