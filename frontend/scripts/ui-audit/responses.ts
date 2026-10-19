import { accommodation, accommodationPage } from '../../src/test/accommodation'
import { room, roomPage } from '../../src/test/room'
import {
  reservationDetail,
  cancelledReservationDetail,
  reservationPage,
} from '../../src/test/reservation'
import { inventoryCalendar } from '../../src/test/inventory'

export type AuditScenario = 'ready' | 'empty' | 'error' | 'loading' | 'cancelled'

// Render fixtures only. Never forwards a request or mutates an actual reservation/catalog.
export function auditResponse(url: string, method: string, scenario: AuditScenario): Response {
  const { pathname: path, searchParams: query } = new URL(url, 'http://127.0.0.1:5174')
  const failure = (status: number, code: string, message: string) =>
    Response.json(
      {
        timestamp: '2026-10-19T00:00:00Z',
        status,
        code,
        message,
        path,
        errors: [],
      },
      { status },
    )
  if (method.toUpperCase() !== 'GET')
    return failure(405, 'AUDIT_READ_ONLY', 'UI 점검 도구에서는 모든 쓰기 요청을 차단합니다.')
  if (scenario === 'error') return failure(500, 'AUDIT_FIXTURE_ERROR', 'UI 점검용 오류 응답입니다.')
  const empty = scenario === 'empty'
  if (path === '/api/v1/accommodations')
    return Response.json(
      accommodationPage(empty ? { content: [], totalElements: 0, totalPages: 0 } : {}),
    )
  if (path === '/api/v1/accommodations/7') return Response.json(accommodation)
  if (path === '/api/v1/rooms/3') return Response.json(room)
  if (['/api/v1/accommodations/7/rooms', '/api/v1/accommodations/7/rooms/available'].includes(path))
    return Response.json(roomPage(empty ? { content: [], totalElements: 0, totalPages: 0 } : {}))
  if (path === '/api/v1/reservations')
    return Response.json(
      reservationPage(empty ? { content: [], totalElements: 0, totalPages: 0 } : {}),
    )
  if (path === '/api/v1/reservations/42')
    return Response.json(scenario === 'cancelled' ? cancelledReservationDetail : reservationDetail)
  if (/^\/api\/v1\/rooms\/3\/prices\/\d{4}-\d{2}-\d{2}$/.test(path))
    return Response.json({
      roomDailyPriceId: null,
      roomId: 3,
      stayDate: path.slice(-10),
      nightlyPrice: room.nightlyPrice,
      source: 'DEFAULT',
    })
  if (path === '/api/v1/rooms/3/inventories')
    return Response.json({
      ...inventoryCalendar,
      startDate: query.get('startDate'),
      endDate: query.get('endDate'),
      inventories: empty
        ? []
        : inventoryCalendar.inventories.filter(
            (row) =>
              row.inventoryDate >= query.get('startDate')! &&
              row.inventoryDate <= query.get('endDate')!,
          ),
    })
  return failure(
    404,
    'AUDIT_UNKNOWN_ROUTE',
    'Audit Fixture가 없는 API입니다. Backend로 전달하지 않습니다.',
  )
}
