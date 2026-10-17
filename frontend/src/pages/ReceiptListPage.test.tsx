import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { receipt, summary } from '../test/fixtures'
import { jsonResponse, mockFetch, plain, renderApp } from '../test/utils'

describe('receipt list', () => {
  it('shows each receipt with store, date, item count and total', async () => {
    mockFetch(() =>
      jsonResponse([
        summary,
        { ...summary, id: 2, store_name: 'Lidl', total: '123.40', item_count: 5 },
      ]),
    )

    renderApp('/')

    const biedronka = await screen.findByRole('link', { name: /Biedronka/ })
    expect(plain(biedronka.textContent)).toContain('17 paź 2026 · 2 pozycje')
    expect(plain(biedronka.textContent)).toContain('9,68 zł')
    expect(biedronka).toHaveAttribute('href', '/receipts/1')

    const lidl = screen.getByRole('link', { name: /Lidl/ })
    expect(plain(lidl.textContent)).toContain('5 pozycji')
    expect(plain(lidl.textContent)).toContain('123,40 zł')

    expect(screen.getByText('2 paragony')).toBeInTheDocument()
  })

  it('marks receipts that need review', async () => {
    mockFetch(() => jsonResponse([{ ...summary, status: 'needs_review' }]))

    renderApp('/')

    const card = await screen.findByRole('link', { name: /Biedronka/ })
    expect(within(card).getByText('Do sprawdzenia')).toBeInTheDocument()
  })

  it('shows an empty state before the first receipt', async () => {
    mockFetch(() => jsonResponse([]))

    renderApp('/')

    expect(await screen.findByText('Nie masz jeszcze paragonów')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dodaj paragon' })).toHaveAttribute('href', '/upload')
  })

  it('opens a receipt from the list', async () => {
    mockFetch((url) => jsonResponse(url === '/api/receipts' ? [summary] : receipt))
    const { user } = renderApp('/')

    await user.click(await screen.findByRole('link', { name: /Biedronka/ }))

    expect(await screen.findByRole('heading', { name: 'Biedronka' })).toBeInTheDocument()
    expect(screen.getByText('MLEKO 2% 1L')).toBeInTheDocument()
  })

  it('shows an error with a retry when loading fails', async () => {
    let failing = true
    mockFetch(() => (failing ? jsonResponse({ detail: 'boom' }, 500) : jsonResponse([summary])))
    const { user } = renderApp('/')

    expect(await screen.findByText('Coś poszło nie tak')).toBeInTheDocument()

    failing = false
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))

    expect(await screen.findByRole('link', { name: /Biedronka/ })).toBeInTheDocument()
  })

  it('tells the user when the server cannot be reached', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    renderApp('/')

    expect(await screen.findByText('Brak połączenia z serwerem')).toBeInTheDocument()
  })
})
