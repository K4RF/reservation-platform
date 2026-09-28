import { apiConfig } from '../config/api'

export class ApiHttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiHttpError'
    this.status = status
    this.body = body
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('API request timed out')
    this.name = 'ApiTimeoutError'
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
}

export interface ApiClientOptions {
  baseUrl: string
  timeoutMs?: number
  headers?: HeadersInit
  // Authentication can later be added here without changing callers.
  getAccessToken?: () => string | null
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  if (
    !baseUrl ||
    !Number.isFinite(options.timeoutMs ?? 10_000) ||
    (options.timeoutMs ?? 10_000) <= 0
  ) {
    throw new Error('API base URL and a positive timeout are required')
  }

  return {
    async request<T>(path: string, request: ApiRequestOptions = {}): Promise<T | undefined> {
      if (!path.startsWith('/') || path.startsWith('//')) {
        throw new Error('API path must be a relative path starting with one slash')
      }

      const headers = new Headers(options.headers)
      new Headers(request.headers).forEach((value, name) => headers.set(name, value))
      if (!headers.has('Accept')) headers.set('Accept', 'application/json')
      if (request.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      const accessToken = options.getAccessToken?.()
      if (accessToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }

      const controller = new AbortController()
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, options.timeoutMs ?? 10_000)
      const abort = () => controller.abort()
      request.signal?.addEventListener('abort', abort, { once: true })
      if (request.signal?.aborted) controller.abort()

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: request.method ?? 'GET',
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: controller.signal,
        })
        const rawBody = await response.text()
        let body: unknown
        try {
          body = rawBody ? JSON.parse(rawBody) : undefined
        } catch {
          if (!response.ok) throw new ApiHttpError(response.status, rawBody)
          throw new Error('API response is not valid JSON')
        }
        // A future token-refresh flow can handle 401 here before surfacing the error.
        if (!response.ok) throw new ApiHttpError(response.status, body)
        return body as T
      } catch (error) {
        if (timedOut) throw new ApiTimeoutError()
        throw error
      } finally {
        clearTimeout(timeout)
        request.signal?.removeEventListener('abort', abort)
      }
    },
  }
}

export const apiClient = createApiClient(apiConfig)
