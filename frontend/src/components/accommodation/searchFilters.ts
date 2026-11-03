import { amenityLabels } from './accommodationView'
import type { AccommodationSearchQuery } from './searchQuery'

export function filterValues(query: AccommodationSearchQuery) {
  const {
    name,
    region,
    minPrice,
    maxPrice,
    available,
    accommodationAmenities,
    roomAmenities,
    size,
    status,
  } = query
  return {
    name,
    region,
    minPrice,
    maxPrice,
    available,
    accommodationAmenities,
    roomAmenities,
    size,
    status,
  }
}
export function resetFilters(query: AccommodationSearchQuery): AccommodationSearchQuery {
  return {
    ...query,
    name: undefined,
    region: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    available: undefined,
    accommodationAmenities: [],
    roomAmenities: [],
  }
}
export function filterLabels(query: AccommodationSearchQuery) {
  return [
    query.name && `숙소명 ${query.name}`,
    query.region && `지역 ${query.region}`,
    query.minPrice !== undefined && `기본 1박 ${query.minPrice} 이상`,
    query.maxPrice !== undefined && `기본 1박 ${query.maxPrice} 이하`,
    query.available !== undefined && (query.available ? '기간 내 예약 가능' : '기간 내 예약 불가'),
    ...(query.accommodationAmenities ?? []).map((key) => amenityLabels[key]),
    ...(query.roomAmenities ?? []).map((key) => (key === 'WIFI' ? '와이파이' : '에어컨')),
  ].filter(Boolean) as string[]
}
export function searchContextLabel(query: AccommodationSearchQuery) {
  return [
    query.city || '전체 지역',
    query.checkInDate ? `${query.checkInDate} → ${query.checkOutDate}` : '날짜 미지정',
    query.guestCount === undefined ? '인원 조건 없음' : `총 ${query.guestCount}명`,
  ].join(' · ')
}
