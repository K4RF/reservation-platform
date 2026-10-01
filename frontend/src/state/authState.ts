import type { UserRole } from './accessToken'

export type AuthState =
  | { status: 'anonymous'; user: null; expiresAt: null }
  | { status: 'reauth_required'; user: null; expiresAt: null }
  | { status: 'loading'; user: null; expiresAt: null }
  | { status: 'authenticated'; user: null; expiresAt: number; role: UserRole | null }

export type AuthAction =
  | { type: 'authenticated'; expiresAt: number; role: UserRole | null }
  | { type: 'loading' }
  | { type: 'signed_out' }
  | { type: 'reauth_required' }

export const initialAuthState: AuthState = { status: 'anonymous', user: null, expiresAt: null }

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'authenticated':
      return { status: 'authenticated', user: null, expiresAt: action.expiresAt, role: action.role }
    case 'loading':
      return { status: 'loading', user: null, expiresAt: null }
    case 'signed_out':
      return initialAuthState
    case 'reauth_required':
      return { status: 'reauth_required', user: null, expiresAt: null }
  }
}
