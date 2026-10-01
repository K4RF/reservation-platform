import { useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { logoutFromBackend } from '../api/auth'
import { ensureFreshAccessToken } from '../api/client'
import { authReducer, initialAuthState } from './authState'
import type { AuthState } from './authState'
import {
  clearAccessToken,
  getAccessTokenExpiry,
  getRefreshToken,
  getSessionVersion,
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

  async function logout(): Promise<'success' | 'server_unconfirmed' | 'superseded'> {
    const sessionVersion = getSessionVersion()
    let result: 'success' | 'server_unconfirmed' = 'success'
    try {
      await logoutFromBackend()
    } catch {
      result = 'server_unconfirmed'
    }
    // A login completed while logout was in flight must not be discarded.
    if (getSessionVersion() !== sessionVersion && getRefreshToken() !== null) return 'superseded'
    clearAccessToken()
    return result
  }

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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
