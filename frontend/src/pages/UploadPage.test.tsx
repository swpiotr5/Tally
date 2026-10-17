import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { photo, receipt } from '../test/fixtures'
import { jsonResponse, mockFetch, renderApp } from '../test/utils'

function pickPhoto(user: ReturnType<typeof renderApp>['user'], file = photo()) {
  return user.upload(screen.getByLabelText('Zdjęcie paragonu'), file)
}

describe('upload page', () => {
  it('shows a preview of the chosen photo', async () => {
    const { user } = renderApp('/upload')

    await pickPhoto(user)

    expect(screen.getByRole('img', { name: 'Podgląd zdjęcia paragonu' })).toHaveAttribute(
      'src',
      'blob:preview',
    )
    expect(screen.getByRole('button', { name: 'Odczytaj paragon' })).toBeEnabled()
  })

  it('uploads the photo and opens the saved receipt', async () => {
    const fetchMock = mockFetch((_url, init) =>
      init?.method === 'POST' ? jsonResponse(receipt, 201) : jsonResponse(receipt),
    )
    const image = photo()
    const { user, router } = renderApp('/upload')

    await pickPhoto(user, image)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('heading', { name: 'Biedronka' })).toBeInTheDocument()
    expect(screen.getByText(/Paragon zapisany/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/receipts/1')

    const [url, init] = fetchMock.mock.calls[0]
    const body = init?.body
    expect(url).toBe('/api/receipts')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(image)
  })

  it('locks the form while the receipt is being read', async () => {
    mockFetch(() => new Promise<Response>(() => {}))
    const { user } = renderApp('/upload')

    await pickPhoto(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(screen.getByRole('button', { name: /Odczytuję paragon/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zmień zdjęcie' })).toBeDisabled()
  })

  it('explains an unsupported file type and lets the user try again', async () => {
    mockFetch(() => jsonResponse({ detail: "Unsupported image type 'image/gif'." }, 415))
    const { user } = renderApp('/upload')

    await pickPhoto(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ten format pliku nie jest obsługiwany')
    expect(screen.getByRole('button', { name: 'Odczytaj paragon' })).toBeEnabled()
  })

  it('reports a lost connection', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const { user } = renderApp('/upload')

    await pickPhoto(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Brak połączenia z serwerem')
  })

  it('accepts a photo dropped onto the drop zone', () => {
    renderApp('/upload')

    fireEvent.drop(screen.getByRole('button', { name: /Zrób zdjęcie/ }), {
      dataTransfer: { files: [photo()] },
    })

    expect(screen.getByRole('img', { name: 'Podgląd zdjęcia paragonu' })).toBeInTheDocument()
  })

  it('rejects a dropped file that is not an image', () => {
    renderApp('/upload')

    fireEvent.drop(screen.getByRole('button', { name: /Zrób zdjęcie/ }), {
      dataTransfer: { files: [photo('notes.pdf', 'application/pdf')] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('To nie jest zdjęcie')
    expect(screen.queryByRole('img', { name: 'Podgląd zdjęcia paragonu' })).not.toBeInTheDocument()
  })
})
