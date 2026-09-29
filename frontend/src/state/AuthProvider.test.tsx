import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function AuthProbe() {
  const { state, dispatch } = useAuth()
  return (
    <>
      <output>{state.status === 'authenticated' ? state.user.email : 'anonymous'}</output>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: 'authenticated',
            user: { memberId: 1, email: 'member@example.com', role: 'USER' },
          })
        }
      >
        Set user
      </button>
      <button type="button" onClick={() => dispatch({ type: 'signed_out' })}>
        Clear user
      </button>
    </>
  )
}

describe('AuthProvider', () => {
  it('shares auth state and updates consumers', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('anonymous')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set user' }))
    expect(screen.getByText('member@example.com')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear user' }))
    expect(screen.getByText('anonymous')).toBeTruthy()
  })
})
