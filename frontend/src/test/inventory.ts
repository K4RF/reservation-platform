import type { RoomInventoryCalendarResponse, RoomInventoryResponse } from '../api/adminInventory'

export const inventory: RoomInventoryResponse = {
  inventoryId: 19,
  roomId: 3,
  inventoryDate: '2030-07-20',
  totalQuantity: 5,
  reservedQuantity: 2,
  availableQuantity: 3,
  saleStatus: 'OPEN',
}
export const inventoryCalendar: RoomInventoryCalendarResponse = {
  roomId: 3,
  startDate: '2030-07-20',
  endDate: '2030-07-22',
  inventories: [
    inventory,
    {
      ...inventory,
      inventoryId: 20,
      inventoryDate: '2030-07-22',
      saleStatus: 'CLOSED',
    },
  ],
}
