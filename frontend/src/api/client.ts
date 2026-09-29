import { apiConfig } from '../config/api'
import { ApiError, toHttpApiError } from './errors'

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

      let responseReceived = false
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: request.method ?? 'GET',
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: controller.signal,
        })
        responseReceived = true
        const rawBody = await response.text()
        if (!response.ok) {
          let body: unknown
          try {
            body = rawBody ? JSON.parse(rawBody) : undefined
          } catch {
            body = undefined
          }
          // A future token-refresh flow can handle 401 here before surfacing the error.
          throw toHttpApiError(response.status, body)
        }
        if (!rawBody) {
          if (response.status === 204 || response.status === 205) return undefined
          throw new ApiError('API returned an empty response', { kind: 'unexpected_response' })
        }
        try {
          return JSON.parse(rawBody) as T
        } catch {
          throw new ApiError('API response is not valid JSON', { kind: 'unexpected_response' })
        }
      } catch (error) {
        if (error instanceof ApiError) throw error
        if (timedOut) throw new ApiError('API request timed out', { kind: 'timeout', cause: error })
        if (controller.signal.aborted) {
          throw new ApiError('API request was cancelled', { kind: 'cancelled', cause: error })
        }
        throw new ApiError(
          responseReceived ? 'API response could not be read' : 'Network request failed',
          { kind: responseReceived ? 'unexpected_response' : 'network', cause: error },
        )
      } finally {
        clearTimeout(timeout)
        request.signal?.removeEventListener('abort', abort)
      }
    },
  }
}

export const apiClient = createApiClient(apiConfig)
