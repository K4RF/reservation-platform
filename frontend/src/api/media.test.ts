import { describe, expect, it, vi } from 'vitest'
import { hasCatalogMedia, isMedia, isMediaList, mediaContentUrl } from './media'
import { getAccommodation, searchAccommodations } from './accommodation'
import { getRoom, getAccommodationRooms } from './room'
import { getMediaAlbum, writeMedia } from './adminMedia'
import { media, album } from '../test/media'
import { accommodation, accommodationPage } from '../test/accommodation'
import { room, roomPage } from '../test/room'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('verified catalog Media and ADMIN transport', () => {
  it('validates identity, order, representative, limits and rejects untrusted URLs', () => {
    expect(hasCatalogMedia({ representativeImage: null, images: [] })).toBe(true)
    expect(hasCatalogMedia({})).toBe(false)
    expect(hasCatalogMedia({ representativeImage: media(), images: [media()] })).toBe(true)
    expect(hasCatalogMedia({ representativeImage: media(2), images: [media()] })).toBe(false)
    expect(isMediaList([media(2), media(1)])).toBe(false)
    expect(isMediaList([media(), media()])).toBe(false)
    expect(isMediaList(Array.from({ length: 21 }, (_, i) => media(i + 1, i)))).toBe(false)
    for (const url of [
      'https://evil.example/a.png',
      '//evil.example/a',
      'javascript:alert(1)',
      'data:image/png,x',
      '/api/v1/media/2/content',
      '/api/v1/media/1/content?x=y',
    ]) {
      expect(isMedia({ ...media(), url })).toBe(false)
    }
    expect(isMedia({ ...media(), width: 0 })).toBe(false)
    expect(isMedia({ ...media(), byteSize: 10 * 1024 * 1024 + 1 })).toBe(false)
    expect(isMedia({ ...media(), contentType: 'text/html' })).toBe(false)
    expect(mediaContentUrl(media(), 'https://api.example.com/prefix/api/v1/')).toBe(
      'https://api.example.com/prefix/api/v1/media/1/content',
    )
  })
  it('reads current public detail albums but enforces the single representative list projection without extra GETs', async () => {
    const images = [media(), media(2, 1)]
    const catalog = { ...accommodation, representativeImage: images[0], images }
    const catalogRoom = { ...room, representativeImage: images[0], images }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(catalog))
      .mockResolvedValueOnce(Response.json(catalogRoom))
      .mockResolvedValueOnce(Response.json(accommodationPage({ content: [catalog] })))
      .mockResolvedValueOnce(Response.json(roomPage({ content: [catalogRoom] })))
    vi.stubGlobal('fetch', fetch)
    expect((await getAccommodation(7)).images).toHaveLength(2)
    expect((await getRoom(3)).images).toHaveLength(2)
    await expect(searchAccommodations()).rejects.toMatchObject({ kind: 'unexpected_response' })
    await expect(getAccommodationRooms(7)).rejects.toMatchObject({ kind: 'unexpected_response' })
    expect(fetch).toHaveBeenCalledTimes(4)
  })
  it.each(['"wrong"', 'W/"' + 'a'.repeat(64) + '"', null])(
    'rejects missing, weak or mismatching ADMIN ETag %s',
    async (etag) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json(album(), { headers: etag ? { ETag: etag } : {} })),
      )
      await expect(getMediaAlbum({ type: 'ACCOMMODATION', id: 7 })).rejects.toMatchObject({
        kind: 'unexpected_response',
      })
    },
  )
  it('uses JSON metadata multipart, browser boundary, exact If-Match and never replays a write on 401', async () => {
    const current = album()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(current, { headers: { ETag: current.etag } }))
      .mockResolvedValueOnce(
        Response.json(album({ type: 'ACCOMMODATION', id: 7 }, [media()]), {
          headers: { ETag: current.etag },
        }),
      )
      .mockResolvedValueOnce(Response.json({ status: 401, message: 'Expired' }, { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    setTokenPair(
      accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN'),
      'fixture-refresh',
    )
    const owner = { type: 'ACCOMMODATION', id: 7 } as const
    const read = await getMediaAlbum(owner)
    const action = {
      kind: 'upload',
      file: new File(['png'], 'fixture.png', { type: 'image/png' }),
      metadata: { altText: 'pixels', source: 'generated', rightsRecord: 'test' },
    } as const
    await writeMedia(owner, read, action)
    const [, init] = fetch.mock.calls[1]
    const headers = new Headers(init.headers)
    expect(headers.get('If-Match')).toBe(current.etag)
    expect(headers.has('Content-Type')).toBe(false)
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body.get('metadata') as Blob).type).toBe('application/json')
    expect(init.body.get('file').name).toBe('fixture.png')
    await expect(writeMedia(owner, read, action)).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('rejects foreign owners, image IDs and incomplete orders before sending any write', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const owner = { type: 'ROOM', id: 3 } as const,
      current = album(owner, [media(), media(2, 1)])
    expect(() => writeMedia(owner, album(), { kind: 'delete', mediaId: 1 })).toThrow()
    expect(() => writeMedia(owner, current, { kind: 'delete', mediaId: 99 })).toThrow()
    expect(() => writeMedia(owner, current, { kind: 'order', mediaIds: [1] })).toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
