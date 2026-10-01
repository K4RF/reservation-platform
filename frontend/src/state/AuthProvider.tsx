import { useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { logoutFromBackend } from '../api/auth'
import { ensureFreshAccessToken } from '../api/client'
import { authReducer, initialAuthState } from './authState'
import type { AuthState } from './authState'
import type { LogoutResult } from './authTypes'
import {
  clearAccessToken,
  getAccessTokenExpiry,
  getRefreshToken,
  getSessionVersion,
  getRoleHint,
  isAuthRefreshing,
  isLoginRequired,
  setTokenPair,
  subscribeAccessToken,
} from './accessToken'

function restoreAuthState(): AuthState {
  const expiresAt = getAccessTokenExpiry()
  if (isLoginRequired()) return { status: 'reauth_required', user: null, expiresAt: null }
  if (isAuthRefreshing() || (expiresAt !== null && expiresAt <= Date.now() && getRefreshToken())) {
    return { status: 'loading', user: null, expiresAt: null }
  }
  return expiresAt === null
    ? initialAuthState
    : { status: 'authenticated', user: null, expiresAt, role: getRoleHint() }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, restoreAuthState)

  async function logout(): Promise<LogoutResult> {
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
        const next = restoreAuthState()
        dispatch(
          next.status === 'authenticated'
            ? { type: 'authenticated', expiresAt: next.expiresAt, role: next.role }
            : { type: next.status === 'anonymous' ? 'signed_out' : next.status },
        )
      }),
    [],
  )

  useEffect(() => {
    if (state.status === 'loading') {
      void ensureFreshAccessToken().catch(() => undefined)
      return
    }
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
