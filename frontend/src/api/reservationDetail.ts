import { apiClient } from './client'
import { ApiError } from './errors'
import { readReservationResult, type ReservationResult } from './reservation'
import { isCalendarDate } from '../utils/calendarDate'
import { toMinorUnits } from '../utils/money'
import { isUtcInstant } from '../utils/utcInstant'

export interface ReservationNight {
  stayDate: string
  priceSnapshot: number
}

export interface CancellationPolicySnapshot {
  freeCancellationDaysBeforeCheckIn: number
  cancellationDeadlineDaysBeforeCheckIn: number
  feeRules: { minDaysBeforeCheckIn: number; feeRatePercent: number }[]
}

// Owner-detail projection of the existing ReservationResponse, not a new server DTO.
export interface ReservationDetail extends ReservationResult {
  nightlyPriceSnapshot: number
  nights: ReservationNight[]
  cancellationPolicySnapshot: CancellationPolicySnapshot
  cancelledAt: string | null
  cancellationFeeAmount: number | null
  refundAmount: number | null
}

export function readReservationDetail(value: ReservationDetail | undefined): ReservationDetail {
  const result = readReservationResult(value) as ReservationDetail
  try {
    const dayCount =
      (Date.parse(`${result.checkOutDate}T00:00:00Z`) -
        Date.parse(`${result.checkInDate}T00:00:00Z`)) /
      86_400_000
    if (result.stayNights !== dayCount || !Array.isArray(result.nights)) throw new Error()
    const firstPrice = toMinorUnits(result.nightlyPriceSnapshot)
    // Empty per-night history is legitimate for pre-upgrade reservations. Never reconstruct it.
    if (result.nights.length > 0) {
      if (result.nights.length !== dayCount) throw new Error()
      let sum = 0n
      const dates = new Set<string>()
      for (const night of result.nights) {
        if (
          !night ||
          typeof night.stayDate !== 'string' ||
          !isCalendarDate(night.stayDate) ||
          night.stayDate < result.checkInDate ||
          night.stayDate >= result.checkOutDate ||
          dates.has(night.stayDate)
        )
          throw new Error()
        dates.add(night.stayDate)
        sum += toMinorUnits(night.priceSnapshot)
      }
      const firstNight = result.nights.find((night) => night.stayDate === result.checkInDate)
      if (
        !firstNight ||
        toMinorUnits(firstNight.priceSnapshot) !== firstPrice ||
        sum !== toMinorUnits(result.totalAmount, 19)
      )
        throw new Error()
    }
    const policy = result.cancellationPolicySnapshot
    if (
      !policy ||
      !Number.isSafeInteger(policy.freeCancellationDaysBeforeCheckIn) ||
      !Number.isSafeInteger(policy.cancellationDeadlineDaysBeforeCheckIn) ||
      policy.cancellationDeadlineDaysBeforeCheckIn < 0 ||
      policy.freeCancellationDaysBeforeCheckIn <= policy.cancellationDeadlineDaysBeforeCheckIn ||
      !Array.isArray(policy.feeRules) ||
      policy.feeRules.length === 0
    )
      throw new Error()
    let previous = policy.freeCancellationDaysBeforeCheckIn
    for (const rule of policy.feeRules) {
      if (
        !rule ||
        !Number.isSafeInteger(rule.minDaysBeforeCheckIn) ||
        rule.minDaysBeforeCheckIn < policy.cancellationDeadlineDaysBeforeCheckIn ||
        rule.minDaysBeforeCheckIn >= previous ||
        !Number.isInteger(rule.feeRatePercent) ||
        rule.feeRatePercent < 1 ||
        rule.feeRatePercent > 100
      )
        throw new Error()
      previous = rule.minDaysBeforeCheckIn
    }
    if (previous !== policy.cancellationDeadlineDaysBeforeCheckIn) throw new Error()
    if (result.cancelledAt !== null && !isUtcInstant(result.cancelledAt)) throw new Error()
    for (const amount of [result.cancellationFeeAmount, result.refundAmount]) {
      if (amount !== null) toMinorUnits(amount, 19)
    }
    if (
      result.status === 'CONFIRMED' &&
      [result.cancelledAt, result.cancellationFeeAmount, result.refundAmount].some(
        (value) => value !== null,
      )
    )
      throw new Error()
  } catch {
    throw new ApiError('예약 상세 Snapshot 응답을 확인할 수 없습니다.', {
      kind: 'unexpected_response',
    })
  }
  return result
}

export async function getReservationDetail(
  id: number,
  signal?: AbortSignal,
): Promise<ReservationDetail> {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid reservation ID')
  const result = readReservationDetail(
    await apiClient.request<ReservationDetail>(`/reservations/${id}`, { signal }),
  )
  if (result.reservationId !== id)
    throw new ApiError('예약 ID가 일치하지 않습니다.', { kind: 'unexpected_response' })
  return result
}
