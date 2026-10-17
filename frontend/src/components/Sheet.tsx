import { useEffect, useId, useRef, type ReactNode } from 'react'

import styles from './Sheet.module.css'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A panel that slides up from the bottom of the screen (a centred dialog on wide screens).
 * The native <dialog> traps focus, closes on Escape and makes the page behind it inert.
 * Render it only while it should be open: it opens on mount and closes on unmount.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      // Focus the title, not the first input: on a phone that would pop up the keyboard
      // before the user has chosen what to change. Screen readers announce the title.
      titleRef.current?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={styles.content}>
        <div className={styles.handle} aria-hidden="true" />
        <h2 id={titleId} ref={titleRef} className={styles.title} tabIndex={-1}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}
