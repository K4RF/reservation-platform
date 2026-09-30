import { describe, expect, it, vi } from 'vitest'
import { apiClient, createApiClient } from './client'
import { ApiError } from './errors'
import { getAccessToken, setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('API client', () => {
  it('sends JSON with shared and per-request headers and parses a JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ memberId: 7 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = createApiClient({
      baseUrl: '/api/v1/',
      headers: { 'X-Client': 'frontend' },
    })
    const result = await client.request<{ memberId: number }>('/members', {
      method: 'POST',
      body: { email: 'member@example.com' },
      headers: { 'X-Request': 'signup' },
    })

    expect(result).toEqual({ memberId: 7 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/members')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'member@example.com' }))
    const headers = new Headers(init.headers)
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Client')).toBe('frontend')
    expect(headers.get('X-Request')).toBe('signup')
  })

  it('returns undefined for an empty success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(
      createApiClient({ baseUrl: '/api/v1' }).request('/members'),
    ).resolves.toBeUndefined()
  })

  it('uses an environment-specific absolute API base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient({ baseUrl: 'https://api.example.com/api/v1' }).request('/members')

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/members')
  })

  it('converts the backend error contract to an API error', async () => {
    const errorBody = {
      status: 400,
      code: 'COMMON_001',
      message: '입력값이 올바르지 않습니다.',
      path: '/api/v1/members',
      errors: [{ field: 'email', message: '이메일 형식이 올바르지 않습니다.' }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 400 })),
    )

    await expect(createApiClient({ baseUrl: '/api/v1' }).request('/members')).rejects.toMatchObject(
      {
        kind: 'http',
        status: 400,
        category: 'bad_request',
        code: 'COMMON_001',
        path: '/api/v1/members',
        fieldErrors: errorBody.errors,
      } satisfies Partial<ApiError>,
    )
  })

  it('preserves HTTP status without exposing a non-JSON upstream error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })))

    await expect(createApiClient({ baseUrl: '/api/v1' }).request('/members')).rejects.toMatchObject(
      {
        kind: 'http',
        status: 502,
        category: 'server_error',
        code: undefined,
        message: 'API request failed (HTTP 502)',
      } satisfies Partial<ApiError>,
    )
  })

  it('reserves one place to apply an access token without overriding explicit authorization', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}')))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient({ baseUrl: '/api/v1', getAccessToken: () => 'test-token' })

    await client.request('/members')
    expect(
      new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Authorization'),
    ).toBe('Bearer test-token')

    await client.request('/members', { headers: { Authorization: 'Bearer explicit-token' } })
    expect(
      new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers).get('Authorization'),
    ).toBe('Bearer explicit-token')
  })

  it('omits Authorization for explicitly public requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient({ baseUrl: '/api/v1', getAccessToken: () => 'test-token' })

    await client.request('/auth/login', { method: 'POST', includeAuth: false })

    expect(
      new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).has('Authorization'),
    ).toBe(false)
  })

  it('uses the live access token and clears it after a protected 401', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setAccessToken(token)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: 401, code: 'AUTH_001', message: '인증이 필요합니다.' }),
        {
          status: 401,
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.request('/reservations')).rejects.toMatchObject({
      kind: 'http',
      status: 401,
    })

    expect(
      new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Authorization'),
    ).toBe(`Bearer ${token}`)
    expect(getAccessToken()).toBeNull()
  })

  it('aborts a request after the configured timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      ),
    )

    const request = createApiClient({ baseUrl: '/api/v1', timeoutMs: 50 }).request('/members')
    const assertion = expect(request).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(50)
    await assertion
  })

  it('distinguishes network failure from an HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(createApiClient({ baseUrl: '/api/v1' }).request('/members')).rejects.toMatchObject(
      {
        kind: 'network',
        status: undefined,
      } satisfies Partial<ApiError>,
    )
  })

  it('reports malformed and empty success responses as unexpected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient({ baseUrl: '/api/v1' })

    await expect(client.request('/members')).rejects.toMatchObject({ kind: 'unexpected_response' })
    await expect(client.request('/members')).rejects.toMatchObject({ kind: 'unexpected_response' })
  })

  it('rejects absolute or protocol-relative paths supplied by a component', async () => {
    const client = createApiClient({ baseUrl: '/api/v1' })

    await expect(client.request('https://example.com')).rejects.toThrow('relative path')
    await expect(client.request('//example.com')).rejects.toThrow('relative path')
  })
})
