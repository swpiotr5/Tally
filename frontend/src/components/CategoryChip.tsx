import type { CSSProperties } from 'react'

import type { Category } from '../api'
import { CATEGORIES } from '../categories'
import styles from './CategoryChip.module.css'

export function CategoryChip({ category }: { category: Category }) {
  const { label, color } = CATEGORIES[category]
  return (
    <span className={styles.chip} style={{ '--chip-color': color } as CSSProperties}>
      {label}
    </span>
  )
}
