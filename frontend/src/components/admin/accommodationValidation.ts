import type { AccommodationWriteRequest } from '../../api/adminAccommodation'

export const accommodationTextFields = [
  ['name', '숙소 이름', 100],
  ['description', '숙소 설명', 1000],
  ['country', '국가', 100],
  ['city', '도시', 100],
  ['region', '지역', 100],
  ['address', '상세 주소', 255],
  ['timeZone', '숙소 시간대', 50],
] as const
function timeValue(value: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59)
    return NaN
  return (
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0)
  )
}
export function validateAccommodation(body: AccommodationWriteRequest): string[] {
  const errors: string[] = []
  for (const [field, label, max] of accommodationTextFields) {
    if (!body[field].trim() || body[field].length > max)
      errors.push(`${label}: 필수 입력이며 ${max}자 이하여야 합니다.`)
  }
  const start = timeValue(body.checkInTime),
    end = timeValue(body.checkOutTime)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end)
    errors.push('유효하고 서로 다른 체크인·체크아웃 시간이 필요합니다.')
  try {
    new Intl.DateTimeFormat('en', { timeZone: body.timeZone })
  } catch {
    errors.push('유효한 숙소 시간대(IANA ZoneId)를 입력해 주세요.')
  }
  return errors
}
