import { apiClient } from './client'
import { ApiError } from './errors'
import { roomAmenities, type RoomAmenity } from './accommodation'
import { validateAvailability, type AvailabilityRequest } from './availabilityValidation'

export interface RoomResponse {
  roomId: number
  accommodationId: number
  name: string
  capacity: number
  nightlyPrice: number
  amenities: RoomAmenity[]
  status: 'ACTIVE' | 'INACTIVE'
}
export interface RoomPageResponse {
  content: RoomResponse[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface RoomSearchRequest {
  minCapacity?: number
  minPrice?: string
  maxPrice?: string
  status?: RoomResponse['status']
  amenities?: RoomAmenity[]
  page?: number
  size?: number
  sortBy?: 'ID' | 'NAME' | 'CAPACITY' | 'NIGHTLY_PRICE'
  direction?: 'ASC' | 'DESC'
}

export function isRoomResponse(room: RoomResponse | undefined): room is RoomResponse {
  return (
    !!room &&
    Number.isSafeInteger(room.roomId) &&
    room.roomId > 0 &&
    Number.isSafeInteger(room.accommodationId) &&
    room.accommodationId > 0 &&
    typeof room.name === 'string' &&
    Number.isSafeInteger(room.capacity) &&
    room.capacity > 0 &&
    typeof room.nightlyPrice === 'number' &&
    Number.isFinite(room.nightlyPrice) &&
    room.nightlyPrice >= 0 &&
    (room.status === 'ACTIVE' || room.status === 'INACTIVE') &&
    Array.isArray(room.amenities) &&
    room.amenities.every((item) => roomAmenities.includes(item))
  )
}

export async function getRoom(id: number, signal?: AbortSignal): Promise<RoomResponse> {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid room ID')
  const response = await apiClient.request<RoomResponse>(`/rooms/${id}`, {
    signal,
    includeAuth: false,
  })
  if (!isRoomResponse(response) || response.roomId !== id)
    throw new ApiError('객실 상세 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  return response
}

export async function getAccommodationRooms(
  accommodationId: number,
  page = 0,
  signal?: AbortSignal,
): Promise<RoomPageResponse> {
  return searchAccommodationRooms(
    accommodationId,
    { page, size: 20, sortBy: 'ID', direction: 'ASC' },
    signal,
  )
}

// Same public endpoint, without imposing exploration/availability filters on Admin callers.
export async function searchAccommodationRooms(
  accommodationId: number,
  request: RoomSearchRequest = {},
  signal?: AbortSignal,
): Promise<RoomPageResponse> {
  if (!Number.isSafeInteger(accommodationId) || accommodationId < 1)
    throw new RangeError('Invalid accommodation ID')
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(request)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else query.set(key, String(value))
  }
  const response = await apiClient.request<RoomPageResponse>(
    `/accommodations/${accommodationId}/rooms${query.size ? `?${query}` : ''}`,
    { signal, includeAuth: false },
  )
  return readRoomPage(response, accommodationId, request.page ?? 0)
}

function readRoomPage(
  response: RoomPageResponse | undefined,
  accommodationId: number,
  page: number,
): RoomPageResponse {
  if (
    !response ||
    !Array.isArray(response.content) ||
    !response.content.every(
      (room) => isRoomResponse(room) && room.accommodationId === accommodationId,
    ) ||
    !['page', 'size', 'totalElements', 'totalPages'].every((key) => {
      const value = response[key as 'page' | 'size' | 'totalElements' | 'totalPages']
      return Number.isSafeInteger(value) && value >= 0
    }) ||
    response.page !== page ||
    response.size < 1 ||
    response.size > 100 ||
    typeof response.first !== 'boolean' ||
    typeof response.last !== 'boolean'
  ) {
    throw new ApiError('객실 목록 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response
}

export async function getAvailableRooms(
  accommodationId: number,
  request: AvailabilityRequest,
  page = 0,
  signal?: AbortSignal,
): Promise<RoomPageResponse> {
  const error = validateAvailability(request)
  if (error) throw new RangeError(error)
  const query = new URLSearchParams({
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
    guestCount: String(request.guestCount),
    page: String(page),
    size: '20',
  })
  const response = await apiClient.request<RoomPageResponse>(
    `/accommodations/${accommodationId}/rooms/available?${query}`,
    { signal, includeAuth: false },
  )
  const result = readRoomPage(response, accommodationId, page)
  if (result.content.some((room) => room.status !== 'ACTIVE' || room.capacity < request.guestCount))
    throw new ApiError('객실 가용성 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  return result
}
