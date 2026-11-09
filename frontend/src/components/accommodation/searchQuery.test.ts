import { describe, expect, it } from 'vitest'
import {
  defaultSearchQuery,
  parseSearchQuery,
  toSearchParams,
  canonicalSearchQuery,
} from './searchQuery'

describe('accommodation URL query', () => {
  it('canonicalizes key order, defaults, integer spelling, text and amenity sets idempotently without rounding prices', () => {
    const first = canonicalSearchQuery(
      'page=02&city=%20서울특별시%20&roomAmenities=WIFI&roomAmenities=WIFI&maxPrice=123.456',
    )!
    const second = canonicalSearchQuery(
      'maxPrice=123.456&city=서울특별시&page=2&roomAmenities=WIFI',
    )
    expect(first).toBe(second)
    expect(canonicalSearchQuery(first)).toBe(first)
    expect(new URLSearchParams(first).get('maxPrice')).toBe('123.456')
    expect(new URLSearchParams(first).get('status')).toBe('ACTIVE')
    expect(new URLSearchParams(first).has('guestCount')).toBe(false)
    expect(canonicalSearchQuery('page=1&page=2')).toBeNull()
  })
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
  it('canonicalizes free text and round-trips a country-qualified destination separately from legacy filters', () => {
    const free = canonicalSearchQuery('destination=%20서울%20%20강남%20&page=02')!
    expect(new URLSearchParams(free).get('destination')).toBe('서울 강남')
    expect(canonicalSearchQuery(free)).toBe(free)
    expect(parseSearchQuery(new URLSearchParams('destination=서'))).toMatchObject({
      valid: true,
      query: { destination: '서' },
    })
    const selected = canonicalSearchQuery('country=대한민국&city=서울특별시&region=강남구')!
    expect(parseSearchQuery(new URLSearchParams(selected))).toMatchObject({
      valid: true,
      query: { country: '대한민국', city: '서울특별시', region: '강남구', status: 'ACTIVE' },
    })
    expect(canonicalSearchQuery(selected)).toBe(selected)
    expect(canonicalSearchQuery('city=서울특별시&region=강남구&destination=%20')).toBe(
      canonicalSearchQuery('city=서울특별시&region=강남구'),
    )
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
    'destination=서울&destination=강남',
    'country=KR&country=US&city=Seoul',
    'country=KR&region=강남구',
    'destination=서울&city=서울특별시',
    'destination=서울&region=강남구',
    'destination=서울&country=KR&city=Seoul',
    `destination=${'서'.repeat(101)}`,
    `country=${'A'.repeat(101)}&city=Seoul`,
    'destination=서울&displayName=서울특별시',
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
