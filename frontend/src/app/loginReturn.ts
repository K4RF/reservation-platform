import { routePaths } from './routePaths'

const GOOGLE_RETURN_KEY = 'reservation:google-return-path'

// Only known protected areas are return targets; never redirect to external/auth URLs.
export function safeLoginReturn(value: unknown): string {
  if (typeof value !== 'string' || /[\\\s]/.test(value)) return routePaths.home
  try {
    const url = new URL(value, 'https://reservation.invalid')
    if (url.origin !== 'https://reservation.invalid' || !value.startsWith('/'))
      return routePaths.home
    if (
      ![routePaths.accommodations, routePaths.reservations, routePaths.admin].some(
        (path) => url.pathname === path || url.pathname.startsWith(path + '/'),
      )
    ) {
      return routePaths.home
    }
    return url.pathname + url.search + url.hash
  } catch {
    return routePaths.home
  }
}

export function saveGoogleReturn(path: string) {
  sessionStorage.setItem(GOOGLE_RETURN_KEY, safeLoginReturn(path))
}

export function consumeGoogleReturn(): string {
  const path = safeLoginReturn(sessionStorage.getItem(GOOGLE_RETURN_KEY))
  sessionStorage.removeItem(GOOGLE_RETURN_KEY)
  return path
}
