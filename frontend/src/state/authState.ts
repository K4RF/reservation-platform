export type AuthState =
  | { status: 'anonymous'; user: null; expiresAt: null }
  | { status: 'authenticated'; user: null; expiresAt: number }

export type AuthAction = { type: 'authenticated'; expiresAt: number } | { type: 'signed_out' }

export const initialAuthState: AuthState = { status: 'anonymous', user: null, expiresAt: null }

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'authenticated':
      return { status: 'authenticated', user: null, expiresAt: action.expiresAt }
    case 'signed_out':
      return initialAuthState
  }
}
