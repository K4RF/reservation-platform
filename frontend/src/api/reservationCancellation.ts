import { getReservationDetail, type ReservationDetail } from './reservationDetail'

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
