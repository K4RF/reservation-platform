import type { BookingRequest, RepresentativeGuestRequest } from '../../api/booking'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import { validateAvailability } from '../../api/availabilityValidation'
import type { RoomResponse } from '../../api/room'

export interface BookingSelection {
  accommodation: { accommodationId: number; name?: string }
  room: RoomResponse
  stay: AvailabilityRequest
}
export type GuestErrors = Partial<Record<keyof RepresentativeGuestRequest, string>>
export type BookingState =
  | { step: 'input'; guest: RepresentativeGuestRequest }
  | { step: 'review'; guest: RepresentativeGuestRequest; request: BookingRequest }
export type BookingAction =
  | { type: 'change'; field: keyof RepresentativeGuestRequest; value: string }
  | { type: 'review'; request: BookingRequest }
  | { type: 'edit' }
export const initialBookingState: BookingState = {
  step: 'input',
  guest: { name: '', email: '', phone: '' },
}
export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  if (action.type === 'change')
    return { step: 'input', guest: { ...state.guest, [action.field]: action.value } }
  if (action.type === 'edit') return { step: 'input', guest: state.guest }
  return { step: 'review', guest: action.request.representativeGuest, request: action.request }
}

export function validateSelection(selection: BookingSelection | null): string | null {
  if (!selection?.accommodation || !selection.room || !selection.stay)
    return '숙소·객실·날짜를 먼저 선택하세요.'
  const { accommodation, room, stay } = selection
  if (
    !Number.isSafeInteger(accommodation.accommodationId) ||
    accommodation.accommodationId < 1 ||
    !Number.isSafeInteger(room.roomId) ||
    room.roomId < 1 ||
    room.accommodationId !== accommodation.accommodationId
  )
    return '숙소와 객실 선택을 다시 확인하세요.'
  const dateError = validateAvailability(stay)
  if (dateError) return dateError
  if (!Number.isSafeInteger(room.capacity) || room.capacity < stay.guestCount)
    return '선택 객실의 최대 인원 이하로 다시 조회하세요.'
  if (room.status !== 'ACTIVE') return '운영 중인 객실을 다시 선택하세요.'
  return null
}

export function validateGuest(guest: RepresentativeGuestRequest): GuestErrors {
  const errors: GuestErrors = {}
  if (!guest.name.trim() || guest.name.length > 100)
    errors.name = '이름은 필수이며 100자 이하여야 합니다.'
  if (!guest.email.trim() || guest.email.length > 255 || !/^[^\s@]+@[^\s@]+$/.test(guest.email))
    errors.email = '255자 이하의 올바른 이메일을 입력하세요.'
  if (!guest.phone.trim() || guest.phone.length > 30 || !/^[0-9+() .-]+$/.test(guest.phone))
    errors.phone =
      '연락처는 필수이며 30자 이하의 숫자, +, 괄호, 공백, 점, 하이픈만 사용할 수 있습니다.'
  return errors
}

export function buildBookingRequest(
  selection: BookingSelection,
  guest: RepresentativeGuestRequest,
): BookingRequest {
  if (validateSelection(selection) || Object.keys(validateGuest(guest)).length)
    throw new RangeError('Invalid booking input')
  return {
    roomId: selection.room.roomId,
    guestCount: selection.stay.guestCount,
    checkInDate: selection.stay.checkInDate,
    checkOutDate: selection.stay.checkOutDate,
    representativeGuest: { ...guest },
  }
}
