import { validateAvailability, type AvailabilityRequest } from '../api/availabilityValidation'
import { routePaths } from './routePaths'

export interface BookingContext {
  stay: AvailabilityRequest
  roomId?: number
  roomPage: number
}

// Only public catalog identifiers and stay conditions travel in URLs; never guest data/tokens.
export function readBookingContext(search: string): BookingContext | null {
  const query = new URLSearchParams(search)
  if (
    ['checkInDate', 'checkOutDate', 'guestCount', 'roomId', 'roomPage'].some(
      (key) => query.getAll(key).length > 1,
    )
  )
    return null
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
  return `${routePaths.accommodations}/${id}?${query}`
}
