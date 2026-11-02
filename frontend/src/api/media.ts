import { apiConfig } from '../config/api'

export interface MediaResponse {
  mediaId: number
  url: string
  altText: string
  width: number
  height: number
  byteSize: number
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  sortOrder: number
}
export interface CatalogMedia {
  representativeImage: MediaResponse | null
  images: MediaResponse[]
}

// Only the Backend content endpoint is accepted, never arbitrary HTML/remote/data URLs.
export function isMedia(value: unknown): value is MediaResponse {
  if (!value || typeof value !== 'object') return false
  const row = value as MediaResponse
  return (
    Number.isSafeInteger(row.mediaId) &&
    row.mediaId > 0 &&
    row.url === `/api/v1/media/${row.mediaId}/content` &&
    typeof row.altText === 'string' &&
    row.altText.trim().length > 0 &&
    row.altText.length <= 300 &&
    [row.width, row.height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192) &&
    Number.isInteger(row.byteSize) &&
    row.byteSize > 0 &&
    row.byteSize <= 10 * 1024 * 1024 &&
    ['image/jpeg', 'image/png', 'image/webp'].includes(row.contentType) &&
    Number.isSafeInteger(row.sortOrder) &&
    row.sortOrder >= 0
  )
}
export function isMediaList(value: unknown, limit = 20): value is MediaResponse[] {
  return (
    Array.isArray(value) &&
    value.length <= limit &&
    value.every(isMedia) &&
    new Set(value.map((image) => image.mediaId)).size === value.length &&
    value.every(
      (image, i) =>
        i === 0 ||
        image.sortOrder > value[i - 1].sortOrder ||
        (image.sortOrder === value[i - 1].sortOrder && image.mediaId > value[i - 1].mediaId),
    )
  )
}
export function hasCatalogMedia(value: object, limit = 20): boolean {
  const row = value as CatalogMedia
  return (
    isMediaList(row.images, limit) &&
    (row.images.length === 0
      ? row.representativeImage === null
      : isMedia(row.representativeImage) &&
        Object.keys(row.images[0]).every(
          (key) =>
            row.images[0][key as keyof MediaResponse] ===
            row.representativeImage![key as keyof MediaResponse],
        ))
  )
}

// The response URL is API-origin-relative. Keep a reverse proxy's configured API prefix too.
export function mediaContentUrl(image: MediaResponse, baseUrl = apiConfig.baseUrl): string {
  if (!isMedia(image)) throw new RangeError('Invalid media content')
  return `${baseUrl.replace(/\/+$/, '')}/media/${image.mediaId}/content`
}
