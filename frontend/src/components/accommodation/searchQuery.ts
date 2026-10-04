import {
  accommodationAmenities,
  roomAmenities,
  type AccommodationSearchRequest,
} from '../../api/accommodation'

export type AccommodationSearchQuery = AccommodationSearchRequest & {
  page: number
  size: number
  sortBy: 'ID' | 'NAME'
  direction: 'ASC' | 'DESC'
}
export type SearchQueryResult =
  { valid: true; query: AccommodationSearchQuery } | { valid: false; message: string }

export const defaultSearchQuery: AccommodationSearchQuery = {
  status: 'ACTIVE',
  page: 0,
  size: 20,
  sortBy: 'ID',
  direction: 'ASC',
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Compare decimal strings without rounding BigDecimal filter boundaries through Number.
function decimalGreater(left: string, right: string) {
  const [li, lf = ''] = left.split('.')
  const [ri, rf = ''] = right.split('.')
  const scale = Math.max(lf.length, rf.length)
  return BigInt(li + lf.padEnd(scale, '0')) > BigInt(ri + rf.padEnd(scale, '0'))
}

export function parseSearchQuery(params: URLSearchParams): SearchQueryResult {
  const query = { ...defaultSearchQuery }
  const allowed = [
    'name',
    'city',
    'region',
    'accommodationAmenities',
    'roomAmenities',
    'checkInDate',
    'checkOutDate',
    'guestCount',
    'minPrice',
    'maxPrice',
    'status',
    'available',
    'page',
    'size',
    'sortBy',
    'direction',
  ]
  const invalid = (message: string): SearchQueryResult => ({ valid: false, message })
  for (const key of params.keys()) {
    if (!allowed.includes(key))
      return invalid('지원하지 않는 검색 조건이 있습니다. 조건을 다시 입력하세요.')
    if (!key.endsWith('Amenities') && params.getAll(key).length > 1)
      return invalid('중복된 검색 조건이 있습니다. 조건을 다시 입력하세요.')
  }
  for (const key of ['name', 'city', 'region'] as const) {
    const value = params.get(key)?.trim()
    if (value && value.length > 100) return invalid('숙소명·도시·지역은 100자 이하여야 합니다.')
    if (value) query[key] = value
  }
  for (const key of ['page', 'size', 'guestCount'] as const) {
    if (!params.has(key)) continue
    const value = params.get(key) ?? ''
    const number = Number(value)
    const min = key === 'page' ? 0 : 1
    const max = key === 'size' ? 100 : 2147483647
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max)
      return invalid('페이지는 0 이상, 크기는 1~100, 인원은 양의 정수여야 합니다.')
    query[key] = number
  }
  for (const key of ['minPrice', 'maxPrice'] as const) {
    if (!params.has(key)) continue
    const value = params.get(key) ?? ''
    if (value.length > 100 || !/^\d+(\.\d+)?$/.test(value))
      return invalid('가격은 0 이상의 숫자로 입력하세요.')
    query[key] = value
  }
  if (query.minPrice && query.maxPrice && decimalGreater(query.minPrice, query.maxPrice))
    return invalid('최대 가격은 최소 가격 이상이어야 합니다.')
  const checkIn = params.get('checkInDate')
  const checkOut = params.get('checkOutDate')
  if (params.has('checkInDate') || params.has('checkOutDate')) {
    if (!checkIn || !checkOut || !validDate(checkIn) || !validDate(checkOut) || checkIn >= checkOut)
      return invalid('체크인과 체크아웃을 함께 입력하고 체크아웃을 더 늦은 날짜로 선택하세요.')
    query.checkInDate = checkIn
    query.checkOutDate = checkOut
  }
  if (params.has('available')) {
    const value = params.get('available')
    if (!checkIn || (value !== 'true' && value !== 'false'))
      return invalid('예약 가능 여부는 올바른 숙박 기간과 함께 선택하세요.')
    query.available = value === 'true'
  }
  if (params.has('status')) {
    const value = params.get('status')
    if (value !== 'ACTIVE' && value !== 'INACTIVE') return invalid('운영 상태가 올바르지 않습니다.')
    query.status = value
  }
  if (params.has('sortBy')) {
    const value = params.get('sortBy')
    if (value !== 'ID' && value !== 'NAME') return invalid('지원하지 않는 정렬 기준입니다.')
    query.sortBy = value
  }
  if (params.has('direction')) {
    const value = params.get('direction')
    if (value !== 'ASC' && value !== 'DESC') return invalid('정렬 방향이 올바르지 않습니다.')
    query.direction = value
  }
  const accommodation = params.getAll('accommodationAmenities')
  const room = params.getAll('roomAmenities')
  if (
    accommodation.some((value) => !accommodationAmenities.some((item) => item === value)) ||
    room.some((value) => !roomAmenities.some((item) => item === value))
  )
    return invalid('지원하지 않는 편의시설입니다.')
  query.accommodationAmenities = accommodationAmenities.filter((item) =>
    accommodation.includes(item),
  )
  query.roomAmenities = roomAmenities.filter((item) => room.includes(item))
  return { valid: true, query }
}

export function toSearchParams(query: AccommodationSearchRequest): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
    else params.set(key, String(value))
  }
  return params
}
