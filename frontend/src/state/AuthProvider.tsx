import { useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { authReducer, initialAuthState } from './authState'
import type { AuthState } from './authState'
import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenExpiry,
  setAccessToken,
  subscribeAccessToken,
} from './accessToken'

function restoreAuthState(): AuthState {
  const expiresAt = getAccessTokenExpiry()
  return expiresAt === null ? initialAuthState : { status: 'authenticated', user: null, expiresAt }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, restoreAuthState)

  useEffect(
    () =>
      subscribeAccessToken(() => {
        const expiresAt = getAccessTokenExpiry()
        dispatch(expiresAt === null ? { type: 'signed_out' } : { type: 'authenticated', expiresAt })
      }),
    [],
  )

  useEffect(() => {
    if (state.status !== 'authenticated') return
    let timeout: ReturnType<typeof setTimeout>
    const checkExpiry = () => {
      const remainingMs = state.expiresAt - Date.now()
      if (remainingMs <= 0) {
        getAccessToken()
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
        signIn: setAccessToken,
        clearAuthentication: clearAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
