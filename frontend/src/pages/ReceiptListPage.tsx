import { Link, useLoaderData } from 'react-router'

import type { ReceiptSummary } from '../api'
import { CameraIcon } from '../components/icons'
import { Notice } from '../components/Notice'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatItemCount, formatMoney, formatReceiptCount } from '../format'
import type { receiptsLoader } from '../loaders'
import styles from './ReceiptListPage.module.css'

export function ReceiptListPage() {
  const receipts = useLoaderData<typeof receiptsLoader>()

  return (
    <>
      <title>Paragony · Tally</title>
      {receipts.length === 0 ? (
        <Notice
          icon={<img src="/favicon.svg" alt="" />}
          title="Nie masz jeszcze paragonów"
        >
          Zrób zdjęcie pierwszego paragonu, a Tally odczyta sklep, datę i wszystkie pozycje.
        </Notice>
      ) : (
        <>
          <div className={styles.heading}>
            <h1>Paragony</h1>
            <p className={styles.count}>{formatReceiptCount(receipts.length)}</p>
          </div>
          <ul className={styles.list}>
            {receipts.map((receipt) => (
              <li key={receipt.id}>
                <ReceiptCard receipt={receipt} />
              </li>
            ))}
          </ul>
        </>
      )}
      <AddReceiptBar />
    </>
  )
}

function ReceiptCard({ receipt }: { receipt: ReceiptSummary }) {
  return (
    <Link to={`/receipts/${receipt.id}`} className={styles.card}>
      <span className={styles.avatar} aria-hidden="true">
        {receipt.store_name.charAt(0).toUpperCase()}
      </span>
      <span className={styles.body}>
        <span className={styles.store}>{receipt.store_name}</span>
        <span className={styles.meta}>
          {formatDate(receipt.purchase_date)} · {formatItemCount(receipt.item_count)}
        </span>
        <StatusBadge status={receipt.status} />
      </span>
      <span className={styles.total}>{formatMoney(receipt.total)}</span>
    </Link>
  )
}

function AddReceiptBar() {
  return (
    <>
      <div className={styles.spacer} />
      <div className={styles.actionBar}>
        <Link to="/upload" className="button button-primary button-block">
          <CameraIcon />
          Dodaj paragon
        </Link>
      </div>
    </>
  )
}

export function ReceiptListSkeleton() {
  return (
    <div aria-busy="true">
      <span className="visually-hidden">Wczytywanie paragonów…</span>
      <div className={styles.heading}>
        <span className="skeleton" style={{ width: 150, height: 34 }} />
      </div>
      <ul className={styles.list} aria-hidden="true">
        {[0, 1, 2, 3].map((key) => (
          <li key={key} className={styles.card}>
            <span className={`skeleton ${styles.avatar}`} />
            <span className={styles.body}>
              <span className="skeleton" style={{ width: '60%', height: 18 }} />
              <span className="skeleton" style={{ width: '45%', height: 14 }} />
            </span>
            <span className="skeleton" style={{ width: 72, height: 20 }} />
          </li>
        ))}
      </ul>
    </div>
  )
}
