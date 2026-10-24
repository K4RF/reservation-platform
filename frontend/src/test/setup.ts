import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { clearAccessToken } from '../state/accessToken'

// jsdom has no layout/scroll implementation. Calls are asserted separately from Browser evidence.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo')
    .mockClear()
    .mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  clearAccessToken()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
