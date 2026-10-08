import type { ReservationResult } from '../api/reservation'
import type { BookingRequest } from '../api/booking'

export const bookingRequest: BookingRequest = {
  roomId: 3,
  guestCount: 2,
  checkInDate: '2030-01-01',
  checkOutDate: '2030-01-03',
  representativeGuest: { name: '홍길동', email: 'guest@example.com', phone: '010-1234-5678' },
}
export const reservationResult: ReservationResult = {
  ...bookingRequest,
  reservationId: 42,
  reservationNumber: 'RSV-20300101-A1B2C3D4E5F60708',
  stayNights: 2,
  totalAmount: 350.25,
  status: 'CONFIRMED',
}
