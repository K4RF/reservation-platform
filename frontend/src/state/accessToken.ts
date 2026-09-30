// Both token types live only in this JavaScript module. A full page reload starts anonymous.
let currentToken: string | null = null
let expiresAt: number | null = null
let currentRefreshToken: string | null = null
let loginRequired = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function readAccessTokenExpiry(token: string, now = Date.now()): number | null {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) return null

  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims: unknown = JSON.parse(atob(encoded))
    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null
    const payload = claims as Record<string, unknown>
    if (
      payload.token_type !== 'ACCESS' ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      !Number.isSafeInteger(payload.exp * 1000) ||
      payload.exp * 1000 <= now
    ) {
      return null
    }
    return payload.exp * 1000
  } catch {
    return null
  }
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
  loginRequired = false
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

export function getAccessTokenExpiry(): number | null {
  getAccessToken()
  return expiresAt
}

export function clearAccessToken() {
  if (currentToken === null && currentRefreshToken === null && !loginRequired) return
  currentToken = null
  expiresAt = null
  currentRefreshToken = null
  loginRequired = false
  notify()
}

export function requireLogin() {
  currentToken = null
  expiresAt = null
  currentRefreshToken = null
  loginRequired = true
  notify()
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
