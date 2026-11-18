export interface RoomMetadata {
  description: string | null
  bedConfiguration: string | null
  areaSquareMeters: number | null
  view: string | null
}

export const roomMetadataTextLimits = { description: 1000, bedConfiguration: 100, view: 100 }

const areaDecimal = /^(?:[0-9]{1,4}(?:\.[0-9]{1,2})?|\.[0-9]{1,2})$/

export function isRoomAreaText(value: string): boolean {
  return areaDecimal.test(value) && Number(value) >= 0.01 && Number(value) <= 9999.99
}

export function isRoomMetadata(value: unknown): value is RoomMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    Object.entries(roomMetadataTextLimits).every(([field, limit]) => {
      const text = row[field]
      return text === null || (typeof text === 'string' && text.length > 0 && text.length <= limit)
    }) &&
    (row.areaSquareMeters === null ||
      (typeof row.areaSquareMeters === 'number' && isRoomAreaText(String(row.areaSquareMeters)))) &&
    ['description', 'bedConfiguration', 'areaSquareMeters', 'view'].some(
      (field) => row[field] !== null,
    )
  )
}
