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

export async function loginWithEmail(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: request,
  })

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
