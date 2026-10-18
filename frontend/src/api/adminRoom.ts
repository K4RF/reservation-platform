import { apiClient } from './client'
import { ApiError } from './errors'
import { isRoomResponse } from './room'
import type { RoomResponse } from './room'
import type { RoomAmenity } from './accommodation'

// Accommodation is supplied by the create URL, not the body; update cannot move a room.
export interface RoomWriteRequest {
  name: string
  capacity: number
  nightlyPrice: number
  amenities: RoomAmenity[]
}
function readWriteResponse(
  response: RoomResponse | undefined,
  accommodationId: number,
  roomId: number | null,
): RoomResponse {
  if (
    !isRoomResponse(response) ||
    response.accommodationId !== accommodationId ||
    (roomId !== null && response.roomId !== roomId)
  ) {
    throw new ApiError(
      '객실 관리 응답의 ID 또는 숙소 관계가 올바르지 않습니다. 저장 결과를 확인해 주세요.',
      { kind: 'unexpected_response' },
    )
  }
  return response
}
export async function saveRoom(
  accommodationId: number,
  roomId: number | null,
  body: RoomWriteRequest,
  signal?: AbortSignal,
): Promise<RoomResponse> {
  const response = await apiClient.request<RoomResponse>(
    roomId === null ? `/accommodations/${accommodationId}/rooms` : `/rooms/${roomId}`,
    {
      method: roomId === null ? 'POST' : 'PUT',
      body,
      signal,
      retryOnUnauthorized: false,
    },
  )
  return readWriteResponse(response, accommodationId, roomId)
}
export async function changeRoomStatus(
  accommodationId: number,
  roomId: number,
  status: RoomResponse['status'],
  signal?: AbortSignal,
): Promise<RoomResponse> {
  const response = await apiClient.request<RoomResponse>(`/rooms/${roomId}/status`, {
    method: 'PATCH',
    body: { status },
    signal,
    retryOnUnauthorized: false,
  })
  const result = readWriteResponse(response, accommodationId, roomId)
  if (result.status !== status)
    throw new ApiError('객실 운영 상태 응답이 올바르지 않습니다. 저장 결과를 확인해 주세요.', {
      kind: 'unexpected_response',
    })
  return result
}
