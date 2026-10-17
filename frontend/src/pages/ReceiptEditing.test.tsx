import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Receipt } from '../api'
import { receipt } from '../test/fixtures'
import { jsonResponse, mockFetch, renderApp } from '../test/utils'

/** A tiny in-memory API for one receipt that applies PATCH and DELETE like the backend. */
function mockReceiptApi(initial: Receipt = receipt) {
  let current = structuredClone(initial)
  const fetchMock = mockFetch((url, init) => {
    const method = init?.method ?? 'GET'
    const itemId = Number(url.match(/\/items\/(\d+)$/)?.[1])
    if (method === 'GET') {
      return jsonResponse(current)
    }
    if (method === 'PATCH' && itemId) {
      const changes = JSON.parse(String(init?.body))
      current = {
        ...current,
        items: current.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
      }
      return jsonResponse(current.items.find((item) => item.id === itemId))
    }
    if (method === 'DELETE' && itemId) {
      current = { ...current, items: current.items.filter((item) => item.id !== itemId) }
      return new Response(null, { status: 204 })
    }
    if (method === 'PATCH') {
      current = { ...current, ...JSON.parse(String(init?.body)) }
      return jsonResponse(current)
    }
    throw new Error(`Unexpected ${method} ${url}`)
  })

  const requests = (method: string) =>
    fetchMock.mock.calls
      .filter(([, init]) => (init?.method ?? 'GET') === method)
      .map(([url, init]) => ({ url, body: init?.body ? JSON.parse(String(init.body)) : null }))

  return { requests }
}

async function openMilk() {
  const view = renderApp('/receipts/1')
  await view.user.click(await screen.findByRole('button', { name: /MLEKO 2% 1L/ }))
  return { ...view, dialog: screen.getByRole('dialog', { name: 'Popraw pozycję' }) }
}

describe('editing a receipt item', () => {
  it('opens the editor with the current values', async () => {
    mockReceiptApi()

    const { dialog } = await openMilk()

    expect(within(dialog).getByLabelText('Nazwa z paragonu')).toHaveValue('MLEKO 2% 1L')
    expect(within(dialog).getByLabelText('Ilość')).toHaveValue('2')
    expect(within(dialog).getByLabelText('Cena jedn. (zł)')).toHaveValue('3,49')
    expect(within(dialog).getByRole('radio', { name: 'Nabiał' })).toBeChecked()
  })

  it('saves a new category and shows it on the receipt', async () => {
    const api = mockReceiptApi()
    const { user, dialog } = await openMilk()

    await user.click(within(dialog).getByRole('radio', { name: 'Napoje' }))
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }))

    expect(await screen.findByText('Zmiany zapisane.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.requests('PATCH')).toEqual([
      { url: '/api/receipts/1/items/1', body: { category: 'drinks' } },
    ])
    const milkRow = screen.getByRole('button', { name: /MLEKO 2% 1L/ })
    expect(within(milkRow).getByText('Napoje')).toBeInTheDocument()
  })

  it('accepts an amount typed with a comma', async () => {
    const api = mockReceiptApi()
    const { user, dialog } = await openMilk()

    const price = within(dialog).getByLabelText('Cena jedn. (zł)')
    await user.clear(price)
    await user.type(price, '3,79')
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }))

    await screen.findByText('Zmiany zapisane.')
    expect(api.requests('PATCH')[0].body).toEqual({ unit_price: '3.79' })
  })

  it('points out an invalid amount and does not save', async () => {
    const api = mockReceiptApi()
    const { user, dialog } = await openMilk()

    const price = within(dialog).getByLabelText('Cena jedn. (zł)')
    await user.clear(price)
    await user.type(price, 'abc')
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }))

    expect(within(dialog).getByText('Wpisz kwotę, np. 3,49')).toBeInTheDocument()
    expect(price).toHaveAttribute('aria-invalid', 'true')
    expect(api.requests('PATCH')).toEqual([])
  })

  it('closes without saving on cancel', async () => {
    const api = mockReceiptApi()
    const { user, dialog } = await openMilk()

    await user.click(within(dialog).getByRole('button', { name: 'Anuluj' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.requests('PATCH')).toEqual([])
  })

  it('deletes an item only after confirmation', async () => {
    const api = mockReceiptApi()
    const { user, dialog } = await openMilk()

    await user.click(within(dialog).getByRole('button', { name: 'Usuń pozycję' }))
    expect(api.requests('DELETE')).toEqual([])

    await user.click(within(dialog).getByRole('button', { name: 'Potwierdź usunięcie' }))

    expect(await screen.findByText('Zmiany zapisane.')).toBeInTheDocument()
    expect(api.requests('DELETE')).toEqual([{ url: '/api/receipts/1/items/1', body: null }])
    expect(screen.queryByText('MLEKO 2% 1L')).not.toBeInTheDocument()
    expect(screen.getByText('BANANY LUZ')).toBeInTheDocument()
  })
})

describe('editing the receipt header', () => {
  it('saves a corrected store name', async () => {
    const api = mockReceiptApi()
    const { user } = renderApp('/receipts/1')

    await user.click(await screen.findByRole('button', { name: 'Popraw dane paragonu' }))
    const dialog = screen.getByRole('dialog', { name: 'Popraw dane paragonu' })
    const store = within(dialog).getByLabelText('Sklep')
    await user.clear(store)
    await user.type(store, 'Lidl')
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }))

    expect(await screen.findByRole('heading', { name: 'Lidl' })).toBeInTheDocument()
    expect(api.requests('PATCH')).toEqual([{ url: '/api/receipts/1', body: { store_name: 'Lidl' } }])
  })
})
