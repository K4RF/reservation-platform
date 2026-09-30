import { createContext } from 'react'
import type { AuthState } from './authState'

export interface AuthContextValue {
  state: AuthState
  signIn: (accessToken: string) => void
  clearAuthentication: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
