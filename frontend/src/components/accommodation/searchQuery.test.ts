import { describe, expect, it } from 'vitest'
import { defaultSearchQuery, parseSearchQuery, toSearchParams } from './searchQuery'

describe('accommodation URL query', () => {
  it('restores defaults and converts every supported filter without inventing API fields', () => {
    const query = {
      ...defaultSearchQuery,
      name: '호텔 & 리조트',
      city: '서울특별시',
      region: '강남구',
      accommodationAmenities: ['PARKING', 'POOL'] as const,
      roomAmenities: ['WIFI'] as const,
      checkInDate: '2030-01-01',
      checkOutDate: '2030-01-03',
      guestCount: 2,
      minPrice: '0',
      maxPrice: '123.456',
      available: false,
      page: 3,
      size: 50,
      status: 'INACTIVE' as const,
      sortBy: 'NAME' as const,
      direction: 'DESC' as const,
    }
    const params = toSearchParams({
      ...query,
      accommodationAmenities: [...query.accommodationAmenities],
      roomAmenities: [...query.roomAmenities],
    })
    expect(parseSearchQuery(params)).toEqual({ valid: true, query })
    expect(params.getAll('accommodationAmenities')).toEqual(['PARKING', 'POOL'])
    expect(parseSearchQuery(new URLSearchParams())).toMatchObject({
      valid: true,
      query: defaultSearchQuery,
    })
  })
  it.each([
    'page=-1',
    'page=1.5',
    'page=2147483648',
    'size=0',
    'size=101',
    'size=abc',
    'guestCount=0',
    'guestCount=1e2',
    'name=a&name=b',
    'sortBy=PRICE',
    'direction=down',
    'status=UNKNOWN',
    'accommodationAmenities=UNKNOWN',
    'roomAmenities=POOL',
    'image=true',
    'minPrice=-1',
    'maxPrice=NaN',
    'minPrice=20&maxPrice=10',
    'minPrice=9007199254740993&maxPrice=9007199254740992',
    'checkInDate=2030-01-01',
    'checkInDate=2030-02-30&checkOutDate=2030-03-02',
    'checkInDate=2030-01-02&checkOutDate=2030-01-02',
    'available=true',
    'checkInDate=2030-01-01&checkOutDate=2030-01-02&available=maybe',
  ])('rejects invalid query %s', (input) => {
    expect(parseSearchQuery(new URLSearchParams(input)).valid).toBe(false)
  })
  it('deduplicates amenities and trims optional text without guessing locations', () => {
    expect(
      parseSearchQuery(
        new URLSearchParams(
          'name=%20호텔%20&city=%20&accommodationAmenities=POOL&accommodationAmenities=POOL',
        ),
      ),
    ).toMatchObject({ valid: true, query: { name: '호텔', accommodationAmenities: ['POOL'] } })
  })
  it('accepts leap day and preserves zero-price boundaries and date-only availability default', () => {
    expect(
      parseSearchQuery(
        new URLSearchParams('checkInDate=2032-02-29&checkOutDate=2032-03-01&minPrice=0&maxPrice=0'),
      ),
    ).toMatchObject({
      valid: true,
      query: { checkInDate: '2032-02-29', minPrice: '0', maxPrice: '0' },
    })
  })
})
