import { apiClient } from './client'
import { ApiError } from './errors'
import type { UserRole } from '../state/authTypes'

export interface SignUpRequest {
  email: string
  password: string
}

export interface SignUpResponse {
  memberId: number
  email: string
  role: UserRole
}

export async function signUpMember(request: SignUpRequest): Promise<SignUpResponse> {
  const response = await apiClient.request<SignUpResponse>('/members', {
    method: 'POST',
    body: request,
    includeAuth: false,
  })

  if (
    !response ||
    !Number.isSafeInteger(response.memberId) ||
    response.memberId < 1 ||
    typeof response.email !== 'string' ||
    (response.role !== 'USER' && response.role !== 'ADMIN')
  ) {
    throw new ApiError('회원가입 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }

  return response
}
