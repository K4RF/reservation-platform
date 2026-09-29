import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { AuthAction, AuthState } from './authState'

export interface AuthContextValue {
  state: AuthState
  dispatch: Dispatch<AuthAction>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
