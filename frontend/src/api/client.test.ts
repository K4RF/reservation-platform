import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiHttpError, ApiTimeoutError, createApiClient } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

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

  it('preserves the backend error body and HTTP status', async () => {
    const errorBody = { code: 'COMMON_001', message: '입력값이 올바르지 않습니다.' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 400 })),
    )

    await expect(createApiClient({ baseUrl: '/api/v1' }).request('/members')).rejects.toMatchObject(
      {
        status: 400,
        body: errorBody,
      } satisfies Partial<ApiHttpError>,
    )
  })

  it('preserves HTTP status even when an upstream error is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })))

    await expect(createApiClient({ baseUrl: '/api/v1' }).request('/members')).rejects.toMatchObject(
      {
        status: 502,
        body: 'Bad Gateway',
      } satisfies Partial<ApiHttpError>,
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
    const assertion = expect(request).rejects.toBeInstanceOf(ApiTimeoutError)
    await vi.advanceTimersByTimeAsync(50)
    await assertion
  })

  it('rejects absolute or protocol-relative paths supplied by a component', async () => {
    const client = createApiClient({ baseUrl: '/api/v1' })

    await expect(client.request('https://example.com')).rejects.toThrow('relative path')
    await expect(client.request('//example.com')).rejects.toThrow('relative path')
  })
})
