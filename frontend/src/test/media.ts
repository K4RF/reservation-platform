import type { MediaResponse } from '../api/media'
import type { MediaAlbum, MediaOwner } from '../api/adminMedia'

// Contract fixtures only. No real property photo/URL/rights claim.
export function media(id = 1, sortOrder = 0): MediaResponse {
  return {
    mediaId: id,
    url: `/api/v1/media/${id}/content`,
    altText: `격리 테스트 사진 ${id}`,
    width: 1600,
    height: 1000,
    byteSize: 100,
    contentType: 'image/png',
    sortOrder,
  }
}
export function album(
  owner: MediaOwner = { type: 'ACCOMMODATION', id: 7 },
  images: MediaResponse[] = [],
): MediaAlbum {
  const revision = 'a'.repeat(64)
  return {
    ownerType: owner.type,
    ownerId: owner.id,
    revision,
    etag: `"${revision}"`,
    images: images.map((image) => ({
      image,
      source: 'Generated fixture',
      rightsRecord: 'isolated test only',
    })),
  }
}
