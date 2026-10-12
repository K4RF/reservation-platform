import { getReservationDetail, type ReservationDetail } from './reservationDetail'
import { apiClient } from './client'
import { ApiError } from './errors'
import { isCalendarDate } from '../utils/calendarDate'
import { isUtcInstant } from '../utils/utcInstant'
import { toMinorUnits } from '../utils/money'

// PATCH cancel has no request body. These fields are a completed operation, not a preview.
export interface ReservationCancellationResponse {
  reservationId: number
  status: 'CANCELLED'
  cancelledAt: string
  cancellationDate: string
  daysBeforeCheckIn: number
  totalAmount: number
  cancellationFeeRate: number
  cancellationFeeAmount: number
  estimatedRefundAmount: number
}

export async function cancelReservation(
  id: number,
  signal?: AbortSignal,
): Promise<ReservationCancellationResponse> {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid reservation ID')
  const result = await apiClient.request<ReservationCancellationResponse>(
    `/reservations/${id}/cancel`,
    {
      method: 'PATCH',
      retryOnUnauthorized: false,
      signal,
    },
  )
  try {
    if (
      !result ||
      result.reservationId !== id ||
      result.status !== 'CANCELLED' ||
      !isUtcInstant(result.cancelledAt) ||
      typeof result.cancellationDate !== 'string' ||
      !isCalendarDate(result.cancellationDate) ||
      !Number.isSafeInteger(result.daysBeforeCheckIn) ||
      result.daysBeforeCheckIn < 0 ||
      !Number.isInteger(result.cancellationFeeRate) ||
      result.cancellationFeeRate < 0 ||
      result.cancellationFeeRate > 100
    )
      throw new Error()
    // Structural consistency only. Fee calculation, rounding and eligibility remain server-owned.
    if (
      toMinorUnits(result.cancellationFeeAmount, 19) +
        toMinorUnits(result.estimatedRefundAmount, 19) !==
      toMinorUnits(result.totalAmount, 19)
    )
      throw new Error()
  } catch {
    throw new ApiError('취소 처리 응답을 확인할 수 없습니다.', { kind: 'unexpected_response' })
  }
  return result
}

// Projection of stored ReservationResponse fields, NOT a cancellation quote.
// CancelResponse uses estimatedRefundAmount; Detail uses refundAmount.
export type ReservationCancellationSummary = Pick<
  ReservationDetail,
  | 'reservationId'
  | 'reservationNumber'
  | 'checkInDate'
  | 'checkOutDate'
  | 'totalAmount'
  | 'status'
  | 'cancellationPolicySnapshot'
  | 'cancelledAt'
  | 'cancellationFeeAmount'
  | 'refundAmount'
>

export async function getReservationCancellationSummary(
  id: number,
  signal?: AbortSignal,
): Promise<ReservationCancellationSummary> {
  // The only read contract available is authenticated owner detail. Never call cancel for a preview.
  return getReservationDetail(id, signal)
}
