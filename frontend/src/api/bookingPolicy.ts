import { apiClient } from './client'
import { ApiError } from './errors'

export interface BookingPolicyRequest {
  minStayNights: number
  maxStayNights: number
  minAdvanceBookingDays: number
  maxAdvanceBookingDays: number
}
export interface BookingPolicyResponse extends BookingPolicyRequest {
  bookingPolicyId: number
  accommodationId: number
}

export function validBookingPolicy(body: BookingPolicyRequest): boolean {
  const integer = (value: number, min: number) =>
    Number.isInteger(value) && value >= min && value <= 2147483647
  return (
    integer(body.minStayNights, 1) &&
    integer(body.maxStayNights, body.minStayNights) &&
    integer(body.minAdvanceBookingDays, 0) &&
    integer(body.maxAdvanceBookingDays, body.minAdvanceBookingDays)
  )
}

export function isBookingPolicy(
  value: unknown,
  accommodationId: number,
): value is BookingPolicyResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const policy = value as BookingPolicyResponse
  return (
    policy.accommodationId === accommodationId &&
    Number.isSafeInteger(policy.bookingPolicyId) &&
    policy.bookingPolicyId > 0 &&
    validBookingPolicy(policy)
  )
}

export async function getBookingPolicy(
  id: number,
  signal?: AbortSignal,
): Promise<BookingPolicyResponse | null> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('Invalid accommodation ID')
  let status: number | undefined
  const response = await apiClient.request<unknown>(`/accommodations/${id}/booking-policy`, {
    includeAuth: false,
    signal,
    onResponseHeaders: (_headers, code) => {
      status = code
    },
  })
  if (status === 204 && response === undefined) return null
  if (status === 200 && isBookingPolicy(response, id)) return response
  throw new ApiError('예약 정책 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
}
