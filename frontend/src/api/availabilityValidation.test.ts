import { describe, expect, it } from 'vitest'
import { validateAvailability } from './availabilityValidation'

const request = { checkInDate: '2032-02-29', checkOutDate: '2032-03-01', guestCount: 2 }
describe('availability date and guest validation', () => {
  it('accepts an actual leap day without enforcing server-dependent today or booking policies', () => {
    expect(validateAvailability(request)).toBeNull()
  })
  it.each([
    { checkInDate: '' },
    { checkOutDate: '' },
    { checkInDate: '2031-02-29' },
    { checkInDate: '2032-02-30' },
    { checkInDate: 'not-a-date' },
    { checkOutDate: '2032-02-29' },
    { checkOutDate: '2032-02-28' },
    { guestCount: 0 },
    { guestCount: -1 },
    { guestCount: 1.5 },
    { guestCount: 2147483648 },
  ])('rejects invalid conditions %j', (overrides) => {
    expect(validateAvailability({ ...request, ...overrides })).not.toBeNull()
  })
})
