import type {
  AccommodationWriteRequest,
  BookingPolicyRequest,
  CancellationPolicyRequest,
} from '../api/adminAccommodation'

export const accommodationWrite: AccommodationWriteRequest = {
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
}
export const bookingPolicy: BookingPolicyRequest = {
  minStayNights: 1,
  maxStayNights: 14,
  minAdvanceBookingDays: 0,
  maxAdvanceBookingDays: 365,
}
export const cancellationPolicy: CancellationPolicyRequest = {
  freeCancellationDaysBeforeCheckIn: 7,
  cancellationDeadlineDaysBeforeCheckIn: 1,
  feeRules: [
    { minDaysBeforeCheckIn: 3, feeRatePercent: 30 },
    { minDaysBeforeCheckIn: 1, feeRatePercent: 50 },
  ],
}
