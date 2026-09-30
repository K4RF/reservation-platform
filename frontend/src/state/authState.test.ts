import { describe, expect, it } from 'vitest'
import { authReducer, initialAuthState } from './authState'

describe('auth state', () => {
  it('starts anonymous with no user', () => {
    expect(initialAuthState).toEqual({ status: 'anonymous', user: null })
  })

  it('stores user identity and clears it when signed out', () => {
    const user = { memberId: 1, email: 'member@example.com', role: 'USER' } as const
    const authenticated = authReducer(initialAuthState, { type: 'authenticated', user })

    expect(authenticated).toEqual({ status: 'authenticated', user })
    expect(authReducer(authenticated, { type: 'signed_out' })).toEqual(initialAuthState)
  })

  it('records a successful login response without treating the visitor as authenticated', () => {
    const received = authReducer(initialAuthState, { type: 'login_response_received' })

    expect(received).toEqual({ status: 'login_response_received', user: null })
    expect(authReducer(received, { type: 'signed_out' })).toEqual(initialAuthState)
  })
})
