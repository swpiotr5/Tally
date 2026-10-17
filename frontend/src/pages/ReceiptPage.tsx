import { useLoaderData, useLocation } from 'react-router'

import type { ReceiptItem } from '../api'
import { BackLink } from '../components/BackLink'
import { Banner } from '../components/Banner'
import { CategoryChip } from '../components/CategoryChip'
import {
  formatDate,
  formatDateTime,
  formatItemCount,
  formatMoney,
  formatNip,
  formatQuantity,
} from '../format'
import type { receiptLoader } from '../loaders'
import styles from './ReceiptPage.module.css'

export function ReceiptPage() {
  const receipt = useLoaderData<typeof receiptLoader>()
  const { state } = useLocation()
  const justUploaded = (state as { justUploaded?: boolean } | null)?.justUploaded === true

  return (
    <div className={styles.page}>
      <title>{`${receipt.store_name} · Tally`}</title>
      <BackLink to="/">Paragony</BackLink>
      {justUploaded && (
        <Banner tone="success">Paragon zapisany. Sprawdź, czy wszystko się zgadza.</Banner>
      )}
      {receipt.status === 'needs_review' && (
        <Banner tone="warning">Ten paragon wymaga sprawdzenia – coś się w nim nie zgadza.</Banner>
      )}

      <article className={styles.paper} aria-labelledby="receipt-store">
        <header className={styles.header}>
          <h1 id="receipt-store" className={styles.store}>
            {receipt.store_name}
          </h1>
          {receipt.store_nip && <p className={styles.nip}>NIP {formatNip(receipt.store_nip)}</p>}
          <p className={styles.date}>
            <time dateTime={receipt.purchase_date}>{formatDate(receipt.purchase_date, 'long')}</time>
          </p>
        </header>

        {receipt.items.length > 0 ? (
          <ul className={styles.items} aria-label="Pozycje">
            {receipt.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className={styles.noItems}>Brak odczytanych pozycji.</p>
        )}

        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Suma</span>
          <span className={styles.total}>{formatMoney(receipt.total)}</span>
        </div>
      </article>

      <p className={styles.meta}>
        Dodano {formatDateTime(receipt.created_at)} · {formatItemCount(receipt.items.length)}
      </p>
    </div>
  )
}

function ItemRow({ item }: { item: ReceiptItem }) {
  const hasDiscount = Number(item.discount) > 0

  return (
    <li className={styles.item}>
      <div className={styles.itemMain}>
        <span className={styles.itemName}>{item.raw_name}</span>
        <span className={styles.itemPrice}>{formatMoney(item.total_price)}</span>
      </div>
      <div className={styles.itemDetails}>
        <CategoryChip category={item.category} />
        <span className={styles.itemQty}>
          {formatQuantity(item.quantity)} × {formatMoney(item.unit_price)}
        </span>
      </div>
      {hasDiscount && (
        <div className={styles.discount}>
          <span>Rabat</span>
          <span>−{formatMoney(item.discount)}</span>
        </div>
      )}
    </li>
  )
}

export function ReceiptSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <span className="visually-hidden">Wczytywanie paragonu…</span>
      <span className="skeleton" style={{ width: 110, height: 22, margin: '11px 0' }} />
      <div className={styles.paper} aria-hidden="true">
        <div className={styles.header}>
          <span className="skeleton" style={{ width: '55%', height: 30 }} />
          <span className="skeleton" style={{ width: '38%', height: 16 }} />
        </div>
        {[0, 1, 2].map((key) => (
          <div key={key} className={styles.item}>
            <div className={styles.itemMain}>
              <span className="skeleton" style={{ width: '58%', height: 18 }} />
              <span className="skeleton" style={{ width: 64, height: 18 }} />
            </div>
            <span className="skeleton" style={{ width: '40%', height: 22, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
