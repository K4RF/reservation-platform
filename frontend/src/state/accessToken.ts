import type { UserRole } from './authTypes'
import { readAccessTokenHints, readAccessTokenExpiry } from './tokenHints'
export { readAccessTokenExpiry } from './tokenHints'

// Both token types live only in this JavaScript module. A full page reload starts anonymous.
let currentToken: string | null = null
let expiresAt: number | null = null
let currentRefreshToken: string | null = null
let loginRequired = false
let sessionVersion = 0
let refreshing = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

// Unverified client hint only. The backend verifies signatures and permissions.
export function getRoleHint(): UserRole | null {
  return currentToken === null ? null : (readAccessTokenHints(currentToken)?.role ?? null)
}

export function isAuthRefreshing(): boolean {
  return refreshing
}

export function setAuthRefreshing(value: boolean, version: number) {
  if (sessionVersion !== version || refreshing === value) return
  refreshing = value
  notify()
}

export function setAccessToken(token: string): number {
  const expiration = readAccessTokenExpiry(token)
  if (expiration === null) throw new Error('Invalid or expired access token')
  currentToken = token
  expiresAt = expiration
  loginRequired = false
  notify()
  return expiration
}

export function setTokenPair(accessToken: string, refreshToken: string): number {
  const expiration = readAccessTokenExpiry(accessToken)
  if (expiration === null || !refreshToken || refreshToken.length > 4096) {
    throw new Error('Invalid login token response')
  }
  currentToken = accessToken
  expiresAt = expiration
  currentRefreshToken = refreshToken
  refreshing = false
  loginRequired = false
  sessionVersion += 1
  notify()
  return expiration
}

export function getAccessToken(): string | null {
  if (currentToken !== null && expiresAt !== null && expiresAt <= Date.now()) {
    if (currentRefreshToken === null) clearAccessToken()
    return null
  }
  return currentToken
}

export function getStoredAccessToken(): string | null {
  return currentToken
}

export function getRefreshToken(): string | null {
  return currentRefreshToken
}

export function isLoginRequired(): boolean {
  return loginRequired
}

export function getSessionVersion(): number {
  return sessionVersion
}

export function getAccessTokenExpiry(): number | null {
  getAccessToken()
  return expiresAt
}

export function clearAccessToken() {
  if (currentToken === null && currentRefreshToken === null && !loginRequired) return
  currentToken = null
  expiresAt = null
  currentRefreshToken = null
  refreshing = false
  loginRequired = false
  sessionVersion += 1
  notify()
}

export function requireLogin() {
  currentToken = null
  expiresAt = null
  currentRefreshToken = null
  refreshing = false
  loginRequired = true
  sessionVersion += 1
  notify()
}

export function requireLoginIfCurrent(token: string, version: number) {
  if (currentToken === token && sessionVersion === version) requireLogin()
}

export function clearAccessTokenIfCurrent(token: string) {
  if (currentToken === token) clearAccessToken()
}

export function subscribeAccessToken(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
