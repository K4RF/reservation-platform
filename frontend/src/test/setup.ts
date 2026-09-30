import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { clearAccessToken } from '../state/accessToken'

afterEach(() => {
  cleanup()
  clearAccessToken()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
