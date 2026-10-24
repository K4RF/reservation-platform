import { isCalendarDate } from '../utils/calendarDate'

// API guestCount is a positive Java Integer, not a service-wide occupancy policy.
export const MAX_GUEST_COUNT = 2147483647

export function isValidGuestCount(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_GUEST_COUNT
}

export interface AvailabilityRequest {
  checkInDate: string
  checkOutDate: string
  guestCount: number
}

export function validateAvailability(request: AvailabilityRequest): string | null {
  if (!isCalendarDate(request.checkInDate) || !isCalendarDate(request.checkOutDate))
    return '올바른 체크인과 체크아웃 날짜를 모두 입력하세요.'
  if (request.checkInDate >= request.checkOutDate)
    return '체크아웃은 체크인보다 늦은 날짜여야 합니다.'
  if (!isValidGuestCount(request.guestCount)) return '인원은 1명 이상의 정수여야 합니다.'
  return null
}
