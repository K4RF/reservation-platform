import { ApiError } from './errors'
import type { ApiRequestOptions } from './client'

export interface ReissueTokenResponse {
  accessToken: string
  tokenType: 'Bearer'
}

type ReissueRequest = (
  path: string,
  options: ApiRequestOptions,
) => Promise<ReissueTokenResponse | undefined>

export async function reissueAccessToken(refreshToken: string, request: ReissueRequest) {
  const response = await request('/auth/reissue', {
    method: 'POST',
    body: { refreshToken },
    includeAuth: false,
  })
  if (
    !response ||
    typeof response.accessToken !== 'string' ||
    !response.accessToken ||
    response.tokenType !== 'Bearer'
  ) {
    throw new ApiError('토큰 재발급 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response.accessToken
}
