import { describe, expect, it } from 'vitest'
import { room } from '../../test/room'
import {
  bookingReducer,
  buildBookingRequest,
  initialBookingState,
  validateGuest,
  validateSelection,
  type BookingSelection,
} from './bookingState'

const selection: BookingSelection = {
  accommodation: { accommodationId: 7, name: '서울 호텔' },
  room,
  stay: { checkInDate: '2030-01-01', checkOutDate: '2030-01-03', guestCount: 2 },
}
const guest = { name: '홍길동', email: 'guest@example.com', phone: '+82 (10) 1234-5678' }
describe('booking state and request contract', () => {
  it('builds only actual backend fields without ownership, accommodation or price', () => {
    expect(buildBookingRequest(selection, guest)).toEqual({
      roomId: 3,
      ...selection.stay,
      representativeGuest: guest,
    })
    expect(validateGuest(guest)).toEqual({})
  })
  it.each([
    null,
    { ...selection, accommodation: undefined },
    { ...selection, room: undefined },
    { ...selection, stay: undefined },
    { ...selection, accommodation: { accommodationId: 8 } },
    { ...selection, room: { ...room, roomId: 0 } },
    { ...selection, room: { ...room, status: 'INACTIVE' } },
    { ...selection, stay: { ...selection.stay, checkInDate: '' } },
    { ...selection, stay: { ...selection.stay, checkOutDate: '2030-01-01' } },
    { ...selection, stay: { ...selection.stay, guestCount: 0 } },
    { ...selection, stay: { ...selection.stay, guestCount: 1.5 } },
    { ...selection, stay: { ...selection.stay, guestCount: 3 } },
  ])('rejects missing or inconsistent selection %j', (value) => {
    expect(validateSelection(value as BookingSelection | null)).not.toBeNull()
  })
  it('rejects blank, oversized and malformed guest fields without assuming phone digit count', () => {
    expect(Object.keys(validateGuest({ name: ' ', email: 'bad', phone: 'abc' }))).toHaveLength(3)
    expect(
      Object.keys(
        validateGuest({
          name: 'a'.repeat(101),
          email: 'a'.repeat(256) + '@b',
          phone: '1'.repeat(31),
        }),
      ),
    ).toHaveLength(3)
    expect(
      validateGuest({
        name: 'a'.repeat(100),
        email: 'a'.repeat(253) + '@b',
        phone: '1'.repeat(30),
      }),
    ).toEqual({})
    expect(() => buildBookingRequest(selection, { ...guest, phone: '' })).toThrow(RangeError)
    expect(() =>
      buildBookingRequest({ ...selection, stay: { ...selection.stay, guestCount: 3 } }, guest),
    ).toThrow(RangeError)
  })
  it('transitions input/review/edit and invalidates a review on editing without mutating the initial state', () => {
    const draft = bookingReducer(initialBookingState, {
      type: 'change',
      field: 'name',
      value: guest.name,
    })
    expect(draft.guest.name).toBe(guest.name)
    expect(initialBookingState.guest.name).toBe('')
    const review = bookingReducer(draft, {
      type: 'review',
      request: buildBookingRequest(selection, guest),
    })
    expect(review.step).toBe('review')
    expect(bookingReducer(review, { type: 'edit' })).toEqual({ step: 'input', guest })
    expect(bookingReducer(review, { type: 'change', field: 'phone', value: '010' })).toEqual({
      step: 'input',
      guest: { ...guest, phone: '010' },
    })
  })
})
