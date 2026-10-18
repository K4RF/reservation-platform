import type { RoomDailyPriceResponse } from '../api/bookingPrice'
import { room } from './room'

export const defaultPrice: RoomDailyPriceResponse = {
  roomDailyPriceId: null,
  roomId: room.roomId,
  stayDate: '2030-07-20',
  nightlyPrice: room.nightlyPrice,
  source: 'DEFAULT',
}
export const dailyPrice: RoomDailyPriceResponse = {
  ...defaultPrice,
  roomDailyPriceId: 9,
  nightlyPrice: 180000.5,
  source: 'DAILY',
}
