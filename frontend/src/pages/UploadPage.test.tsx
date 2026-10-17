import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { photo, receipt } from '../test/fixtures'
import { jsonResponse, mockFetch, renderApp } from '../test/utils'

type User = ReturnType<typeof renderApp>['user']

function pickPhotos(user: User, ...files: File[]) {
  return user.upload(screen.getByLabelText('Zdjęcia paragonu'), files.length ? files : [photo()])
}

function sentPhotos(fetchMock: ReturnType<typeof mockFetch>): FormDataEntryValue[] {
  const body = fetchMock.mock.calls[0][1]?.body
  expect(body).toBeInstanceOf(FormData)
  return (body as FormData).getAll('files')
}

describe('upload page', () => {
  it('shows a preview of the chosen photo', async () => {
    const { user } = renderApp('/upload')

    await pickPhotos(user)

    expect(screen.getByRole('img', { name: 'Zdjęcie 1 paragonu' })).toHaveAttribute(
      'src',
      'blob:preview',
    )
    expect(screen.getByText(/Długi paragon\?/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odczytaj paragon' })).toBeEnabled()
  })

  it('uploads the photo and opens the saved receipt', async () => {
    const fetchMock = mockFetch((_url, init) =>
      init?.method === 'POST' ? jsonResponse(receipt, 201) : jsonResponse(receipt),
    )
    const image = photo()
    const { user, router } = renderApp('/upload')

    await pickPhotos(user, image)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('heading', { name: 'Biedronka' })).toBeInTheDocument()
    expect(screen.getByText(/Paragon zapisany/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/receipts/1')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/receipts')
    expect(sentPhotos(fetchMock)).toEqual([image])
  })

  it('sends several photos of a long receipt in order', async () => {
    const fetchMock = mockFetch((_url, init) =>
      init?.method === 'POST' ? jsonResponse(receipt, 201) : jsonResponse(receipt),
    )
    const top = photo('top.jpg')
    const bottom = photo('bottom.jpg')
    const { user } = renderApp('/upload')

    await pickPhotos(user, top)
    await user.click(screen.getByRole('button', { name: 'Dodaj dalszą część paragonu' }))
    await pickPhotos(user, bottom)

    expect(screen.getByRole('img', { name: 'Zdjęcie 2 paragonu' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    await screen.findByRole('heading', { name: 'Biedronka' })
    expect(sentPhotos(fetchMock)).toEqual([top, bottom])
  })

  it('removes a photo and renumbers the rest', async () => {
    const { user } = renderApp('/upload')

    await pickPhotos(user, photo('top.jpg'), photo('bottom.jpg'))
    await user.click(screen.getByRole('button', { name: 'Usuń zdjęcie 1' }))

    expect(screen.getByRole('img', { name: 'Zdjęcie 1 paragonu' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Zdjęcie 2 paragonu' })).not.toBeInTheDocument()
  })

  it('takes at most five photos of one receipt', async () => {
    const { user } = renderApp('/upload')

    await pickPhotos(user, ...Array.from({ length: 6 }, (_, index) => photo(`part-${index}.jpg`)))

    expect(screen.getAllByRole('img', { name: /Zdjęcie \d paragonu/ })).toHaveLength(5)
    expect(screen.getByRole('alert')).toHaveTextContent('najwyżej 5 zdjęć')
    expect(
      screen.queryByRole('button', { name: 'Dodaj dalszą część paragonu' }),
    ).not.toBeInTheDocument()
  })

  it('asks for the bottom of the receipt when the total is not visible', async () => {
    mockFetch(() =>
      jsonResponse(
        { detail: { code: 'incomplete_receipt', missing: ['total'], message: 'Not visible.' } },
        422,
      ),
    )
    const { user } = renderApp('/upload')

    await pickPhotos(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Na zdjęciach nie widać sumy paragonu. Dodaj zdjęcie dołu paragonu',
    )
    // The chosen photos stay, so adding the missing part is one more tap.
    expect(screen.getByRole('img', { name: 'Zdjęcie 1 paragonu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dodaj dalszą część paragonu' })).toBeEnabled()
  })

  it('locks the form while the receipt is being read', async () => {
    mockFetch(() => new Promise<Response>(() => {}))
    const { user } = renderApp('/upload')

    await pickPhotos(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(screen.getByRole('button', { name: /Odczytuję paragon/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dodaj dalszą część paragonu' })).toBeDisabled()
  })

  it('explains an unsupported file type and lets the user try again', async () => {
    mockFetch(() => jsonResponse({ detail: "Unsupported image type 'image/gif'." }, 415))
    const { user } = renderApp('/upload')

    await pickPhotos(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ten format pliku nie jest obsługiwany')
    expect(screen.getByRole('button', { name: 'Odczytaj paragon' })).toBeEnabled()
  })

  it('reports a lost connection', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const { user } = renderApp('/upload')

    await pickPhotos(user)
    await user.click(screen.getByRole('button', { name: 'Odczytaj paragon' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Brak połączenia z serwerem')
  })

  it('accepts photos dropped onto the drop zone', () => {
    renderApp('/upload')

    fireEvent.drop(screen.getByRole('button', { name: /Zrób zdjęcie/ }), {
      dataTransfer: { files: [photo('top.jpg'), photo('bottom.jpg')] },
    })

    expect(screen.getAllByRole('img', { name: /Zdjęcie \d paragonu/ })).toHaveLength(2)
  })

  it('rejects a dropped file that is not an image', () => {
    renderApp('/upload')

    fireEvent.drop(screen.getByRole('button', { name: /Zrób zdjęcie/ }), {
      dataTransfer: { files: [photo('notes.pdf', 'application/pdf')] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('To nie jest zdjęcie')
    expect(screen.queryByRole('img', { name: /Zdjęcie \d paragonu/ })).not.toBeInTheDocument()
  })
})
