import { describe, expect, it } from 'vitest'
import { ApiError, httpErrorCategory, toHttpApiError } from './errors'

describe('API error mapping', () => {
  it.each([
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [500, 'server_error'],
    [503, 'server_error'],
  ] as const)('maps HTTP %i to %s', (status, category) => {
    expect(httpErrorCategory(status)).toBe(category)
    expect(toHttpApiError(status, null)).toMatchObject({ kind: 'http', status, category })
  })

  it('keeps a domain code without hard-coding the backend code catalogue', () => {
    const error = toHttpApiError(409, {
      timestamp: '2026-09-30T00:00:00Z',
      status: 409,
      code: 'INVENTORY_011',
      message: '재고 충돌',
      path: '/api/v1/reservations',
      errors: [],
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      category: 'conflict',
      code: 'INVENTORY_011',
      message: '재고 충돌',
      path: '/api/v1/reservations',
      fieldErrors: [],
    })
  })

  it('does not trust a body with a mismatched HTTP status', () => {
    expect(toHttpApiError(401, { status: 200, code: 'AUTH_001', message: 'fake' })).toMatchObject({
      status: 401,
      category: 'unauthorized',
      code: undefined,
      message: 'API request failed (HTTP 401)',
    })
  })
})
