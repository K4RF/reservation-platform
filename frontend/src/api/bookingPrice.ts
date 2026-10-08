import { apiClient } from './client'
import { ApiError } from './errors'
import { validateAvailability } from './availabilityValidation'
import { toMinorUnits } from '../utils/money'

export interface RoomDailyPriceResponse {
  roomDailyPriceId: number | null
  roomId: number
  stayDate: string
  nightlyPrice: number
  source: 'DAILY' | 'DEFAULT'
}
export interface BookingPrice {
  nights: RoomDailyPriceResponse[]
  totalMinorUnits: bigint
}

export function stayDates(checkInDate: string, checkOutDate: string): string[] {
  const error = validateAvailability({ checkInDate, checkOutDate, guestCount: 1 })
  if (error) throw new RangeError(error)
  const dates: string[] = []
  const date = new Date(`${checkInDate}T00:00:00Z`)
  while (date.toISOString().slice(0, 10) < checkOutDate) {
    dates.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return dates
}

export async function getEffectiveRoomPrice(
  roomId: number,
  stayDate: string,
  signal?: AbortSignal,
): Promise<RoomDailyPriceResponse> {
  const response = await apiClient.request<RoomDailyPriceResponse>(
    `/rooms/${roomId}/prices/${stayDate}`,
    { signal, includeAuth: false },
  )
  if (
    !response ||
    response.roomId !== roomId ||
    response.stayDate !== stayDate ||
    typeof response.nightlyPrice !== 'number' ||
    !Number.isFinite(response.nightlyPrice) ||
    response.nightlyPrice < 0 ||
    !(
      (response.source === 'DEFAULT' && response.roomDailyPriceId === null) ||
      (response.source === 'DAILY' &&
        Number.isSafeInteger(response.roomDailyPriceId) &&
        (response.roomDailyPriceId ?? 0) > 0 &&
        response.nightlyPrice > 0)
    )
  ) {
    throw new ApiError('객실 가격 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  try {
    toMinorUnits(response.nightlyPrice)
  } catch {
    throw new ApiError('객실 가격 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response
}

// Read-only presentation aggregate: fallback and price policy belong exclusively to Backend.
export async function getBookingPrice(
  roomId: number,
  checkInDate: string,
  checkOutDate: string,
  signal?: AbortSignal,
): Promise<BookingPrice> {
  const dates = stayDates(checkInDate, checkOutDate)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const nights = new Array<RoomDailyPriceResponse>(dates.length)
  let index = 0
  try {
    await Promise.all(
      Array.from({ length: Math.min(4, dates.length) }, async () => {
        while (index < dates.length) {
          const current = index++
          nights[current] = await getEffectiveRoomPrice(roomId, dates[current], controller.signal)
        }
      }),
    )
    return {
      nights,
      totalMinorUnits: nights.reduce((sum, night) => sum + toMinorUnits(night.nightlyPrice), 0n),
    }
  } catch (error) {
    controller.abort()
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}
