import { useReducer } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { authReducer, initialAuthState } from './authState'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState)

  return <AuthContext.Provider value={{ state, dispatch }}>{children}</AuthContext.Provider>
}
