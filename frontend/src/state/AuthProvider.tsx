import { useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { ensureFreshAccessToken } from '../api/client'
import { authReducer, initialAuthState } from './authState'
import type { AuthState } from './authState'
import {
  clearAccessToken,
  getAccessTokenExpiry,
  isLoginRequired,
  setTokenPair,
  subscribeAccessToken,
} from './accessToken'

function restoreAuthState(): AuthState {
  const expiresAt = getAccessTokenExpiry()
  if (isLoginRequired()) return { status: 'reauth_required', user: null, expiresAt: null }
  return expiresAt === null ? initialAuthState : { status: 'authenticated', user: null, expiresAt }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, restoreAuthState)

  useEffect(
    () =>
      subscribeAccessToken(() => {
        const expiresAt = getAccessTokenExpiry()
        dispatch(
          isLoginRequired()
            ? { type: 'reauth_required' }
            : expiresAt === null
              ? { type: 'signed_out' }
              : { type: 'authenticated', expiresAt },
        )
      }),
    [],
  )

  useEffect(() => {
    if (state.status !== 'authenticated') return
    let timeout: ReturnType<typeof setTimeout>
    const checkExpiry = () => {
      const remainingMs = state.expiresAt - Date.now()
      if (remainingMs <= 0) {
        void ensureFreshAccessToken().catch(() => undefined)
      } else {
        timeout = setTimeout(checkExpiry, Math.min(remainingMs, 2_147_483_647))
      }
    }
    checkExpiry()
    return () => clearTimeout(timeout)
  }, [state])

  return (
    <AuthContext.Provider
      value={{
        state,
        signIn: setTokenPair,
        clearAuthentication: clearAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
