import { Link } from 'react-router'

import { ScanIcon } from '../components/icons'
import { Notice } from '../components/Notice'

export function NotFoundPage() {
  return (
    <>
      <title>Nie znaleziono · Tally</title>
      <Notice
        icon={<ScanIcon />}
        title="Nie znaleziono"
        action={
          <Link to="/" className="button button-secondary">
            Wróć do paragonów
          </Link>
        }
      >
        Ta strona nie istnieje albo paragon został usunięty.
      </Notice>
    </>
  )
}
