import type { ReceiptStatus } from '../api'
import styles from './StatusBadge.module.css'

/** Shown only when a receipt needs attention; "ok" receipts stay uncluttered. */
export function StatusBadge({ status }: { status: ReceiptStatus }) {
  if (status !== 'needs_review') {
    return null
  }
  return <span className={styles.badge}>Do sprawdzenia</span>
}
