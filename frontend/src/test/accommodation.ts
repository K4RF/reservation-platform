import type { AccommodationPageResponse, AccommodationResponse } from '../api/accommodation'

export const accommodation: AccommodationResponse = {
  accommodationId: 7,
  name: '서울 호텔',
  description: '편안한 숙소',
  country: '대한민국',
  city: '서울특별시',
  region: '강남구',
  address: '테헤란로 1',
  amenities: ['PARKING', 'POOL'],
  checkInTime: '15:00:00',
  checkOutTime: '11:00:00',
  timeZone: 'Asia/Seoul',
  status: 'ACTIVE',
}

export function accommodationPage(
  overrides: Partial<AccommodationPageResponse> = {},
): AccommodationPageResponse {
  return {
    content: [accommodation],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  }
}
