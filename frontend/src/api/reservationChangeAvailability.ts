import { ApiError } from './errors'
import { getAvailableRooms } from './room'
import { validateAvailability, type AvailabilityRequest } from './availabilityValidation'

export type GeneralRoomListing = 'listed' | 'not_listed'

// General new-booking lookup only. Absence is NOT a reservation-change rejection.
// The existing owner's occupancy is not excluded by this endpoint.
export async function getReservationChangeAvailability(
  accommodationId: number,
  roomId: number,
  request: AvailabilityRequest,
  signal?: AbortSignal,
): Promise<GeneralRoomListing> {
  if ([accommodationId, roomId].some((id) => !Number.isSafeInteger(id) || id < 1))
    throw new RangeError('Invalid accommodation or room ID')
  const error = validateAvailability(request)
  if (error) throw new RangeError(error)
  for (let page = 0; ; page++) {
    signal?.throwIfAborted()
    const result = await getAvailableRooms(accommodationId, request, page, signal)
    signal?.throwIfAborted()
    if (result.content.some((room) => room.roomId === roomId)) return 'listed'
    if (result.last) return 'not_listed'
    if (page + 1 >= result.totalPages)
      throw new ApiError('가용 객실 페이지 응답이 올바르지 않습니다.', {
        kind: 'unexpected_response',
      })
  }
}
