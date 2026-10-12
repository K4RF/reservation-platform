import { isCalendarDate } from './calendarDate'

export function isUtcInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/.test(value) &&
    isCalendarDate(value.slice(0, 10))
  )
}
