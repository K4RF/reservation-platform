import { apiClient } from './client'
import { ApiError } from './errors'
import { readReservationResult, type ReservationResult } from './reservation'
import { isCalendarDate } from '../utils/calendarDate'

// Only actual ReservationResponse fields. Guest contact data is not retained by the list.
export type ReservationSummary = Pick<
  ReservationResult,
  | 'reservationId'
  | 'reservationNumber'
  | 'roomId'
  | 'guestCount'
  | 'checkInDate'
  | 'checkOutDate'
  | 'stayNights'
  | 'totalAmount'
  | 'status'
>

export interface ReservationSearchRequest {
  page?: number
  size?: number
  status?: ReservationResult['status']
  checkInFrom?: string
  checkInTo?: string
  checkOutFrom?: string
  checkOutTo?: string
  sortBy?: 'ID' | 'CHECK_IN_DATE' | 'CHECK_OUT_DATE' | 'TOTAL_AMOUNT'
  direction?: 'ASC' | 'DESC'
}

export interface ReservationPageResponse {
  content: ReservationSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export function toReservationSummary(value: ReservationResult): ReservationSummary {
  const {
    reservationId,
    reservationNumber,
    roomId,
    guestCount,
    checkInDate,
    checkOutDate,
    stayNights,
    totalAmount,
    status,
  } = value
  return {
    reservationId,
    reservationNumber,
    roomId,
    guestCount,
    checkInDate,
    checkOutDate,
    stayNights,
    totalAmount,
    status,
  }
}

export async function getReservations(
  request: ReservationSearchRequest = {},
  signal?: AbortSignal,
): Promise<ReservationPageResponse> {
  const page = request.page ?? 0
  const size = request.size ?? 20
  const sortBy = request.sortBy ?? 'ID'
  const direction = request.direction ?? 'DESC'
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 2147483647 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100 ||
    !['ID', 'CHECK_IN_DATE', 'CHECK_OUT_DATE', 'TOTAL_AMOUNT'].includes(sortBy) ||
    !['ASC', 'DESC'].includes(direction) ||
    (request.status !== undefined && !['CONFIRMED', 'CANCELLED'].includes(request.status))
  )
    throw new RangeError('Invalid reservation list query')
  const query = new URLSearchParams({ page: String(page), size: String(size), sortBy, direction })
  if (request.status) query.set('status', request.status)
  for (const key of ['checkInFrom', 'checkInTo', 'checkOutFrom', 'checkOutTo'] as const) {
    const value = request[key]
    if (value !== undefined) {
      if (!isCalendarDate(value)) throw new RangeError('Invalid reservation date filter')
      query.set(key, value)
    }
  }
  for (const [from, to] of [
    [request.checkInFrom, request.checkInTo],
    [request.checkOutFrom, request.checkOutTo],
  ]) {
    if (from && to && from > to) throw new RangeError('Invalid reservation date range')
  }
  const response = await apiClient.request<
    Omit<ReservationPageResponse, 'content'> & { content: ReservationResult[] }
  >(`/reservations?${query}`, { signal })
  if (
    !response ||
    !Array.isArray(response.content) ||
    !['page', 'size', 'totalElements', 'totalPages'].every((key) => {
      const value = response[key as 'page' | 'size' | 'totalElements' | 'totalPages']
      return Number.isSafeInteger(value) && value >= 0
    }) ||
    response.page !== page ||
    response.size !== size ||
    response.content.length > size ||
    typeof response.first !== 'boolean' ||
    typeof response.last !== 'boolean' ||
    response.first !== (page === 0) ||
    response.last !== page + 1 >= response.totalPages
  )
    throw new ApiError('예약 목록 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  const content = response.content.map((row) => toReservationSummary(readReservationResult(row)))
  if (new Set(content.map((row) => row.reservationId)).size !== content.length)
    throw new ApiError('예약 목록에 중복 ID가 있습니다.', { kind: 'unexpected_response' })
  return { ...response, content }
}
