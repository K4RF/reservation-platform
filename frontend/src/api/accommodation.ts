import { apiClient } from './client'
import { ApiError } from './errors'

export const accommodationAmenities = [
  'PARKING',
  'BREAKFAST',
  'POOL',
  'GYM',
  'PET_FRIENDLY',
] as const
export const roomAmenities = ['WIFI', 'AIR_CONDITIONER'] as const
export type AccommodationAmenity = (typeof accommodationAmenities)[number]
export type RoomAmenity = (typeof roomAmenities)[number]
export type AccommodationStatus = 'ACTIVE' | 'INACTIVE'

// Mirrors AccommodationSearchRequest; prices filter base nightly prices, not stay totals.
export interface AccommodationSearchRequest {
  name?: string
  city?: string
  region?: string
  accommodationAmenities?: AccommodationAmenity[]
  roomAmenities?: RoomAmenity[]
  checkInDate?: string
  checkOutDate?: string
  guestCount?: number
  minPrice?: string
  maxPrice?: string
  status?: AccommodationStatus
  available?: boolean
  page?: number
  size?: number
  sortBy?: 'ID' | 'NAME'
  direction?: 'ASC' | 'DESC'
}

export interface AccommodationResponse {
  accommodationId: number
  name: string
  description: string
  country: string | null
  city: string | null
  region: string | null
  address: string
  amenities: AccommodationAmenity[]
  checkInTime: string | null
  checkOutTime: string | null
  timeZone: string
  status: AccommodationStatus
}

export interface AccommodationPageResponse {
  content: AccommodationResponse[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

function isAccommodation(value: unknown): value is AccommodationResponse {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    Number.isSafeInteger(row.accommodationId) &&
    (row.accommodationId as number) > 0 &&
    ['name', 'description', 'address', 'timeZone'].every((key) => typeof row[key] === 'string') &&
    ['country', 'city', 'region', 'checkInTime', 'checkOutTime'].every(
      (key) => row[key] === null || typeof row[key] === 'string',
    ) &&
    (row.status === 'ACTIVE' || row.status === 'INACTIVE') &&
    Array.isArray(row.amenities) &&
    row.amenities.every((amenity) => accommodationAmenities.includes(amenity))
  )
}

export async function searchAccommodations(
  request: AccommodationSearchRequest = {},
  signal?: AbortSignal,
): Promise<AccommodationPageResponse> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(request)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else query.set(key, String(value))
  }
  const response = await apiClient.request<AccommodationPageResponse>(
    '/accommodations' + (query.size ? `?${query}` : ''),
    { signal, includeAuth: false },
  )
  if (
    !response ||
    !Array.isArray(response.content) ||
    !response.content.every(isAccommodation) ||
    !['page', 'size', 'totalElements', 'totalPages'].every((key) => {
      const value = response[key as 'page' | 'size' | 'totalElements' | 'totalPages']
      return Number.isSafeInteger(value) && value >= 0
    }) ||
    response.size < 1 ||
    response.size > 100 ||
    typeof response.first !== 'boolean' ||
    typeof response.last !== 'boolean'
  ) {
    throw new ApiError('숙소 검색 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response
}

export async function getAccommodation(
  id: number,
  signal?: AbortSignal,
): Promise<AccommodationResponse> {
  const response = await apiClient.request<AccommodationResponse>(`/accommodations/${id}`, {
    signal,
    includeAuth: false,
  })
  if (!isAccommodation(response) || response.accommodationId !== id) {
    throw new ApiError('숙소 상세 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response
}
