// Backend monetary columns use scale=2. Convert the JSON number's decimal representation,
// not floating-point arithmetic, and reject unsupported precision instead of silently rounding.
export function toMinorUnits(amount: number): bigint {
  const value = String(amount)
  if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(amount))
    throw new RangeError('Invalid amount')
  const [integer, fraction = ''] = value.split('.')
  const minor = BigInt(integer + fraction.padEnd(2, '0'))
  if (minor > 999999999999n) throw new RangeError('Amount exceeds Backend precision')
  return minor
}

export function formatMinorUnits(amount: bigint): string {
  if (amount < 0n) throw new RangeError('Invalid amount')
  return `${new Intl.NumberFormat('ko-KR').format(amount / 100n)}.${String(amount % 100n).padStart(2, '0')}`
}
