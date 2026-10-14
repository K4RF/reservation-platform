import { apiClient } from './client'
import { ApiError } from './errors'
import { validateAvailability } from './availabilityValidation'
import { readReservationDetail, type ReservationDetail } from './reservationDetail'
import { reservationPath, requireReservationIdentity } from './reservationContract'

// UpdateReservationScheduleRequest: identity, room, guests and prices are never submitted.
export interface ReservationChangeRequest {
  checkInDate: string
  checkOutDate: string
}

export async function changeReservationSchedule(
  reservation: ReservationDetail,
  request: ReservationChangeRequest,
  signal?: AbortSignal,
): Promise<ReservationDetail> {
  const path = reservationPath(reservation.reservationId)
  const error = validateAvailability({ ...request, guestCount: reservation.guestCount })
  if (error) throw new RangeError(error)
  const result = readReservationDetail(
    await apiClient.request<ReservationDetail>(path, {
      method: 'PATCH',
      body: { checkInDate: request.checkInDate, checkOutDate: request.checkOutDate },
      signal,
      retryOnUnauthorized: false,
    }),
  )
  if (
    result.roomId !== reservation.roomId ||
    result.guestCount !== reservation.guestCount ||
    result.reservationNumber !== reservation.reservationNumber ||
    result.status !== 'CONFIRMED' ||
    result.checkInDate !== request.checkInDate ||
    result.checkOutDate !== request.checkOutDate ||
    result.nights.length !== result.stayNights ||
    !sameGuest(result, reservation) ||
    !samePolicy(result, reservation)
  )
    throw new ApiError('일정 변경 결과를 확인할 수 없습니다.', { kind: 'unexpected_response' })
  return requireReservationIdentity(result, reservation.reservationId)
}

function sameGuest(a: ReservationDetail, b: ReservationDetail) {
  return a.representativeGuest === null || b.representativeGuest === null
    ? a.representativeGuest === b.representativeGuest
    : (['name', 'email', 'phone'] as const).every(
        (key) => a.representativeGuest?.[key] === b.representativeGuest?.[key],
      )
}

function samePolicy(a: ReservationDetail, b: ReservationDetail) {
  const left = a.cancellationPolicySnapshot
  const right = b.cancellationPolicySnapshot
  return (
    left.freeCancellationDaysBeforeCheckIn === right.freeCancellationDaysBeforeCheckIn &&
    left.cancellationDeadlineDaysBeforeCheckIn === right.cancellationDeadlineDaysBeforeCheckIn &&
    left.feeRules.length === right.feeRules.length &&
    left.feeRules.every(
      (rule, index) =>
        rule.minDaysBeforeCheckIn === right.feeRules[index].minDaysBeforeCheckIn &&
        rule.feeRatePercent === right.feeRules[index].feeRatePercent,
    )
  )
}
