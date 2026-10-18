import { describe, expect, it } from 'vitest'
import { inventoryCalendarDates, readInventoryQuantity } from './inventoryValidation'
import { adminInventoryPath, readAdminInventoryQuery } from '../../pages/admin/adminInventoryQuery'

describe('Inventory input boundaries (not business date policy)', () => {
  it.each(['0', '1', '2147483647', ' 2 '])('accepts integer quantity %s', (value) => {
    expect(readInventoryQuantity(value)).toBe(Number(value))
  })
  it.each(['', ' ', '-1', '1.5', '1e2', 'NaN', '2147483648'])(
    'rejects quantity %s without rounding',
    (value) => {
      expect(readInventoryQuantity(value)).toBeNull()
    },
  )
  it('includes both ends, a past leap date and a one-day Calendar', () => {
    expect(inventoryCalendarDates('2000-02-28', '2000-03-01')).toEqual([
      '2000-02-28',
      '2000-02-29',
      '2000-03-01',
    ])
    expect(inventoryCalendarDates('0001-01-01', '0001-01-01')).toEqual(['0001-01-01'])
    expect(inventoryCalendarDates('9999-12-31', '9999-12-31')).toEqual(['9999-12-31'])
    expect(inventoryCalendarDates('2000-01-01', '2000-12-31')).toHaveLength(366)
    expect(inventoryCalendarDates('2000-01-01', '2001-01-01')).toBeNull()
  })
  it.each([
    'roomId=0',
    'roomId=3&roomId=4',
    'roomId=9007199254740992',
    'startDate=2030-02-30',
    'startDate=0000-01-01',
    'startDate=2030-07-22&endDate=2030-07-20',
    'startDate=2030-01-01&endDate=2031-01-02',
    'endDate=2030-01-01&endDate=2030-01-02',
  ])('rejects invalid or duplicate URL input %s', (query) => {
    expect(readAdminInventoryQuery(new URLSearchParams(query))).toBeNull()
  })
  it('allows partial room selection without guessed dates', () => {
    expect(adminInventoryPath(3)).toBe('/admin/inventories?roomId=3')
    expect(readAdminInventoryQuery(new URLSearchParams('roomId=3'))).toEqual({
      roomId: 3,
      startDate: '',
      endDate: '',
    })
  })
})
