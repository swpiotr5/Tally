import type { ReactNode } from 'react'
import { Link } from 'react-router'

import styles from './BackLink.module.css'
import { ChevronLeftIcon } from './icons'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.back}>
      <ChevronLeftIcon />
      {children}
    </Link>
  )
}
