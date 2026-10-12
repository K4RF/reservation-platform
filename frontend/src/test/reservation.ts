import type { ReservationResult } from '../api/reservation'
import type { BookingRequest } from '../api/booking'
import type { ReservationPageResponse } from '../api/reservationList'
import type { ReservationDetail } from '../api/reservationDetail'
import type { ReservationCancellationResponse } from '../api/reservationCancellation'

export const cancellationResponse: ReservationCancellationResponse = {
  reservationId: 42,
  status: 'CANCELLED',
  cancelledAt: '2029-12-30T00:00:00.123456789Z',
  cancellationDate: '2029-12-30',
  daysBeforeCheckIn: 2,
  totalAmount: 350.25,
  cancellationFeeRate: 50,
  cancellationFeeAmount: 175.13,
  estimatedRefundAmount: 175.12,
}

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

export const reservationDetail: ReservationDetail = {
  ...reservationResult,
  nightlyPriceSnapshot: 100.1,
  nights: [
    { stayDate: '2030-01-01', priceSnapshot: 100.1 },
    { stayDate: '2030-01-02', priceSnapshot: 250.15 },
  ],
  cancellationPolicySnapshot: {
    freeCancellationDaysBeforeCheckIn: 7,
    cancellationDeadlineDaysBeforeCheckIn: 1,
    feeRules: [
      { minDaysBeforeCheckIn: 3, feeRatePercent: 30 },
      { minDaysBeforeCheckIn: 1, feeRatePercent: 50 },
    ],
  },
  cancelledAt: null,
  cancellationFeeAmount: null,
  refundAmount: null,
}

export const changedReservationDetail: ReservationDetail = {
  ...reservationDetail,
  checkInDate: '2030-01-02',
  checkOutDate: '2030-01-04',
  nightlyPriceSnapshot: 250.15,
  totalAmount: 550.15,
  nights: [
    { stayDate: '2030-01-02', priceSnapshot: 250.15 },
    { stayDate: '2030-01-03', priceSnapshot: 300 },
  ],
}

export const cancelledReservationDetail: ReservationDetail = {
  ...reservationDetail,
  status: cancellationResponse.status,
  cancelledAt: cancellationResponse.cancelledAt,
  cancellationFeeAmount: cancellationResponse.cancellationFeeAmount,
  refundAmount: cancellationResponse.estimatedRefundAmount,
}

// Real list endpoint returns the same ReservationResponse as owner detail.
export function reservationPage(
  overrides: Partial<Omit<ReservationPageResponse, 'content'>> & {
    content?: ReservationResult[]
  } = {},
) {
  return {
    content: [reservationResult],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  }
}
