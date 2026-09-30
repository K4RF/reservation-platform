import { describe, expect, it } from 'vitest'
import { authReducer, initialAuthState } from './authState'

describe('auth state', () => {
  it('starts anonymous with no user', () => {
    expect(initialAuthState).toEqual({ status: 'anonymous', user: null, expiresAt: null })
  })

  it('tracks the access expiry without claiming an unavailable user profile', () => {
    const authenticated = authReducer(initialAuthState, {
      type: 'authenticated',
      expiresAt: 1_800_000_000_000,
    })

    expect(authenticated).toEqual({
      status: 'authenticated',
      user: null,
      expiresAt: 1_800_000_000_000,
    })
    expect(authReducer(authenticated, { type: 'signed_out' })).toEqual(initialAuthState)
  })
})
