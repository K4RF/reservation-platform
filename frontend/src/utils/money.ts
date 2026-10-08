// Backend monetary columns use scale=2. Convert the JSON number's decimal representation,
// not floating-point arithmetic, and reject unsupported precision instead of silently rounding.
export function toMinorUnits(amount: number, precision = 12): bigint {
  const value = String(amount)
  if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(amount))
    throw new RangeError('Invalid amount')
  const [integer, fraction = ''] = value.split('.')
  const minor = BigInt(integer + fraction.padEnd(2, '0'))
  if (minor >= 10n ** BigInt(precision) || minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Amount exceeds supported precision')
  return minor
}

export function formatMinorUnits(amount: bigint): string {
  if (amount < 0n) throw new RangeError('Invalid amount')
  return `${new Intl.NumberFormat('ko-KR').format(amount / 100n)}.${String(amount % 100n).padStart(2, '0')}`
}
