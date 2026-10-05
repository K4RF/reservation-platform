export interface AvailabilityRequest {
  checkInDate: string
  checkOutDate: string
  guestCount: number
}

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateAvailability(request: AvailabilityRequest): string | null {
  if (!calendarDate(request.checkInDate) || !calendarDate(request.checkOutDate))
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
