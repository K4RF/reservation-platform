import { describe, expect, it, vi } from 'vitest'
import { accessTokenWithExpiry } from './jwt'

describe('full JavaScript module reload', () => {
  it('does not restore tokens or role from browser storage after a reload', async () => {
    vi.resetModules()
    const before = await import('../state/accessToken')
    before.setTokenPair(
      accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60, 'ACCESS', 'ADMIN'),
      'refresh',
    )
    expect(before.getRoleHint()).toBe('ADMIN')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    vi.resetModules()
    const after = await import('../state/accessToken')
    expect(after.getAccessToken()).toBeNull()
    expect(after.getRefreshToken()).toBeNull()
    expect(after.getRoleHint()).toBeNull()
    expect(after.isLoginRequired()).toBe(false)
    expect(after.isAuthRefreshing()).toBe(false)
    before.clearAccessToken()
  })
})
