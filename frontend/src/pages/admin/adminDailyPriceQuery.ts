import { readPositiveId } from '../../components/admin/roomValidation'
import { isCalendarDate } from '../../utils/calendarDate'

export function adminDailyPricePath(roomId: number, stayDate?: string) {
  const query = new URLSearchParams({ roomId: String(roomId) })
  if (stayDate) query.set('stayDate', stayDate)
  return `/admin/prices?${query}`
}
export function readAdminDailyPriceQuery(
  params: URLSearchParams,
): { roomId: number | null; stayDate: string } | null {
  if (['roomId', 'stayDate'].some((key) => params.getAll(key).length > 1)) return null
  const roomId = readPositiveId(params.get('roomId')),
    stayDate = params.get('stayDate') ?? ''
  if (
    (params.has('roomId') && roomId === null) ||
    (params.has('stayDate') && !isCalendarDate(stayDate))
  )
    return null
  return { roomId, stayDate }
}
