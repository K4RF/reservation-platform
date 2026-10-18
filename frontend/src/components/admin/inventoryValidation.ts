import { isCalendarDate } from '../../utils/calendarDate'

// A rendering guard only; the Backend has no equivalent booking/range policy.
export const MAX_INVENTORY_CALENDAR_DAYS = 366
export function inventoryCalendarDates(startDate: string, endDate: string): string[] | null {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || startDate > endDate) return null
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const count = (Date.parse(`${endDate}T00:00:00Z`) - start) / 86400000 + 1
  if (count > MAX_INVENTORY_CALENDAR_DAYS) return null
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86400000).toISOString().slice(0, 10),
  )
}
export function readInventoryQuantity(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 2147483647 ? number : null
}
