import { validateAvailability, type AvailabilityRequest } from '../api/availabilityValidation'
import { routePaths } from './routePaths'
import { canonicalSearchQuery, parseSearchQuery } from '../components/accommodation/searchQuery'

export interface BookingContext {
  stay: AvailabilityRequest
  roomId?: number
  roomPage: number
  searchQuery?: string
}

const contextKeys = ['checkInDate', 'checkOutDate', 'guestCount', 'roomId', 'roomPage', 'search']

export function isExplorationQuery(search: string): boolean {
  const query = new URLSearchParams(search)
  return (
    [...query.keys()].every((key) => contextKeys.includes(key) && query.getAll(key).length === 1) &&
    (!query.has('search') || canonicalSearchQuery(query.get('search')!) !== null)
  )
}

export function searchReturnPath(search: string): string {
  const query = new URLSearchParams(search)
  const saved =
    isExplorationQuery(search) && query.has('search')
      ? canonicalSearchQuery(query.get('search')!)
      : null
  return routePaths.accommodations + (saved ? `?${saved}` : '')
}

export function explorationDetailPath(id: number, search: string): string {
  const saved = canonicalSearchQuery(search)
  if (saved === null) return `${routePaths.accommodations}/${id}`
  const parsed = parseSearchQuery(new URLSearchParams(saved))
  if (parsed.valid && parsed.query.checkInDate && parsed.query.checkOutDate) {
    return bookingContextPath(id, {
      stay: {
        checkInDate: parsed.query.checkInDate,
        checkOutDate: parsed.query.checkOutDate,
        guestCount: parsed.query.guestCount ?? 1,
      },
      roomPage: 0,
      searchQuery: saved,
    })
  }
  return `${routePaths.accommodations}/${id}?${new URLSearchParams({ search: saved })}`
}

// Only validated public search/stay/catalog hints travel in URLs; never guest data/tokens.
export function readBookingContext(search: string): BookingContext | null {
  const query = new URLSearchParams(search)
  if (!isExplorationQuery(search)) return null
  if (query.has('guestCount') && !/^\d+$/.test(query.get('guestCount')!)) return null
  const stay = {
    checkInDate: query.get('checkInDate') ?? '',
    checkOutDate: query.get('checkOutDate') ?? '',
    guestCount: Number(query.get('guestCount') ?? '1'),
  }
  if (validateAvailability(stay)) return null
  const roomId = Number(query.get('roomId'))
  const roomPage = Number(query.get('roomPage') ?? '0')
  return {
    stay,
    roomId: Number.isSafeInteger(roomId) && roomId > 0 ? roomId : undefined,
    roomPage:
      Number.isSafeInteger(roomPage) && roomPage >= 0 && roomPage <= 2147483647 ? roomPage : 0,
    ...(query.has('search') ? { searchQuery: canonicalSearchQuery(query.get('search')!)! } : {}),
  }
}

export function bookingContextPath(id: number, context: BookingContext): string {
  const query = new URLSearchParams({
    checkInDate: context.stay.checkInDate,
    checkOutDate: context.stay.checkOutDate,
    guestCount: String(context.stay.guestCount),
  })
  if (context.roomId) query.set('roomId', String(context.roomId))
  if (context.roomPage) query.set('roomPage', String(context.roomPage))
  if (context.searchQuery !== undefined) {
    const saved = canonicalSearchQuery(context.searchQuery)
    if (saved !== null) query.set('search', saved)
  }
  return `${routePaths.accommodations}/${id}?${query}`
}
