import { readPositiveId } from '../../components/admin/roomValidation'
import { inventoryCalendarDates } from '../../components/admin/inventoryValidation'
import { isCalendarDate } from '../../utils/calendarDate'

export function adminInventoryPath(roomId: number) {
  return `/admin/inventories?${new URLSearchParams({ roomId: String(roomId) })}`
}
export function readAdminInventoryQuery(params: URLSearchParams) {
  if (['roomId', 'startDate', 'endDate'].some((key) => params.getAll(key).length > 1)) return null
  const roomId = readPositiveId(params.get('roomId')),
    startDate = params.get('startDate') ?? '',
    endDate = params.get('endDate') ?? ''
  if (
    (params.has('roomId') && roomId === null) ||
    (params.has('startDate') && !isCalendarDate(startDate)) ||
    (params.has('endDate') && !isCalendarDate(endDate)) ||
    (startDate && endDate && !inventoryCalendarDates(startDate, endDate))
  )
    return null
  return { roomId, startDate, endDate }
}
