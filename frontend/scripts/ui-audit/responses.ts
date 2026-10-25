import { accommodation, accommodationPage } from '../../src/test/accommodation'
import { room, roomPage } from '../../src/test/room'
import {
  reservationDetail,
  cancelledReservationDetail,
  reservationPage,
} from '../../src/test/reservation'
import { inventoryCalendar } from '../../src/test/inventory'

export type AuditScenario = 'ready' | 'empty' | 'error' | 'loading' | 'cancelled' | 'stress'

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
  // Read-only layout probes, never actual catalog/guest data or a new API contract.
  const stress = scenario === 'stress'
  const catalog = stress
    ? {
        ...accommodation,
        name: 'LongAccommodationName'.repeat(5).slice(0, 100),
        description:
          '긴 설명과 줄바꿈을 생략하지 않고 표시합니다.\n' + 'DescriptionWithoutSpaces'.repeat(8),
        address: 'DetailAddressWithoutSpaces'.repeat(6),
      }
    : accommodation
  const catalogRoom = stress
    ? {
        ...room,
        name: 'LongRoomNameWithoutSpaces'.repeat(5).slice(0, 100),
        nightlyPrice: 9999999999.99,
      }
    : room
  const detail = stress
    ? {
        ...reservationDetail,
        representativeGuest: {
          name: 'DemoGuestName'.repeat(8).slice(0, 100),
          email: 'demo.' + 'long'.repeat(35) + '@example.com',
          phone: '010-0000-0000',
        },
        nightlyPriceSnapshot: catalogRoom.nightlyPrice,
        totalAmount: 19999999999.98,
        nights: reservationDetail.nights!.map((night) => ({
          ...night,
          priceSnapshot: catalogRoom.nightlyPrice,
        })),
      }
    : reservationDetail
  if (path === '/api/v1/accommodations')
    return Response.json(
      accommodationPage(
        empty ? { content: [], totalElements: 0, totalPages: 0 } : { content: [catalog] },
      ),
    )
  if (path === '/api/v1/accommodations/7') return Response.json(catalog)
  if (path === '/api/v1/rooms/3') return Response.json(catalogRoom)
  if (['/api/v1/accommodations/7/rooms', '/api/v1/accommodations/7/rooms/available'].includes(path))
    return Response.json(
      roomPage(
        empty ? { content: [], totalElements: 0, totalPages: 0 } : { content: [catalogRoom] },
      ),
    )
  if (path === '/api/v1/reservations')
    return Response.json(
      reservationPage(
        empty ? { content: [], totalElements: 0, totalPages: 0 } : { content: [detail] },
      ),
    )
  if (path === '/api/v1/reservations/42')
    return Response.json(scenario === 'cancelled' ? cancelledReservationDetail : detail)
  if (/^\/api\/v1\/rooms\/3\/prices\/\d{4}-\d{2}-\d{2}$/.test(path))
    return Response.json({
      roomDailyPriceId: null,
      roomId: 3,
      stayDate: path.slice(-10),
      nightlyPrice: catalogRoom.nightlyPrice,
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
