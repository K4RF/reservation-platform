import { isCalendarDate } from '../../utils/calendarDate'

export type StayDates = { checkInDate: string; checkOutDate: string }
export type StayDateField = keyof StayDates
const dayMs = 86400000

// UTC is calendar arithmetic only, never the accommodation's business clock or a today restriction.
export function addStayDays(value: string, days: number): string | null {
  if (!isCalendarDate(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  const result = date.toISOString().slice(0, 10)
  return isCalendarDate(result) ? result : null
}

export function stayNights(dates: StayDates): number | null {
  if (
    !isCalendarDate(dates.checkInDate) ||
    !isCalendarDate(dates.checkOutDate) ||
    dates.checkInDate >= dates.checkOutDate
  )
    return null
  return (
    (Date.parse(`${dates.checkOutDate}T00:00:00Z`) - Date.parse(`${dates.checkInDate}T00:00:00Z`)) /
    dayMs
  )
}

export function changeStayCheckIn(current: StayDates, checkInDate: string) {
  const dates = { ...current, checkInDate }
  let notice = ''
  if (
    isCalendarDate(checkInDate) &&
    (!isCalendarDate(current.checkOutDate) || current.checkOutDate <= checkInDate)
  ) {
    dates.checkOutDate = addStayDays(checkInDate, 1) ?? ''
    notice = dates.checkOutDate
      ? `최소 1박을 위해 체크아웃을 ${dates.checkOutDate}로 보정했습니다.`
      : '9999-12-31 이후 체크아웃을 표시할 수 없습니다. 더 이른 체크인을 선택하세요.'
  }
  return { dates, notice }
}

export function shiftStayMonth(month: string, offset: number): string | null {
  const first = `${month}-01`
  if (!isCalendarDate(first)) return null
  const date = new Date(`${first}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  const result = date.toISOString().slice(0, 7)
  return isCalendarDate(`${result}-01`) ? result : null
}

export function monthDays(month: string): (string | null)[][] {
  const first = `${month}-01`
  const offset = new Date(`${first}T00:00:00Z`).getUTCDay()
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let n = 0; n < 31; n++) {
    const date = addStayDays(first, n)
    if (!date || !date.startsWith(month)) break
    cells.push(date)
  }
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}
