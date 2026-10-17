import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// RouterProvider comes from 'react-router', not 'react-router/dom' as in main.tsx: under Vitest
// the two entry points load different builds (ESM vs CommonJS) with separate router contexts.
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'

import { routes } from '../routes'

/** Render the whole app (real routes and loaders) at the given path. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  render(<RouterProvider router={router} />)
  return { router, user }
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>

/** Replace the global fetch; the returned mock records every request. */
export function mockFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Turn every kind of space (Intl uses non-breaking ones) into a plain space. */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replace(/\s/g, ' ')
}
