import { apiClient } from './client'
import { ApiError } from './errors'
import { roomAmenities, type RoomAmenity } from './accommodation'

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

export async function getAccommodationRooms(
  accommodationId: number,
  page = 0,
  signal?: AbortSignal,
): Promise<RoomPageResponse> {
  const response = await apiClient.request<RoomPageResponse>(
    `/accommodations/${accommodationId}/rooms?page=${page}&size=20&sortBy=ID&direction=ASC`,
    { signal },
  )
  if (
    !response ||
    !Array.isArray(response.content) ||
    !response.content.every(
      (room) =>
        room &&
        Number.isSafeInteger(room.roomId) &&
        room.roomId > 0 &&
        room.accommodationId === accommodationId &&
        typeof room.name === 'string' &&
        Number.isSafeInteger(room.capacity) &&
        room.capacity > 0 &&
        typeof room.nightlyPrice === 'number' &&
        Number.isFinite(room.nightlyPrice) &&
        room.nightlyPrice >= 0 &&
        (room.status === 'ACTIVE' || room.status === 'INACTIVE') &&
        Array.isArray(room.amenities) &&
        room.amenities.every((item) => roomAmenities.includes(item)),
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
