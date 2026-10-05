import type { RoomPageResponse, RoomResponse } from '../api/room'

export const room: RoomResponse = {
  roomId: 3,
  accommodationId: 7,
  name: '스탠다드',
  capacity: 2,
  nightlyPrice: 123456.78,
  amenities: ['WIFI', 'AIR_CONDITIONER'],
  status: 'ACTIVE',
}
export function roomPage(overrides: Partial<RoomPageResponse> = {}): RoomPageResponse {
  return {
    content: [room],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  }
}
