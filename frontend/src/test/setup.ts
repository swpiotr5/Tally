import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom has no object URLs; the upload preview only needs them to exist.
URL.createObjectURL = vi.fn(() => 'blob:preview')
URL.revokeObjectURL = vi.fn()

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
