import { describe, expect, it, vi } from 'vitest'
import { auditResponse } from '../../scripts/ui-audit/responses'
import { startPerformanceProbe } from '../../scripts/ui-audit/performanceProbe'

describe('isolated read-only UI audit fixtures', () => {
  it('limits synthetic policy outcomes to the opted-in booking policy POST', async () => {
    const path = '/api/v1/accommodations/7/booking-policy'
    expect(auditResponse(path, 'POST', 'ready').status).toBe(405)
    const success = auditResponse(path, 'POST', 'ready', 'missing', 'blocked', 'policy-success')
    expect(success.status).toBe(201)
    expect(await success.json()).toMatchObject({ bookingPolicyId: 11, accommodationId: 7 })
    expect(auditResponse(path, 'POST', 'ready', 'missing', 'blocked', 'policy-error').status).toBe(
      500,
    )
    expect(auditResponse(path, 'GET', 'ready', 'missing', 'blocked', 'policy-success').status).toBe(
      404,
    )
    expect(auditResponse(path, 'PUT', 'ready', 'missing', 'blocked', 'policy-success').status).toBe(
      405,
    )
    expect(
      auditResponse(
        '/api/v1/rooms/3/media',
        'DELETE',
        'ready',
        'missing',
        'blocked',
        'policy-success',
      ).status,
    ).toBe(405)
  })
  it('simulates only explicitly opted-in Booking outcomes without enabling other writes', async () => {
    expect(auditResponse('/api/v1/reservations', 'POST', 'ready').status).toBe(405)
    const result = auditResponse('/api/v1/reservations', 'POST', 'ready', 'present', 'success')
    expect(result.status).toBe(201)
    expect((await result.json()).reservationId).toBe(42)
    expect(
      auditResponse('/api/v1/reservations', 'POST', 'ready', 'present', 'ambiguous').status,
    ).toBe(500)
    for (const method of ['PUT', 'PATCH', 'DELETE'])
      expect(
        auditResponse('/api/v1/reservations', method, 'ready', 'present', 'success').status,
      ).toBe(405)
    expect(
      auditResponse('/api/v1/reservations/42/cancel', 'POST', 'ready', 'present', 'success').status,
    ).toBe(405)
    expect(
      auditResponse('/api/v1/accommodations/7/media', 'POST', 'ready', 'present', 'success').status,
    ).toBe(405)
  })
  it('keeps the normal ACTIVE Search comparison free of the synthetic inactive row', async () => {
    const page = await auditResponse(
      '/api/v1/accommodations?status=ACTIVE',
      'GET',
      'comparison',
      'present',
    ).json()
    expect(page.content).toHaveLength(3)
    expect(page.content.every((row: { status: string }) => row.status === 'ACTIVE')).toBe(true)
    expect(page.totalElements).toBe(3)
    const inactive = await auditResponse(
      '/api/v1/accommodations?status=INACTIVE',
      'GET',
      'comparison',
      'present',
    ).json()
    expect(inactive.content).toHaveLength(1)
  })
  it('uses two distinct fictional Media projections for Home comparison, including partial failure', async () => {
    const present = await auditResponse(
      '/api/v1/accommodations?size=2',
      'GET',
      'comparison',
      'present',
    ).json()
    expect(
      present.content.map(
        (row: { representativeImage: { mediaId: number } }) => row.representativeImage.mediaId,
      ),
    ).toEqual([2001, 2002])
    const partial = await auditResponse(
      '/api/v1/accommodations?size=2',
      'GET',
      'comparison',
      'partial',
    ).json()
    expect(partial.content[1].representativeImage.url).toBe('/api/v1/media/2999/content')
    expect(partial.content[1].images).toEqual([partial.content[1].representativeImage])
  })
  it('keeps Media demo photos inside audit fixtures, bounds list projections and provides ADMIN ETags without writes', async () => {
    const list = await auditResponse('/api/v1/accommodations', 'GET', 'ready', 'present').json()
    expect(list.content[0].images).toHaveLength(1)
    const detail = await auditResponse('/api/v1/accommodations/7', 'GET', 'ready', 'present').json()
    expect(detail.images).toHaveLength(2)
    expect(detail.images[0].altText).toContain('실제 시설 아님')
    const read = auditResponse('/api/v1/accommodations/7/media', 'GET', 'ready', 'partial')
    expect(read.headers.get('ETag')).toBe('"' + 'a'.repeat(64) + '"')
    expect((await read.json()).images[1].image.url).toContain('/2999/')
    expect(auditResponse('/api/v1/accommodations/7/media', 'POST', 'ready', 'present').status).toBe(
      405,
    )
    expect(
      (await auditResponse('/api/v1/accommodations/7', 'GET', 'ready', 'missing').json()).images,
    ).toEqual([])
  })
  it('observes only supported buffered metrics, omits resource URLs and unrelated data, and disconnects', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const instances: FakeObserver[] = []
    class FakeObserver {
      static supportedEntryTypes = ['layout-shift', 'resource']
      observe = vi.fn()
      disconnect = vi.fn()
      callback: PerformanceObserverCallback
      constructor(callback: PerformanceObserverCallback) {
        this.callback = callback
        instances.push(this)
      }
    }
    vi.stubGlobal('PerformanceObserver', FakeObserver)
    const stop = startPerformanceProbe()
    expect(instances.map((observer) => observer.observe.mock.calls[0][0])).toEqual([
      { type: 'layout-shift', buffered: true },
      { type: 'resource', buffered: true },
    ])
    const entries = (data: Record<string, unknown>[]) =>
      ({
        getEntries: () => data.map((value) => ({ toJSON: () => value })),
      }) as unknown as PerformanceObserverEntryList
    instances[0].callback(
      entries([{ startTime: 20, value: 0.01, hadRecentInput: false, sources: ['private'] }]),
      {} as PerformanceObserver,
    )
    instances[1].callback(
      entries([
        {
          startTime: 10,
          duration: 3,
          transferSize: 100,
          initiatorType: 'img',
          name: 'private-url',
        },
        { initiatorType: 'fetch', name: 'private-api' },
      ]),
      {} as PerformanceObserver,
    )
    expect(log.mock.calls.map(([, json]) => JSON.parse(json as string))).toEqual([
      { supported: ['layout-shift', 'resource'] },
      { type: 'layout-shift', entries: [{ startTime: 20, value: 0.01, hadRecentInput: false }] },
      { type: 'resource', entries: [{ startTime: 10, duration: 3, transferSize: 100 }] },
    ])
    stop()
    expect(instances.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true)
    log.mockRestore()
  })
  it('reports unavailable performance observation without making page rendering depend on it', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.stubGlobal('PerformanceObserver', undefined)
    expect(startPerformanceProbe()).toBeTypeOf('function')
    expect(JSON.parse(log.mock.calls[0][1] as string)).toEqual({ supported: [] })
    log.mockRestore()
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'blocks %s instead of forwarding or changing data',
    async (method) => {
      const response = auditResponse('/api/v1/reservations/42/cancel', method, 'ready')
      expect(response.status).toBe(405)
      expect(await response.json()).toMatchObject({ code: 'AUDIT_READ_ONLY' })
    },
  )
  it('does not treat unsupported API or policy reads as implemented', async () => {
    expect(auditResponse('/api/v1/accommodations/7/booking-policy', 'GET', 'ready').status).toBe(
      404,
    )
    expect(auditResponse('/api/v1/admin/reservations', 'GET', 'ready').status).toBe(404)
  })
  it('keeps readiness, empty and error visually reproducible', async () => {
    const ready = await auditResponse('/api/v1/accommodations', 'GET', 'ready').json()
    expect(ready.content).toHaveLength(1)
    expect((await auditResponse('/api/v1/accommodations', 'GET', 'empty').json()).content).toEqual(
      [],
    )
    expect(auditResponse('/api/v1/accommodations', 'GET', 'error').status).toBe(500)
  })
  it('keeps long text and large price probes consistent and strictly read-only', async () => {
    const catalog = await auditResponse('/api/v1/accommodations/7', 'GET', 'stress').json()
    const room = await auditResponse('/api/v1/rooms/3', 'GET', 'stress').json()
    const list = await auditResponse(
      '/api/v1/accommodations/7/rooms/available',
      'GET',
      'stress',
    ).json()
    const detail = await auditResponse('/api/v1/reservations/42', 'GET', 'stress').json()
    expect(catalog.name).toHaveLength(100)
    expect(catalog.description).toContain('\n')
    expect(list.content[0]).toEqual(room)
    expect(room.nightlyPrice).toBe(9999999999.99)
    expect(
      detail.nights.every(
        (night: { priceSnapshot: number }) => night.priceSnapshot === room.nightlyPrice,
      ),
    ).toBe(true)
    expect(detail.totalAmount).toBe(19999999999.98)
    expect(detail.representativeGuest.email).toMatch(/@example.com$/)
    expect(auditResponse('/api/v1/reservations', 'POST', 'stress').status).toBe(405)
  })
  it('retains occupied inventory and omits uncreated days', async () => {
    const result = await auditResponse(
      '/api/v1/rooms/3/inventories?startDate=2030-07-20&endDate=2030-07-22',
      'GET',
      'ready',
    ).json()
    expect(result.inventories.map((row: { inventoryDate: string }) => row.inventoryDate)).toEqual([
      '2030-07-20',
      '2030-07-22',
    ])
    expect(result.inventories[1]).toMatchObject({
      saleStatus: 'CLOSED',
      reservedQuantity: 2,
      availableQuantity: 3,
    })
  })
  it('pages synthetic comparison cards without introducing media/price contracts or allowing writes', async () => {
    const first = await auditResponse('/api/v1/accommodations?size=2', 'GET', 'comparison').json()
    const second = await auditResponse(
      '/api/v1/accommodations?size=2&page=1',
      'GET',
      'comparison',
    ).json()
    expect(first).toMatchObject({
      page: 0,
      size: 2,
      totalElements: 4,
      totalPages: 2,
      first: true,
      last: false,
    })
    expect(first.content.map((row: { accommodationId: number }) => row.accommodationId)).toEqual([
      7, 8,
    ])
    expect(second.content.map((row: { accommodationId: number }) => row.accommodationId)).toEqual([
      9, 10,
    ])
    expect(second).toMatchObject({ page: 1, first: false, last: true })
    expect(Object.keys(first.content[0])).toEqual(
      Object.keys(await auditResponse('/api/v1/accommodations/7', 'GET', 'ready').json()),
    )
    expect(auditResponse('/api/v1/accommodations', 'POST', 'comparison').status).toBe(405)
  })
})
