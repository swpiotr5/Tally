import { useId, type CSSProperties } from 'react'

import type { Category } from '../api'
import { CATEGORIES } from '../categories'
import styles from './CategoryPicker.module.css'
import formStyles from './Form.module.css'
import { CheckMarkIcon } from './icons'

const CATEGORY_ORDER = Object.keys(CATEGORIES) as Category[]

/** All categories as tappable chips; a radio group underneath for keyboards and screen readers. */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: Category
  onChange: (category: Category) => void
}) {
  const name = useId()

  return (
    <fieldset className={styles.picker}>
      <legend className={formStyles.label}>Kategoria</legend>
      <div className={styles.options}>
        {CATEGORY_ORDER.map((category) => {
          const { label, color } = CATEGORIES[category]
          const checked = category === value
          return (
            <label
              key={category}
              className={styles.option}
              style={{ '--chip-color': color } as CSSProperties}
            >
              <input
                type="radio"
                name={name}
                value={category}
                checked={checked}
                onChange={() => onChange(category)}
                className="visually-hidden"
              />
              {checked ? (
                <CheckMarkIcon className={styles.check} />
              ) : (
                <span className={styles.dot} aria-hidden="true" />
              )}
              {label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
