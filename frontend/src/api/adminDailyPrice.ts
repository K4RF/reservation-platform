import { apiClient } from './client'
import { ApiError } from './errors'
import { readRoomDailyPrice } from './bookingPrice'
import type { RoomDailyPriceResponse } from './bookingPrice'
import { isCalendarDate } from '../utils/calendarDate'

export interface CreateRoomDailyPriceRequest {
  stayDate: string
  nightlyPrice: number
}
export interface UpdateRoomDailyPriceRequest {
  nightlyPrice: number
}

function validateTarget(roomId: number, stayDate: string) {
  if (!Number.isSafeInteger(roomId) || roomId < 1 || !isCalendarDate(stayDate))
    throw new RangeError('Invalid room ID or stay date')
}
function readSavedPrice(
  response: RoomDailyPriceResponse | undefined,
  roomId: number,
  stayDate: string,
): RoomDailyPriceResponse {
  const result = readRoomDailyPrice(response, roomId, stayDate)
  if (result.source !== 'DAILY')
    throw new ApiError('저장 응답이 날짜별 가격이 아닙니다. 저장 결과를 다시 조회해 주세요.', {
      kind: 'unexpected_response',
    })
  return result
}
export async function createRoomDailyPrice(
  roomId: number,
  body: CreateRoomDailyPriceRequest,
  signal?: AbortSignal,
): Promise<RoomDailyPriceResponse> {
  validateTarget(roomId, body.stayDate)
  const response = await apiClient.request<RoomDailyPriceResponse>(`/rooms/${roomId}/prices`, {
    method: 'POST',
    body,
    signal,
    retryOnUnauthorized: false,
  })
  return readSavedPrice(response, roomId, body.stayDate)
}
export async function updateRoomDailyPrice(
  roomId: number,
  stayDate: string,
  body: UpdateRoomDailyPriceRequest,
  signal?: AbortSignal,
): Promise<RoomDailyPriceResponse> {
  validateTarget(roomId, stayDate)
  const response = await apiClient.request<RoomDailyPriceResponse>(
    `/rooms/${roomId}/prices/${stayDate}`,
    {
      method: 'PUT',
      body,
      signal,
      retryOnUnauthorized: false,
    },
  )
  return readSavedPrice(response, roomId, stayDate)
}
