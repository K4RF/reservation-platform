import { describe, expect, it } from 'vitest'
import {
  addStayDays,
  changeStayCheckIn,
  monthDays,
  shiftStayMonth,
  stayNights,
} from './stayDateRange'

describe('stay calendar arithmetic (UTC dates, not a business TimeZone policy)', () => {
  it.each([
    ['2030-01-31', 1, '2030-02-01'],
    ['2030-12-31', 1, '2031-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2030-03-10', 1, '2030-03-11'],
    ['0001-01-01', -1, null],
    ['9999-12-31', 1, null],
    ['2030-02-30', 1, null],
  ])('adds %s / %s without overflow or local DST (%s)', (date, days, expected) => {
    expect(addStayDays(date, days)).toBe(expected)
  })
  it('retains a valid checkout and corrects missing/same/earlier checkout only when check-in changes', () => {
    expect(
      changeStayCheckIn({ checkInDate: '2030-01-01', checkOutDate: '2030-01-10' }, '2030-01-03'),
    ).toEqual({ dates: { checkInDate: '2030-01-03', checkOutDate: '2030-01-10' }, notice: '' })
    for (const end of ['', '2030-01-03', '2030-01-02']) {
      const next = changeStayCheckIn({ checkInDate: '', checkOutDate: end }, '2030-01-03')
      expect(next.dates.checkOutDate).toBe('2030-01-04')
      expect(next.notice).toContain('최소 1박')
    }
    expect(
      changeStayCheckIn({ checkInDate: '', checkOutDate: '' }, '9999-12-31').dates.checkOutDate,
    ).toBe('')
  })
  it('counts actual nights and rejects incomplete/reversed ranges, with no arbitrary booking limit', () => {
    expect(stayNights({ checkInDate: '2028-02-28', checkOutDate: '2028-03-01' })).toBe(2)
    expect(stayNights({ checkInDate: '0001-01-01', checkOutDate: '0002-01-01' })).toBe(365)
    expect(stayNights({ checkInDate: '2030-01-01', checkOutDate: '2030-01-01' })).toBeNull()
    expect(stayNights({ checkInDate: '', checkOutDate: '2030-01-01' })).toBeNull()
  })
  it('builds complete Sunday-first weeks and handles month boundaries and supported year limits', () => {
    const weeks = monthDays('2028-02')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks.flat().filter(Boolean)).toHaveLength(29)
    expect(weeks.flat()).toContain('2028-02-29')
    expect(shiftStayMonth('2030-12', 1)).toBe('2031-01')
    expect(shiftStayMonth('0001-01', -1)).toBeNull()
    expect(shiftStayMonth('9999-12', 1)).toBeNull()
  })
})
