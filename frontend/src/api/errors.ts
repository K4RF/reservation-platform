export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'cancelled' | 'unexpected_response'

export type HttpErrorCategory =
  'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'server_error' | 'other'

export interface FieldError {
  field: string
  message: string
}

interface ApiErrorDetails {
  kind: ApiErrorKind
  status?: number
  category?: HttpErrorCategory
  code?: string
  path?: string
  fieldErrors?: FieldError[]
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly category?: HttpErrorCategory
  readonly code?: string
  readonly path?: string
  readonly fieldErrors: FieldError[]

  constructor(message: string, details: ApiErrorDetails) {
    super(message, { cause: details.cause })
    this.name = 'ApiError'
    this.kind = details.kind
    this.status = details.status
    this.category = details.category
    this.code = details.code
    this.path = details.path
    this.fieldErrors = details.fieldErrors ?? []
  }
}

export function httpErrorCategory(status: number): HttpErrorCategory {
  if (status >= 500 && status < 600) return 'server_error'
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    default:
      return 'other'
  }
}

export function toHttpApiError(status: number, body: unknown): ApiError {
  const contract = readBackendError(body, status)
  return new ApiError(contract?.message ?? `API request failed (HTTP ${status})`, {
    kind: 'http',
    status,
    category: httpErrorCategory(status),
    code: contract?.code,
    path: contract?.path,
    fieldErrors: contract?.errors,
  })
}

function readBackendError(body: unknown, status: number) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const value = body as Record<string, unknown>
  if (
    value.status !== status ||
    typeof value.code !== 'string' ||
    !value.code ||
    typeof value.message !== 'string' ||
    !value.message
  ) {
    return null
  }

  const errors = Array.isArray(value.errors)
    ? value.errors.filter(
        (error): error is FieldError =>
          typeof error === 'object' &&
          error !== null &&
          typeof error.field === 'string' &&
          typeof error.message === 'string',
      )
    : []

  return {
    code: value.code,
    message: value.message,
    path: typeof value.path === 'string' ? value.path : undefined,
    errors,
  }
}
