import { roomAmenities } from '../../api/accommodation'
import type { RoomAmenity } from '../../api/accommodation'
import type { RoomSearchRequest } from '../../api/room'
import {
  readPositiveId,
  readRoomCapacity,
  readRoomPrice,
} from '../../components/admin/roomValidation'

export const roomSortFields = ['ID', 'NAME', 'CAPACITY', 'NIGHTLY_PRICE'] as const
export const adminRoomSearchFields = [
  'minCapacity',
  'minPrice',
  'maxPrice',
  'status',
  'amenities',
  'size',
  'sortBy',
  'direction',
] as const
export function adminRoomListPath(accommodationId: number) {
  return `/admin/rooms?accommodationId=${accommodationId}`
}
export function readAdminRoomQuery(
  params: URLSearchParams,
): { accommodationId: number | null; request: RoomSearchRequest } | null {
  if (
    ['accommodationId', 'page', ...adminRoomSearchFields.filter((key) => key !== 'amenities')].some(
      (key) => params.getAll(key).length > 1,
    )
  )
    return null
  const accommodationId = readPositiveId(params.get('accommodationId'))
  if (params.has('accommodationId') && accommodationId === null) return null
  const rawPage = params.get('page') ?? '0',
    rawSize = params.get('size') ?? '20'
  const capacity = params.get('minCapacity') ?? '',
    min = params.get('minPrice') ?? '',
    max = params.get('maxPrice') ?? ''
  const status = params.get('status') ?? '',
    sortBy = params.get('sortBy') ?? 'ID',
    direction = params.get('direction') ?? 'ASC'
  const amenities = params.getAll('amenities')
  if (
    !/^\d+$/.test(rawPage) ||
    Number(rawPage) > 2147483647 ||
    !/^\d+$/.test(rawSize) ||
    Number(rawSize) < 1 ||
    Number(rawSize) > 100 ||
    (capacity !== '' && readRoomCapacity(capacity) === null) ||
    (min !== '' && readRoomPrice(min, true) === null) ||
    (max !== '' && readRoomPrice(max, true) === null) ||
    (min !== '' && max !== '' && Number(min) > Number(max)) ||
    !['', 'ACTIVE', 'INACTIVE'].includes(status) ||
    !roomSortFields.includes(sortBy as (typeof roomSortFields)[number]) ||
    !['ASC', 'DESC'].includes(direction) ||
    amenities.some((value) => !roomAmenities.includes(value as RoomAmenity))
  )
    return null
  return {
    accommodationId,
    request: {
      minCapacity: capacity ? Number(capacity) : undefined,
      minPrice: min || undefined,
      maxPrice: max || undefined,
      status: (status || undefined) as RoomSearchRequest['status'],
      amenities: [...new Set(amenities)] as RoomAmenity[],
      page: Number(rawPage),
      size: Number(rawSize),
      sortBy: sortBy as RoomSearchRequest['sortBy'],
      direction: direction as RoomSearchRequest['direction'],
    },
  }
}
