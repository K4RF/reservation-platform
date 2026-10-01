import { afterEach, describe, expect, it } from 'vitest'
import { consumeGoogleReturn, safeLoginReturn, saveGoogleReturn } from './loginReturn'

afterEach(() => sessionStorage.clear())

describe('login return target', () => {
  it.each(['/reservations?status=CONFIRMED#result', '/admin', '/admin/rooms'])(
    'preserves %s',
    (path) => {
      expect(safeLoginReturn(path)).toBe(path)
    },
  )
  it.each([
    undefined,
    '//evil.test/admin',
    'https://evil.test/admin',
    '/\\evil.test/admin',
    '/login',
    '/oauth2/callback',
    '/admin/../login',
    '/administrator',
  ])('rejects unsafe or looping target %s', (path) => {
    expect(safeLoginReturn(path)).toBe('/')
  })
  it('stores only a return path for a full-page Google round trip and consumes it once', () => {
    saveGoogleReturn('/reservations?status=CONFIRMED#result')
    expect(consumeGoogleReturn()).toBe('/reservations?status=CONFIRMED#result')
    expect(consumeGoogleReturn()).toBe('/')
    expect(sessionStorage.length).toBe(0)
  })
})
