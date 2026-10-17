import type { ReactNode } from 'react'

import styles from './Banner.module.css'
import { AlertIcon, CheckIcon } from './icons'

interface BannerProps {
  tone: 'success' | 'warning' | 'danger'
  children: ReactNode
}

/** A short message above the content; errors are announced to screen readers immediately. */
export function Banner({ tone, children }: BannerProps) {
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {tone === 'success' ? <CheckIcon /> : <AlertIcon />}
      <span>{children}</span>
    </div>
  )
}
