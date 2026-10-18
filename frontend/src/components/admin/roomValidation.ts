import { toMinorUnits } from '../../utils/money'

export function readPositiveId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}
export function readRoomCapacity(raw: string): number | null {
  const value = readPositiveId(raw)
  return value !== null && value <= 2147483647 ? value : null
}
// UI accepts only the stored DECIMAL(12,2) range, without silently rounding input.
export function readRoomPrice(raw: string, allowZero = false): number | null {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) return null
  const value = Number(raw)
  try {
    const minor = toMinorUnits(value)
    return minor > 0n || (allowZero && minor === 0n) ? value : null
  } catch {
    return null
  }
}
