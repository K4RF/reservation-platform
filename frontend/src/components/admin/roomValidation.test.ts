import { describe, expect, it } from 'vitest'
import { readPositiveId, readRoomCapacity, readRoomPrice } from './roomValidation'
import { readAdminRoomQuery } from '../../pages/admin/adminRoomQuery'

describe('Room Admin input boundaries', () => {
  it('accepts total guest capacity within Integer range, not fractions or guessed defaults', () => {
    expect(readRoomCapacity('1')).toBe(1)
    expect(readRoomCapacity('2147483647')).toBe(2147483647)
    for (const value of ['', '0', '-1', '1.5', '2147483648', 'NaN'])
      expect(readRoomCapacity(value)).toBeNull()
    expect(readPositiveId('9007199254740992')).toBeNull()
  })
  it('validates the storage monetary range without rounding and allows zero only for search', () => {
    expect(readRoomPrice('0.01')).toBe(0.01)
    expect(readRoomPrice('9999999999.99')).toBe(9999999999.99)
    for (const value of ['', '0', '0.00', '-1', '1e3', '0.001', '10000000000', 'Infinity'])
      expect(readRoomPrice(value)).toBeNull()
    expect(readRoomPrice('0', true)).toBe(0)
  })
  it.each([
    'accommodationId=0',
    'accommodationId=7&accommodationId=8',
    'minCapacity=0',
    'minCapacity=1.5',
    'minPrice=-1',
    'minPrice=20&maxPrice=10',
    'page=-1',
    'page=2147483648',
    'size=101',
    'size=0',
    'sortBy=PRICE',
    'direction=OTHER',
    'status=OTHER',
    'amenities=POOL',
    'status=ACTIVE&status=INACTIVE',
  ])('rejects invalid query %s', (query) => {
    expect(readAdminRoomQuery(new URLSearchParams(query))).toBeNull()
  })
  it('preserves the documented sort and AND amenities, ignoring public stay filters', () => {
    for (const sortBy of ['ID', 'NAME', 'CAPACITY', 'NIGHTLY_PRICE']) {
      const result = readAdminRoomQuery(
        new URLSearchParams(
          `accommodationId=7&sortBy=${sortBy}&amenities=WIFI&amenities=AIR_CONDITIONER&checkInDate=2030-01-01&available=true`,
        ),
      )!
      expect(result.accommodationId).toBe(7)
      expect(result.request).toMatchObject({
        sortBy,
        page: 0,
        size: 20,
        amenities: ['WIFI', 'AIR_CONDITIONER'],
      })
      expect(result.request).not.toHaveProperty('available')
      expect(result.request.status).toBeUndefined()
    }
  })
})
