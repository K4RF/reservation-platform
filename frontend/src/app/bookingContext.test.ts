import { describe, expect, it } from 'vitest'
import {
  bookingContextPath,
  readBookingContext,
  explorationDetailPath,
  searchReturnPath,
} from './bookingContext'
import { canonicalSearchQuery } from '../components/accommodation/searchQuery'

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
    '?checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=1e2',
    '?checkInDate=2030-01-10&checkOutDate=2030-01-15&roomId=1&roomId=2',
    '?checkInDate=2030-01-10&checkOutDate=2030-01-15&roomPage=0&roomPage=1',
    '?checkInDate=2030-01-10&checkOutDate=2030-01-15&token=secret',
  ])('rejects invalid stay input %s', (query) => {
    expect(readBookingContext(query)).toBeNull()
  })
  it('drops invalid room/page hints while preserving valid stay conditions', () => {
    expect(
      readBookingContext('?checkInDate=2030-01-10&checkOutDate=2030-01-15&roomId=-1&roomPage=NaN'),
    ).toMatchObject({ roomId: undefined, roomPage: 0 })
  })
  it('round trips original search filters/page independently of changed booking stay and room page', () => {
    const search =
      'name=호텔&city=서울특별시&region=강남구&page=2&size=10&sortBy=NAME&direction=DESC&accommodationAmenities=POOL&roomAmenities=WIFI&minPrice=0&maxPrice=123.456&checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=2'
    const detail = new URL(explorationDetailPath(7, search), 'http://localhost')
    const context = readBookingContext(detail.search)!
    expect(context.stay.guestCount).toBe(2)
    expect(context.searchQuery).toBe(canonicalSearchQuery(search))
    const login = new URL(
      bookingContextPath(7, {
        ...context,
        stay: { ...context.stay, guestCount: 3 },
        roomId: 4,
        roomPage: 1,
      }),
      'http://localhost',
    )
    expect(readBookingContext(login.search)).toMatchObject({
      stay: { guestCount: 3 },
      roomId: 4,
      roomPage: 1,
    })
    expect(searchReturnPath(login.search)).toBe('/accommodations?' + canonicalSearchQuery(search))
  })
  it('preserves undated search context without inventing booking dates or guests', () => {
    const detail = new URL(explorationDetailPath(7, 'city=서울특별시&page=1'), 'http://localhost')
    expect(detail.searchParams.has('guestCount')).toBe(false)
    expect(readBookingContext(detail.search)).toBeNull()
    expect(searchReturnPath(detail.search)).toBe(
      '/accommodations?' + canonicalSearchQuery('city=서울특별시&page=1'),
    )
    expect(searchReturnPath('')).toBe('/accommodations')
  })
  it.each([
    'page=-1',
    'page=1&page=2',
    'token=secret',
    'representativeGuest.name=name',
    'search=page%3D2',
    'https://evil.test',
  ])('rejects invalid nested search %s without a recursive/external return', (saved) => {
    const query = '?' + new URLSearchParams({ search: saved })
    expect(searchReturnPath(query)).toBe('/accommodations')
    expect(readBookingContext(query)).toBeNull()
  })
  it('rejects duplicate nested context even when both values are individually valid', () => {
    expect(searchReturnPath('?search=page%3D1&search=page%3D2')).toBe('/accommodations')
  })
})
