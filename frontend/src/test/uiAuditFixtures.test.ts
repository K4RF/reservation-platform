import { describe, expect, it } from 'vitest'
import { auditResponse } from '../../scripts/ui-audit/responses'

describe('isolated read-only UI audit fixtures', () => {
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
