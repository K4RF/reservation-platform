import { routePaths } from './routePaths'
import { canonicalSearchQuery } from '../components/accommodation/searchQuery'
import { bookingContextPath, isExplorationQuery, readBookingContext } from './bookingContext'

const GOOGLE_RETURN_KEY = 'reservation:google-return-path'

// Only known catalog/member/admin areas are return targets; never external/auth URLs.
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
    if (url.pathname === routePaths.accommodations) {
      const query = canonicalSearchQuery(url.search)
      return query === null ? routePaths.home : `${url.pathname}?${query}`
    }
    if (url.pathname.startsWith(routePaths.accommodations + '/')) {
      const id = url.pathname.slice(routePaths.accommodations.length + 1)
      if (
        !/^\d+$/.test(id) ||
        !Number.isSafeInteger(Number(id)) ||
        Number(id) < 1 ||
        !isExplorationQuery(url.search)
      )
        return routePaths.home
      const context = readBookingContext(url.search)
      if (context) return bookingContextPath(Number(id), context)
      const query = new URLSearchParams(url.search)
      if ([...query.keys()].some((key) => key !== 'search')) return routePaths.home
      const saved = query.get('search')
      return (
        url.pathname +
        (saved === null ? '' : `?${new URLSearchParams({ search: canonicalSearchQuery(saved)! })}`)
      )
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
