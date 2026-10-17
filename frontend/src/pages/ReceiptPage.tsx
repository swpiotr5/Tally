import { useState } from 'react'
import { useLoaderData, useLocation, useRevalidator } from 'react-router'

import type { ReceiptItem } from '../api'
import { BackLink } from '../components/BackLink'
import { Banner } from '../components/Banner'
import { CategoryChip } from '../components/CategoryChip'
import { PencilIcon } from '../components/icons'
import { ItemEditor, ReceiptHeaderEditor } from '../components/ReceiptEditors'
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

type Editing = { kind: 'header' } | { kind: 'item'; item: ReceiptItem } | null

export function ReceiptPage() {
  const receipt = useLoaderData<typeof receiptLoader>()
  const { state } = useLocation()
  const revalidator = useRevalidator()
  const [editing, setEditing] = useState<Editing>(null)
  const [saved, setSaved] = useState(false)
  const justUploaded = (state as { justUploaded?: boolean } | null)?.justUploaded === true

  // Reload the receipt before closing the editor, so the old values never flash back.
  async function handleSaved() {
    await revalidator.revalidate()
    setEditing(null)
    setSaved(true)
  }

  function closeEditor() {
    setEditing(null)
  }

  return (
    <div className={styles.page}>
      <title>{`${receipt.store_name} · Tally`}</title>
      <BackLink to="/">Paragony</BackLink>
      {saved ? (
        <Banner tone="success">Zmiany zapisane.</Banner>
      ) : (
        justUploaded && (
          <Banner tone="success">Paragon zapisany. Sprawdź, czy wszystko się zgadza.</Banner>
        )
      )}
      {receipt.status === 'needs_review' && (
        <Banner tone="warning">Ten paragon wymaga sprawdzenia – coś się w nim nie zgadza.</Banner>
      )}
      <p className={styles.hint}>
        <PencilIcon />
        Stuknij pozycję lub ołówek, aby poprawić błąd.
      </p>

      <article className={styles.paper} aria-labelledby="receipt-store">
        <button
          type="button"
          className={styles.editHeader}
          aria-label="Popraw dane paragonu"
          aria-haspopup="dialog"
          onClick={() => setEditing({ kind: 'header' })}
        >
          <PencilIcon />
        </button>
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
              <li key={item.id}>
                <ItemRow item={item} onEdit={() => setEditing({ kind: 'item', item })} />
              </li>
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

      {editing?.kind === 'item' && (
        <ItemEditor
          receiptId={receipt.id}
          item={editing.item}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
      {editing?.kind === 'header' && (
        <ReceiptHeaderEditor receipt={receipt} onClose={closeEditor} onSaved={handleSaved} />
      )}
    </div>
  )
}

function ItemRow({ item, onEdit }: { item: ReceiptItem; onEdit: () => void }) {
  const hasDiscount = Number(item.discount) > 0

  return (
    <button type="button" className={styles.item} aria-haspopup="dialog" onClick={onEdit}>
      <span className={styles.itemMain}>
        <span className={styles.itemName}>{item.raw_name}</span>
        <span className={styles.itemPrice}>{formatMoney(item.total_price)}</span>
      </span>
      <span className={styles.itemDetails}>
        <CategoryChip category={item.category} />
        <span className={styles.itemQty}>
          {formatQuantity(item.quantity)} × {formatMoney(item.unit_price)}
        </span>
      </span>
      {hasDiscount && (
        <span className={styles.discount}>
          <span>Rabat</span>
          <span>−{formatMoney(item.discount)}</span>
        </span>
      )}
    </button>
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
