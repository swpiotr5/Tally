import type { ReactNode } from 'react'

import styles from './Notice.module.css'

interface NoticeProps {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'danger'
}

/** Centered full-page message: empty list, error, not found. */
export function Notice({ icon, title, children, action, tone = 'neutral' }: NoticeProps) {
  return (
    <section className={styles.notice} data-tone={tone}>
      <div className={styles.icon}>{icon}</div>
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  )
}
