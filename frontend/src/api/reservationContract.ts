import { ApiError } from './errors'

export function reservationPath(id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid reservation ID')
  return `/reservations/${id}`
}

// Request/response ID consistency only; JWT ownership remains a Backend responsibility.
export function requireReservationIdentity<T extends { reservationId: number }>(
  result: T,
  id: number,
): T {
  if (result.reservationId !== id)
    throw new ApiError('예약 ID가 일치하지 않습니다.', { kind: 'unexpected_response' })
  return result
}
