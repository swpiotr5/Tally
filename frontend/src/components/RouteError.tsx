import { isRouteErrorResponse, useRevalidator, useRouteError } from 'react-router'

import { ApiError } from '../api'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AlertIcon, RefreshIcon } from './icons'
import { Notice } from './Notice'

/** Rendered instead of a page whose loader failed. */
export function RouteError() {
  const error = useRouteError()
  const revalidator = useRevalidator()

  if ((isRouteErrorResponse(error) || error instanceof ApiError) && error.status === 404) {
    return <NotFoundPage />
  }

  // fetch rejects with a TypeError when the server cannot be reached at all.
  const offline = error instanceof TypeError

  return (
    <Notice
      tone="danger"
      icon={<AlertIcon />}
      title={offline ? 'Brak połączenia z serwerem' : 'Coś poszło nie tak'}
      action={
        <button
          type="button"
          className="button button-secondary"
          disabled={revalidator.state === 'loading'}
          onClick={() => revalidator.revalidate()}
        >
          <RefreshIcon />
          Spróbuj ponownie
        </button>
      }
    >
      {offline
        ? 'Sprawdź, czy serwer działa i czy telefon jest w tej samej sieci.'
        : 'Nie udało się wczytać danych. Spróbuj ponownie za chwilę.'}
    </Notice>
  )
}
