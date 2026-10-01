import type { UserRole } from './authTypes'

// Decoding does NOT verify the signature. These fields are UI hints, never authorization.
export function readAccessTokenHints(
  token: string,
  now = Date.now(),
): { expiresAt: number; role: UserRole | null } | null {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) return null
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null
    const payload = claims as Record<string, unknown>
    if (
      payload.token_type !== 'ACCESS' ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      !Number.isSafeInteger(payload.exp * 1000) ||
      payload.exp * 1000 <= now
    )
      return null
    return {
      expiresAt: payload.exp * 1000,
      role: payload.role === 'USER' || payload.role === 'ADMIN' ? payload.role : null,
    }
  } catch {
    return null
  }
}

export function readAccessTokenExpiry(token: string, now = Date.now()): number | null {
  return readAccessTokenHints(token, now)?.expiresAt ?? null
}
