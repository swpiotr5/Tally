import { Link, Outlet, useNavigation } from 'react-router'

import styles from './AppLayout.module.css'

export function AppLayout() {
  const navigation = useNavigation()
  const busy = navigation.state !== 'idle'

  return (
    <div className={styles.shell}>
      <div className={styles.progress} data-active={busy} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <img src="/favicon.svg" alt="" width={34} height={34} />
            <span className={styles.wordmark}>Tally</span>
          </Link>
        </div>
      </header>
      <main className={styles.main} aria-busy={busy}>
        <Outlet />
      </main>
    </div>
  )
}
