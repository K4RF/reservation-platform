import { afterEach, describe, expect, it, vi } from 'vitest'
import { accessTokenWithExpiry } from '../test/jwt'
import {
  clearAccessToken,
  clearAccessTokenIfCurrent,
  getAccessToken,
  getAccessTokenExpiry,
  getRefreshToken,
  isLoginRequired,
  readAccessTokenExpiry,
  requireLogin,
  setAccessToken,
  setTokenPair,
} from './accessToken'

afterEach(() => clearAccessToken())

describe('memory-only access token', () => {
  it('accepts an unexpired access token and never writes it to browser storage', () => {
    const expiry = Math.floor(Date.now() / 1000) + 60
    const token = accessTokenWithExpiry(expiry)

    expect(setAccessToken(token)).toBe(expiry * 1000)
    expect(getAccessToken()).toBe(token)
    expect(getAccessTokenExpiry()).toBe(expiry * 1000)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('rejects malformed, refresh, and expired tokens', () => {
    const expired = accessTokenWithExpiry(Math.floor(Date.now() / 1000) - 1)
    const refresh = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60, 'REFRESH')

    expect(readAccessTokenExpiry('not-a-jwt')).toBeNull()
    expect(readAccessTokenExpiry(expired)).toBeNull()
    expect(readAccessTokenExpiry(refresh)).toBeNull()
    expect(() => setAccessToken(expired)).toThrow('Invalid or expired access token')
  })

  it('clears the token on expiry or explicit reset, but not for an older request', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    const oldToken = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 10)
    const currentToken = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setAccessToken(oldToken)
    setAccessToken(currentToken)
    clearAccessTokenIfCurrent(oldToken)
    expect(getAccessToken()).toBe(currentToken)

    vi.advanceTimersByTime(61_000)
    expect(getAccessToken()).toBeNull()
    expect(getAccessTokenExpiry()).toBeNull()

    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('keeps the refresh token in memory while the access token expires or is replaced', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    const first = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 10)
    const next = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)

    setTokenPair(first, 'refresh-token')
    vi.advanceTimersByTime(11_000)
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBe('refresh-token')
    setAccessToken(next)
    expect(getAccessToken()).toBe(next)
    expect(getRefreshToken()).toBe('refresh-token')
    expect(sessionStorage.length).toBe(0)

    requireLogin()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(isLoginRequired()).toBe(true)
    clearAccessToken()
    expect(isLoginRequired()).toBe(false)
  })
})
