import { describe, expect, it } from 'vitest'
import { bookingContextPath, readBookingContext } from './bookingContext'

describe('public booking return context', () => {
  it('round trips only stay and catalog identity including a later result page', () => {
    const context = {
      stay: { checkInDate: '2030-01-10', checkOutDate: '2030-01-15', guestCount: 2 },
      roomId: 7,
      roomPage: 1,
    }
    const path = bookingContextPath(3, context)
    expect(readBookingContext(new URL(path, 'http://localhost').search)).toEqual(context)
  })
  it.each([
    '',
    '?checkInDate=2030-01-10&checkInDate=2030-01-11&checkOutDate=2030-01-15',
    '?checkInDate=2030-02-30&checkOutDate=2030-03-03',
    '?checkInDate=2030-01-10&checkOutDate=2030-01-10',
    '?checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=0',
  ])('rejects invalid stay input %s', (query) => {
    expect(readBookingContext(query)).toBeNull()
  })
  it('drops invalid room/page hints while preserving valid stay conditions', () => {
    expect(
      readBookingContext('?checkInDate=2030-01-10&checkOutDate=2030-01-15&roomId=-1&roomPage=NaN'),
    ).toMatchObject({ roomId: undefined, roomPage: 0 })
  })
})
