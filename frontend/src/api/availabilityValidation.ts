import { isCalendarDate } from '../utils/calendarDate'

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
  if (
    !Number.isInteger(request.guestCount) ||
    request.guestCount < 1 ||
    request.guestCount > 2147483647
  )
    return '인원은 1명 이상의 정수여야 합니다.'
  return null
}
