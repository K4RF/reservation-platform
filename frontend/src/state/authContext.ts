import { createContext } from 'react'
import type { AuthState } from './authState'

export interface AuthContextValue {
  state: AuthState
  signIn: (accessToken: string, refreshToken: string) => void
  logout: () => Promise<'success' | 'server_unconfirmed' | 'superseded'>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
