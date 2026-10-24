import { afterEach, describe, expect, it } from 'vitest'
import { consumeGoogleReturn, safeLoginReturn, saveGoogleReturn } from './loginReturn'

afterEach(() => sessionStorage.clear())

describe('login return target', () => {
  it.each(['/reservations?status=CONFIRMED#result', '/admin', '/admin/rooms', '/accommodations/7'])(
    'preserves %s',
    (path) => {
      expect(safeLoginReturn(path)).toBe(path)
    },
  )
  it.each([
    undefined,
    '//evil.test/admin',
    '//evil.example/accommodations',
    '/accommodations-evil',
    'https://evil.test/admin',
    '/\\evil.test/admin',
    '/login',
    '/oauth2/callback',
    '/admin/../login',
    '/administrator',
    '/accommodations/7?from=search',
    '/accommodations/7?accessToken=secret',
    '/accommodations/7?representativeGuest.email=guest%40example.test',
    '/accommodations?guestCount=1&guestCount=2',
    '/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=1e2',
    '/accommodations/7?search=redirect%3Dhttps%253A%252F%252Fevil.test',
    '/accommodations/9007199254740992',
  ])('rejects unsafe or looping target %s', (path) => {
    expect(safeLoginReturn(path)).toBe('/')
  })
  it('stores only a return path for a full-page Google round trip and consumes it once', () => {
    saveGoogleReturn('/reservations?status=CONFIRMED#result')
    expect(consumeGoogleReturn()).toBe('/reservations?status=CONFIRMED#result')
    expect(consumeGoogleReturn()).toBe('/')
    expect(sessionStorage.length).toBe(0)
  })
  it('preserves and validates public search context across the one-shot Google return without storing auth or guests', () => {
    const query = new URLSearchParams({
      search: 'page=2&city=서울특별시&size=10&sortBy=NAME&direction=DESC',
    })
    const path = '/accommodations/7?' + query
    const safe = safeLoginReturn(path)
    const nested = new URL(safe, 'https://reservation.invalid').searchParams.get('search')!
    expect(new URLSearchParams(nested).get('page')).toBe('2')
    expect(new URLSearchParams(nested).get('city')).toBe('서울특별시')
    saveGoogleReturn(path)
    expect(sessionStorage.getItem('reservation:google-return-path')).toBe(safe)
    expect(consumeGoogleReturn()).toBe(safe)
    expect(consumeGoogleReturn()).toBe('/')
  })
})
