import { apiClient } from './client'
import { ApiError } from './errors'
import { isCalendarDate } from '../utils/calendarDate'

export type InventorySaleStatus = 'OPEN' | 'CLOSED'
export interface RoomInventoryResponse {
  inventoryId: number
  roomId: number
  inventoryDate: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
  saleStatus: InventorySaleStatus
}
export interface RoomInventoryCalendarResponse {
  roomId: number
  startDate: string
  endDate: string
  inventories: RoomInventoryResponse[]
}
export interface CreateRoomInventoryRequest {
  inventoryDate: string
  totalQuantity: number
}
export interface UpdateRoomInventoryRequest {
  totalQuantity: number
  saleStatus: InventorySaleStatus
}
function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
function validQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647
}
function validateTarget(roomId: number, date: string) {
  if (!validId(roomId) || !isCalendarDate(date)) throw new RangeError('Invalid inventory target')
}
function invalidResponse(): never {
  throw new ApiError('재고 응답을 확인할 수 없습니다. 최신 Calendar를 다시 조회해 주세요.', {
    kind: 'unexpected_response',
  })
}
function readInventory(value: unknown, roomId: number, date: string): RoomInventoryResponse {
  if (!value || typeof value !== 'object') return invalidResponse()
  const row = value as RoomInventoryResponse
  if (
    !validId(row.inventoryId) ||
    row.roomId !== roomId ||
    row.inventoryDate !== date ||
    !isCalendarDate(row.inventoryDate) ||
    !validQuantity(row.totalQuantity) ||
    !validQuantity(row.reservedQuantity) ||
    !validQuantity(row.availableQuantity) ||
    row.reservedQuantity > row.totalQuantity ||
    row.availableQuantity !== row.totalQuantity - row.reservedQuantity ||
    !['OPEN', 'CLOSED'].includes(row.saleStatus)
  )
    return invalidResponse()
  return row
}
export async function getRoomInventoryCalendar(
  roomId: number,
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<RoomInventoryCalendarResponse> {
  validateTarget(roomId, startDate)
  validateTarget(roomId, endDate)
  if (startDate > endDate) throw new RangeError('Invalid inventory period')
  const query = new URLSearchParams({ startDate, endDate })
  const response = await apiClient.request<RoomInventoryCalendarResponse>(
    `/rooms/${roomId}/inventories?${query}`,
    { signal },
  )
  if (
    !response ||
    response.roomId !== roomId ||
    response.startDate !== startDate ||
    response.endDate !== endDate ||
    !Array.isArray(response.inventories)
  )
    return invalidResponse()
  let previous = ''
  const ids = new Set<number>()
  for (const row of response.inventories) {
    if (!row || typeof row !== 'object') return invalidResponse()
    readInventory(row, roomId, row.inventoryDate)
    if (
      row.inventoryDate < startDate ||
      row.inventoryDate > endDate ||
      row.inventoryDate <= previous ||
      ids.has(row.inventoryId)
    )
      return invalidResponse()
    previous = row.inventoryDate
    ids.add(row.inventoryId)
  }
  return response
}
export async function createRoomInventory(
  roomId: number,
  body: CreateRoomInventoryRequest,
  signal?: AbortSignal,
) {
  validateTarget(roomId, body.inventoryDate)
  const response = await apiClient.request<RoomInventoryResponse>(`/rooms/${roomId}/inventories`, {
    method: 'POST',
    body: { inventoryDate: body.inventoryDate, totalQuantity: body.totalQuantity },
    signal,
    retryOnUnauthorized: false,
  })
  return readInventory(response, roomId, body.inventoryDate)
}
export async function updateRoomInventory(
  roomId: number,
  inventoryDate: string,
  body: UpdateRoomInventoryRequest,
  signal?: AbortSignal,
) {
  validateTarget(roomId, inventoryDate)
  const response = await apiClient.request<RoomInventoryResponse>(
    `/rooms/${roomId}/inventories/${inventoryDate}`,
    {
      method: 'PUT',
      body: { totalQuantity: body.totalQuantity, saleStatus: body.saleStatus },
      signal,
      retryOnUnauthorized: false,
    },
  )
  return readInventory(response, roomId, inventoryDate)
}
