import { apiClient } from './client'
import { ApiError } from './errors'
import type { BookingRequest, RepresentativeGuestRequest } from './booking'
import { validateAvailability } from './availabilityValidation'
import { toMinorUnits } from '../utils/money'

// Projection of ReservationResponse fields used by the completion screen (not a new API DTO).
export interface ReservationResult {
  reservationId: number
  reservationNumber: string | null
  roomId: number
  guestCount: number
  representativeGuest: RepresentativeGuestRequest | null
  checkInDate: string
  checkOutDate: string
  stayNights: number
  totalAmount: number
  status: 'CONFIRMED' | 'CANCELLED'
}

function readResult(value: ReservationResult | undefined): ReservationResult {
  if (
    !value ||
    !Number.isSafeInteger(value.reservationId) ||
    value.reservationId < 1 ||
    !Number.isSafeInteger(value.roomId) ||
    value.roomId < 1 ||
    !(
      value.reservationNumber === null ||
      (typeof value.reservationNumber === 'string' &&
        /^RSV-\d{8}-[A-F0-9]{16}$/.test(value.reservationNumber))
    ) ||
    validateAvailability(value) ||
    !Number.isSafeInteger(value.stayNights) ||
    value.stayNights < 1 ||
    (value.status !== 'CONFIRMED' && value.status !== 'CANCELLED') ||
    !(
      value.representativeGuest === null ||
      (value.representativeGuest &&
        ['name', 'email', 'phone'].every(
          (key) =>
            typeof value.representativeGuest?.[key as keyof RepresentativeGuestRequest] ===
            'string',
        ))
    )
  )
    throw new ApiError('예약 응답을 확인할 수 없습니다.', { kind: 'unexpected_response' })
  try {
    toMinorUnits(value.totalAmount, 19)
  } catch {
    throw new ApiError('예약 금액 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return value
}

export async function createReservation(request: BookingRequest): Promise<ReservationResult> {
  // Never replay a non-idempotent POST, including automatic 401 recovery replay.
  const result = readResult(
    await apiClient.request<ReservationResult>('/reservations', {
      method: 'POST',
      body: request,
      retryOnUnauthorized: false,
    }),
  )
  if (
    result.status !== 'CONFIRMED' ||
    !result.reservationNumber ||
    !result.representativeGuest ||
    result.roomId !== request.roomId ||
    result.guestCount !== request.guestCount ||
    result.checkInDate !== request.checkInDate ||
    result.checkOutDate !== request.checkOutDate
  )
    throw new ApiError('생성 결과를 확인할 수 없습니다.', { kind: 'unexpected_response' })
  return result
}

export async function getReservation(id: number, signal?: AbortSignal): Promise<ReservationResult> {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid reservation ID')
  const result = readResult(
    await apiClient.request<ReservationResult>(`/reservations/${id}`, { signal }),
  )
  if (result.reservationId !== id)
    throw new ApiError('예약 ID가 일치하지 않습니다.', { kind: 'unexpected_response' })
  return result
}
