import { apiClient } from './client'
import { ApiError } from './errors'
import { isAccommodation } from './accommodation'
import type {
  AccommodationAmenity,
  AccommodationResponse,
  AccommodationStatus,
} from './accommodation'

// Create and full replacement Update have the same fields; status is a separate PATCH.
export interface AccommodationWriteRequest {
  name: string
  description: string
  country: string
  city: string
  region: string
  address: string
  amenities: AccommodationAmenity[]
  checkInTime: string
  checkOutTime: string
  timeZone: string
}
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
export interface CancellationFeeRule {
  minDaysBeforeCheckIn: number
  feeRatePercent: number
}
export interface CancellationPolicyRequest {
  freeCancellationDaysBeforeCheckIn: number
  cancellationDeadlineDaysBeforeCheckIn: number
  feeRules: CancellationFeeRule[]
}
export interface CancellationPolicyResponse extends CancellationPolicyRequest {
  cancellationPolicyId: number
  accommodationId: number
}
export type PolicyOperation = 'POST' | 'PUT'

function invalidResponse(): never {
  throw new ApiError('관리 API 응답이 올바르지 않습니다. 저장 결과를 확인해 주세요.', {
    kind: 'unexpected_response',
  })
}
export async function saveAccommodation(
  id: number | null,
  body: AccommodationWriteRequest,
  signal?: AbortSignal,
): Promise<AccommodationResponse> {
  const response = await apiClient.request<unknown>(
    `/accommodations${id === null ? '' : `/${id}`}`,
    {
      method: id === null ? 'POST' : 'PUT',
      body,
      signal,
      retryOnUnauthorized: false,
    },
  )
  if (!isAccommodation(response) || (id !== null && response.accommodationId !== id))
    invalidResponse()
  return response
}
export async function changeAccommodationStatus(
  id: number,
  status: AccommodationStatus,
  signal?: AbortSignal,
): Promise<AccommodationResponse> {
  const response = await apiClient.request<unknown>(`/accommodations/${id}/status`, {
    method: 'PATCH',
    body: { status },
    signal,
    retryOnUnauthorized: false,
  })
  if (!isAccommodation(response) || response.accommodationId !== id || response.status !== status)
    invalidResponse()
  return response
}
const integer = (value: unknown, min: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= 2147483647

export function validBookingPolicy(body: BookingPolicyRequest): boolean {
  return (
    integer(body.minStayNights, 1) &&
    integer(body.maxStayNights, body.minStayNights) &&
    integer(body.minAdvanceBookingDays, 0) &&
    integer(body.maxAdvanceBookingDays, body.minAdvanceBookingDays)
  )
}
export function validCancellationPolicy(body: CancellationPolicyRequest): boolean {
  return (
    integer(body.cancellationDeadlineDaysBeforeCheckIn, 0) &&
    integer(
      body.freeCancellationDaysBeforeCheckIn,
      body.cancellationDeadlineDaysBeforeCheckIn + 1,
    ) &&
    Array.isArray(body.feeRules) &&
    body.feeRules.length > 0 &&
    body.feeRules.every(
      (rule) =>
        rule &&
        integer(rule.minDaysBeforeCheckIn, body.cancellationDeadlineDaysBeforeCheckIn) &&
        rule.minDaysBeforeCheckIn < body.freeCancellationDaysBeforeCheckIn &&
        integer(rule.feeRatePercent, 1) &&
        rule.feeRatePercent <= 100,
    ) &&
    new Set(body.feeRules.map((rule) => rule.minDaysBeforeCheckIn)).size === body.feeRules.length &&
    body.feeRules.some(
      (rule) => rule.minDaysBeforeCheckIn === body.cancellationDeadlineDaysBeforeCheckIn,
    )
  )
}
export async function saveBookingPolicy(
  id: number,
  operation: PolicyOperation,
  body: BookingPolicyRequest,
  signal?: AbortSignal,
): Promise<BookingPolicyResponse> {
  const response = await apiClient.request<BookingPolicyResponse>(
    `/accommodations/${id}/booking-policy`,
    {
      method: operation,
      body,
      signal,
      retryOnUnauthorized: false,
    },
  )
  if (
    !response ||
    response.accommodationId !== id ||
    !Number.isSafeInteger(response.bookingPolicyId) ||
    response.bookingPolicyId < 1 ||
    !validBookingPolicy(response)
  )
    invalidResponse()
  return response
}
export async function saveCancellationPolicy(
  id: number,
  operation: PolicyOperation,
  body: CancellationPolicyRequest,
  signal?: AbortSignal,
): Promise<CancellationPolicyResponse> {
  const response = await apiClient.request<CancellationPolicyResponse>(
    `/accommodations/${id}/cancellation-policy`,
    {
      method: operation,
      body,
      signal,
      retryOnUnauthorized: false,
    },
  )
  if (
    !response ||
    response.accommodationId !== id ||
    !Number.isSafeInteger(response.cancellationPolicyId) ||
    response.cancellationPolicyId < 1 ||
    !validCancellationPolicy(response)
  )
    invalidResponse()
  return response
}
