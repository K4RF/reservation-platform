import { apiClient } from './client'
import { ApiError } from './errors'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
}

function requireLoginResponse(response: LoginResponse | undefined): LoginResponse {
  if (
    !response ||
    typeof response.accessToken !== 'string' ||
    !response.accessToken ||
    typeof response.refreshToken !== 'string' ||
    !response.refreshToken ||
    response.tokenType !== 'Bearer'
  ) {
    throw new ApiError('로그인 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response
}

export async function loginWithEmail(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: request,
    includeAuth: false,
  })

  return requireLoginResponse(response)
}

export async function exchangeGoogleLoginCode(code: string): Promise<LoginResponse> {
  const response = await apiClient.request<LoginResponse>('/auth/oauth2/exchange', {
    method: 'POST',
    body: { code },
    includeAuth: false,
  })
  return requireLoginResponse(response)
}

export async function logoutFromBackend(): Promise<void> {
  await apiClient.request('/auth/logout', {
    method: 'POST',
    retryOnUnauthorized: false,
  })
}
