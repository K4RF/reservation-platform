import { isRoomAreaText, roomMetadataTextLimits, type RoomMetadata } from '../../api/roomMetadata'

export const roomMetadataFields = [
  'description',
  'bedConfiguration',
  'areaSquareMeters',
  'view',
] as const
export type RoomMetadataField = (typeof roomMetadataFields)[number]
export type RoomMetadataDraft = Record<RoomMetadataField, string>
export type RoomMetadataErrors = Partial<Record<RoomMetadataField, string>>

export const roomMetadataLabels: Record<RoomMetadataField, string> = {
  description: '객실 설명',
  bedConfiguration: '침대 구성',
  areaSquareMeters: '객실 면적 (㎡)',
  view: '전망',
}

export function toRoomMetadataDraft(metadata?: RoomMetadata): RoomMetadataDraft {
  return {
    description: metadata?.description ?? '',
    bedConfiguration: metadata?.bedConfiguration ?? '',
    areaSquareMeters: metadata?.areaSquareMeters?.toString() ?? '',
    view: metadata?.view ?? '',
  }
}

// Match the backend's String.strip() (Java Character.isWhitespace, not JS trim).
function stripText(value: string): string | null {
  const isWhitespace = (char: string) => {
    const code = char.charCodeAt(0)
    return (
      (code >= 9 && code <= 13) ||
      (code >= 28 && code <= 32) ||
      code === 0x1680 ||
      (code >= 0x2000 && code <= 0x2006) ||
      (code >= 0x2008 && code <= 0x200a) ||
      code === 0x2028 ||
      code === 0x2029 ||
      code === 0x205f ||
      code === 0x3000
    )
  }
  let start = 0,
    end = value.length
  while (start < end && isWhitespace(value[start])) start++
  while (end > start && isWhitespace(value[end - 1])) end--
  return value.slice(start, end) || null
}

export function readRoomMetadataDraft(
  draft: RoomMetadataDraft,
  initial?: RoomMetadata,
): {
  errors: RoomMetadataErrors
  metadata?: Partial<RoomMetadata>
} {
  const errors: RoomMetadataErrors = {}
  for (const field of ['description', 'bedConfiguration', 'view'] as const) {
    const limit = roomMetadataTextLimits[field]
    if (draft[field].length > limit)
      errors[field] = `공백을 포함해 ${limit}자 이하로 입력해 주세요.`
  }
  const area = draft.areaSquareMeters.trim()
  if (area && !isRoomAreaText(area))
    errors.areaSquareMeters = '0.01–9999.99㎡ 범위에서 소수점 둘째 자리까지 입력해 주세요.'
  if (Object.keys(errors).length) return { errors }

  const next: RoomMetadata = {
    description: stripText(draft.description),
    bedConfiguration: stripText(draft.bedConfiguration),
    areaSquareMeters: area ? Number(area) : null,
    view: stripText(draft.view),
  }
  if (roomMetadataFields.every((field) => next[field] === (initial?.[field] ?? null)))
    return { errors }
  return { errors, metadata: roomMetadataFields.every((field) => next[field] === null) ? {} : next }
}
