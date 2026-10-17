import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { receipt } from '../test/fixtures'
import { jsonResponse, mockFetch, plain, renderApp } from '../test/utils'

describe('receipt page', () => {
  it('shows the receipt header and total', async () => {
    mockFetch(() => jsonResponse(receipt))

    renderApp('/receipts/1')

    expect(await screen.findByRole('heading', { name: 'Biedronka' })).toBeInTheDocument()
    expect(screen.getByText('NIP 779-101-13-27')).toBeInTheDocument()
    expect(screen.getByText('17 października 2026')).toBeInTheDocument()
    expect(plain(screen.getByText('Suma').parentElement?.textContent)).toBe('Suma9,68 zł')
  })

  it('lists items with category, quantity, price and discount', async () => {
    mockFetch(() => jsonResponse(receipt))

    renderApp('/receipts/1')

    const items = within(await screen.findByRole('list', { name: 'Pozycje' })).getAllByRole(
      'listitem',
    )
    expect(items).toHaveLength(2)

    const [milk, bananas] = items.map((item) => plain(item.textContent))
    expect(milk).toContain('MLEKO 2% 1L')
    expect(milk).toContain('Nabiał')
    expect(milk).toContain('2 szt. × 3,49 zł')
    expect(milk).toContain('Rabat−0,50 zł')
    expect(bananas).toContain('Owoce i warzywa')
    expect(bananas).toContain('0,535 kg × 5,99 zł')
    expect(bananas).not.toContain('Rabat')
  })

  it('warns when the receipt needs review', async () => {
    mockFetch(() => jsonResponse({ ...receipt, status: 'needs_review' }))

    renderApp('/receipts/1')

    expect(await screen.findByText(/wymaga sprawdzenia/)).toBeInTheDocument()
  })

  it('shows not found for an unknown receipt', async () => {
    mockFetch(() => jsonResponse({ detail: 'Receipt not found.' }, 404))

    renderApp('/receipts/999')

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono' })).toBeInTheDocument()
  })

  it('shows not found for a malformed id without calling the API', async () => {
    const fetchMock = mockFetch(() => jsonResponse(receipt))

    renderApp('/receipts/abc')

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('unknown pages', () => {
  it('shows not found with a way back', async () => {
    renderApp('/does-not-exist')

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Wróć do paragonów' })).toHaveAttribute('href', '/')
  })
})
