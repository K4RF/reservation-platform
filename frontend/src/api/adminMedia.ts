import { apiClient, type ApiRequestOptions } from './client'
import { ApiError } from './errors'
import { isMediaList, type MediaResponse } from './media'

export interface MediaOwner {
  type: 'ACCOMMODATION' | 'ROOM'
  id: number
}
export interface MediaMetadata {
  altText: string
  source: string
  rightsRecord: string
}
export interface MediaAlbum {
  ownerType: MediaOwner['type']
  ownerId: number
  revision: string
  images: { image: MediaResponse; source: string; rightsRecord: string }[]
  etag: string
}
export type MediaAction =
  | { kind: 'upload'; file: File; metadata: MediaMetadata }
  | { kind: 'replace'; mediaId: number; file: File; metadata: MediaMetadata }
  | { kind: 'metadata'; mediaId: number; metadata: MediaMetadata }
  | { kind: 'representative' | 'delete'; mediaId: number }
  | { kind: 'order'; mediaIds: number[] }

function base(owner: MediaOwner) {
  if (
    !Number.isSafeInteger(owner.id) ||
    owner.id < 1 ||
    !['ACCOMMODATION', 'ROOM'].includes(owner.type)
  )
    throw new RangeError('Invalid media owner')
  return `/${owner.type === 'ROOM' ? 'rooms' : 'accommodations'}/${owner.id}/media`
}
export function validMetadata(value: MediaMetadata) {
  return (['altText', 'source', 'rightsRecord'] as const).every(
    (key, i) =>
      typeof value[key] === 'string' &&
      value[key].trim().length > 0 &&
      value[key].length <= [300, 500, 1000][i],
  )
}
async function requestAlbum(
  owner: MediaOwner,
  path: string,
  options: ApiRequestOptions,
): Promise<MediaAlbum> {
  const responseHeaders: { etag: string | null } = { etag: null }
  const row = await apiClient.request<Omit<MediaAlbum, 'etag'>>(base(owner) + path, {
    ...options,
    onResponseHeaders: (headers) => {
      responseHeaders.etag = headers.get('ETag')
    },
  })
  if (
    !row ||
    row.ownerType !== owner.type ||
    row.ownerId !== owner.id ||
    !/^[a-f0-9]{64}$/.test(row.revision) ||
    responseHeaders.etag !== `"${row.revision}"` ||
    !Array.isArray(row.images) ||
    !row.images.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        validMetadata({
          altText: item.image?.altText,
          source: item.source,
          rightsRecord: item.rightsRecord,
        }),
    ) ||
    !isMediaList(row.images.map((item) => item.image))
  ) {
    throw new ApiError('사진 관리 응답 또는 ETag가 올바르지 않습니다.', {
      kind: 'unexpected_response',
    })
  }
  return { ...row, etag: responseHeaders.etag! }
}
export function getMediaAlbum(owner: MediaOwner, signal?: AbortSignal) {
  return requestAlbum(owner, '', { signal, headers: { 'Cache-Control': 'no-cache' } })
}
export function writeMedia(
  owner: MediaOwner,
  album: MediaAlbum,
  action: MediaAction,
  signal?: AbortSignal,
) {
  if (
    album.ownerType !== owner.type ||
    album.ownerId !== owner.id ||
    album.etag !== `"${album.revision}"`
  )
    throw new RangeError('Album does not belong to this owner')
  if ('mediaId' in action && !album.images.some((item) => item.image.mediaId === action.mediaId))
    throw new RangeError('Image does not belong to this album')
  if ('metadata' in action && !validMetadata(action.metadata))
    throw new RangeError('Invalid metadata')
  let path = '',
    method: ApiRequestOptions['method'] = 'POST',
    body: unknown
  if (action.kind === 'order') {
    if (
      action.mediaIds.length !== album.images.length ||
      new Set(action.mediaIds).size !== action.mediaIds.length ||
      !action.mediaIds.every((id) => album.images.some((item) => item.image.mediaId === id))
    )
      throw new RangeError('Invalid order')
    path = '/order'
    method = 'PUT'
    body = { mediaIds: action.mediaIds }
  } else if (action.kind !== 'upload') {
    path = `/${action.mediaId}`
    method =
      action.kind === 'delete' ? 'DELETE' : action.kind === 'representative' ? 'PATCH' : 'PUT'
    if (action.kind === 'representative') path += '/representative'
    if (action.kind === 'replace') path += '/content'
    if (action.kind === 'metadata') body = action.metadata
  }
  if (action.kind === 'upload' || action.kind === 'replace') {
    if (
      !action.file.size ||
      action.file.size > 10 * 1024 * 1024 ||
      !['image/jpeg', 'image/png'].includes(action.file.type)
    )
      throw new RangeError('JPEG/PNG 파일을 10MiB 이하로 선택하세요.')
    body = new FormData()
    ;(body as FormData).append('file', action.file)
    ;(body as FormData).append(
      'metadata',
      new Blob([JSON.stringify(action.metadata)], { type: 'application/json' }),
    )
  }
  return requestAlbum(owner, path, {
    method,
    body,
    signal,
    headers: { 'If-Match': album.etag },
    retryOnUnauthorized: false,
  })
}
