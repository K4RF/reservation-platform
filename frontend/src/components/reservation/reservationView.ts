import type { ReservationSummary } from '../../api/reservationList'
import type { ReservationCatalogInfo } from '../../api/reservationCatalog'
import { ApiError } from '../../api/errors'
import { reservationDetailPath } from '../../app/routePaths'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'

export interface ReservationCardModel {
  id: number
  number: string
  detailPath: string
  accommodationName: string
  roomName: string
  catalogUnavailable: boolean
  checkInDate: string
  checkOutDate: string
  stayNights: number
  guestCount: number
  status: ReservationSummary['status']
  statusLabel: string
  totalAmount: string
}

export function toReservationCard(
  row: ReservationSummary,
  catalog?: ReservationCatalogInfo,
): ReservationCardModel {
  return {
    id: row.reservationId,
    number: row.reservationNumber ?? '미등록 (과거 예약)',
    detailPath: reservationDetailPath(row.reservationId),
    accommodationName:
      catalog?.accommodationName ??
      (catalog?.accommodationId ? `숙소 ID: ${catalog.accommodationId}` : '숙소 정보 조회 불가'),
    roomName: catalog?.roomName ?? `객실 ID: ${row.roomId}`,
    catalogUnavailable: !catalog?.roomName || !catalog.accommodationName,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    stayNights: row.stayNights,
    guestCount: row.guestCount,
    status: row.status,
    statusLabel: row.status === 'CONFIRMED' ? '예약 확정' : '예약 취소',
    totalAmount: formatMinorUnits(toMinorUnits(row.totalAmount, 19)),
  }
}

export function reservationReadError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.category) {
      case 'bad_request':
        return '예약 조회 조건을 확인해 주세요.'
      case 'unauthorized':
        return '로그인이 필요합니다. 다시 로그인해 주세요.'
      case 'forbidden':
        return '본인 예약만 조회할 수 있습니다.'
      case 'not_found':
        return '예약을 찾을 수 없습니다.'
      case 'conflict':
        return '예약 조회 중 충돌이 발생했습니다. 다시 조회해 주세요.'
    }
    if (error.kind === 'unexpected_response') return '예약 응답 형식을 확인할 수 없습니다.'
    if (error.kind === 'timeout') return '예약 조회 시간이 초과되었습니다. 다시 시도해 주세요.'
  }
  return '예약을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
}
