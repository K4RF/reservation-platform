import { describe, expect, it, vi } from 'vitest'
import { reissueAccessToken } from './reissue'

describe('reissueAccessToken', () => {
  it('uses the backend reissue contract without an Authorization header', async () => {
    const request = vi.fn().mockResolvedValue({ accessToken: 'new-access', tokenType: 'Bearer' })

    await expect(reissueAccessToken('refresh-token', request)).resolves.toBe('new-access')
    expect(request).toHaveBeenCalledWith('/auth/reissue', {
      method: 'POST',
      body: { refreshToken: 'refresh-token' },
      includeAuth: false,
    })
  })

  it.each([
    undefined,
    { accessToken: '', tokenType: 'Bearer' },
    { accessToken: 'a', tokenType: 'Basic' },
  ])('rejects a malformed success response', async (response) => {
    const request = vi.fn().mockResolvedValue(response)

    await expect(reissueAccessToken('refresh-token', request)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
})
