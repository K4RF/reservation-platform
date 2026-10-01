const STATE_KEY = 'reservation:google-oauth2-state'

export function createGoogleLoginStartUrl(
  backendBaseUrl: string,
  storage: Storage = sessionStorage,
  random: Uint8Array = crypto.getRandomValues(new Uint8Array(24)),
): string {
  const base = new URL(backendBaseUrl)
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash ||
    random.length !== 24
  ) {
    throw new Error('Google login configuration is invalid')
  }
  const state = btoa(String.fromCharCode(...random))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  storage.setItem(STATE_KEY, state)
  return new URL(`/api/v1/auth/oauth2/google/start?state=${state}`, base).toString()
}

export type GoogleCallbackResult =
  { type: 'code'; code: string } | { type: 'cancelled' | 'failed' | 'invalid' }

export function consumeGoogleCallback(
  hash: string,
  storage: Storage = sessionStorage,
): GoogleCallbackResult {
  const expected = storage.getItem(STATE_KEY)
  storage.removeItem(STATE_KEY)
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!expected || params.get('state') !== expected) return { type: 'invalid' }
  if (params.get('error') === 'cancelled') return { type: 'cancelled' }
  if (params.has('error')) return { type: 'failed' }
  const code = params.get('code')
  if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) return { type: 'invalid' }
  return { type: 'code', code }
}

export const googleOAuth2BackendUrl =
  import.meta.env.VITE_OAUTH2_BACKEND_URL || 'http://localhost:8080'
