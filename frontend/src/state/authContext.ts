import { createContext } from 'react'
import type { AuthState } from './authState'
import type { LogoutResult } from './authTypes'

export interface AuthContextValue {
  state: AuthState
  signIn: (accessToken: string, refreshToken: string) => void
  logout: () => Promise<LogoutResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
