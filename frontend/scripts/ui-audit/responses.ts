import { accommodation, accommodationPage } from '../../src/test/accommodation'
import type { AccommodationResponse } from '../../src/api/accommodation'
import { room, roomPage } from '../../src/test/room'
import {
  reservationDetail,
  cancelledReservationDetail,
  reservationPage,
} from '../../src/test/reservation'
import { inventoryCalendar } from '../../src/test/inventory'
import type { MediaResponse } from '../../src/api/media'

export type AuditScenario =
  'ready' | 'empty' | 'error' | 'loading' | 'cancelled' | 'stress' | 'comparison'

// Render fixtures only. Never forwards a request or mutates an actual reservation/catalog.
export function auditResponse(
  url: string,
  method: string,
  scenario: AuditScenario,
  mediaMode = 'missing',
): Response {
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
  const photo = (id: number, order: number): MediaResponse => ({
    mediaId: id,
    url: `/api/v1/media/${id}/content`,
    altText: stress
      ? 'LongAlternativeTextWithoutSpaces'.repeat(9).slice(0, 300)
      : `AI 생성 가상 콘셉트 사진 ${order + 1} · 실제 시설 아님`,
    width: 1672,
    height: 941,
    byteSize: id === 2001 ? 2456556 : 2763272,
    contentType: 'image/png',
    sortOrder: order,
  })
  const images =
    mediaMode === 'missing'
      ? []
      : [
          photo(mediaMode === 'failed' ? 2998 : 2001, 0),
          photo(mediaMode === 'partial' || mediaMode === 'failed' ? 2999 : 2002, 1),
        ]
  const roomImages = images.length ? [photo(mediaMode === 'failed' ? 2999 : 2002, 0)] : []
  const baseCatalog = { ...accommodation, representativeImage: images[0] ?? null, images }
  const baseRoom = { ...room, representativeImage: roomImages[0] ?? null, images: roomImages }
  const catalog = stress
    ? {
        ...baseCatalog,
        name: 'LongAccommodationName'.repeat(5).slice(0, 100),
        description:
          '긴 설명과 줄바꿈을 생략하지 않고 표시합니다.\n' + 'DescriptionWithoutSpaces'.repeat(8),
        address: 'DetailAddressWithoutSpaces'.repeat(6),
      }
    : baseCatalog
  const catalogRoom = stress
    ? {
        ...baseRoom,
        name: 'LongRoomNameWithoutSpaces'.repeat(5).slice(0, 100),
        nightlyPrice: 9999999999.99,
      }
    : baseRoom
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
  // Synthetic layout-only rows. Photos are fictional audit assets, never real property evidence.
  if (scenario === 'comparison' && path === '/api/v1/accommodations') {
    const rows: AccommodationResponse[] = Array.from({ length: 4 }, (_, index) => ({
      ...catalog,
      representativeImage: catalog.images[index % catalog.images.length] ?? null,
      images: catalog.images.length ? [catalog.images[index % catalog.images.length]] : [],
      accommodationId: 7 + index,
      name: index === 0 ? accommodation.name : `UI 비교 점검 숙소 ${index + 1}`,
      description:
        index === 0
          ? accommodation.description
          : '화면 비교 검증용 가상 Fixture입니다. 실제 숙소가 아닙니다.',
      status: index === 3 ? 'INACTIVE' : 'ACTIVE',
    }))
    const size = Number(query.get('size') ?? 20)
    const page = Number(query.get('page') ?? 0)
    const totalPages = Math.ceil(rows.length / size)
    return Response.json(
      accommodationPage({
        content: rows.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: rows.length,
        totalPages,
        first: page === 0,
        last: page >= totalPages - 1,
      }),
    )
  }
  if (path === '/api/v1/accommodations')
    return Response.json(
      accommodationPage(
        empty
          ? { content: [], totalElements: 0, totalPages: 0 }
          : { content: [{ ...catalog, images: catalog.images.slice(0, 1) }] },
      ),
    )
  if (path === '/api/v1/accommodations/7') return Response.json(catalog)
  if (path === '/api/v1/rooms/3') return Response.json(catalogRoom)
  if (['/api/v1/accommodations/7/media', '/api/v1/rooms/3/media'].includes(path)) {
    const roomOwner = path.includes('/rooms/')
    const revision = 'a'.repeat(64)
    return Response.json(
      {
        ownerType: roomOwner ? 'ROOM' : 'ACCOMMODATION',
        ownerId: roomOwner ? 3 : 7,
        revision,
        images: (roomOwner ? roomImages : images).map((image) => ({
          image,
          source: 'ImageGen 승인 시안 · 격리 UI Audit 전용',
          rightsRecord: '실제 시설 근거 아님 · ASSETS.md 참조',
        })),
      },
      { headers: { ETag: `"${revision}"`, 'Cache-Control': 'no-store' } },
    )
  }
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
