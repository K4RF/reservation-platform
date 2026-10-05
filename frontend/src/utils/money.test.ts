import { describe, expect, it } from 'vitest'
import { toMinorUnits, formatMinorUnits } from './money'

describe('exact display-only money', () => {
  it('formats zero, fractional values and large aggregated totals without float addition', () => {
    expect(formatMinorUnits(0n)).toBe('0.00')
    expect(formatMinorUnits(toMinorUnits(0.1) + toMinorUnits(0.2))).toBe('0.30')
    expect(formatMinorUnits(toMinorUnits(9999999999.99))).toBe('9,999,999,999.99')
    expect(formatMinorUnits(999999999999999999n)).toBe('9,999,999,999,999,999.99')
  })
  it.each([-1, NaN, Infinity, 0.001, 10000000000])(
    'rejects amounts outside backend scale/precision %s',
    (amount) => {
      expect(() => toMinorUnits(amount)).toThrow()
    },
  )
})
