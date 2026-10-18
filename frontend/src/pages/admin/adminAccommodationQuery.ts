import type { AccommodationSearchRequest } from '../../api/accommodation'

export const adminAccommodationSearchFields = [
  'name',
  'city',
  'region',
  'status',
  'page',
  'size',
  'sortBy',
  'direction',
] as const
export function readAdminAccommodationQuery(
  params: URLSearchParams,
): AccommodationSearchRequest | null {
  if (adminAccommodationSearchFields.some((key) => params.getAll(key).length > 1)) return null
  const name = params.get('name') ?? '',
    city = params.get('city') ?? '',
    region = params.get('region') ?? ''
  const status = params.get('status') ?? '',
    sortBy = params.get('sortBy') ?? 'ID',
    direction = params.get('direction') ?? 'ASC'
  const page = params.get('page') ?? '0',
    size = params.get('size') ?? '20'
  if (
    [name, city, region].some((value) => value.length > 100) ||
    !['', 'ACTIVE', 'INACTIVE'].includes(status) ||
    !['ID', 'NAME'].includes(sortBy) ||
    !['ASC', 'DESC'].includes(direction) ||
    !/^\d+$/.test(page) ||
    !/^\d+$/.test(size) ||
    !Number.isSafeInteger(Number(page)) ||
    Number(page) > 2147483647 ||
    Number(size) < 1 ||
    Number(size) > 100
  )
    return null
  // Deliberately no ACTIVE, available, stay-date or active-room filters from public exploration.
  return {
    name,
    city,
    region,
    status: (status || undefined) as AccommodationSearchRequest['status'],
    page: Number(page),
    size: Number(size),
    sortBy: sortBy as 'ID' | 'NAME',
    direction: direction as 'ASC' | 'DESC',
  }
}
