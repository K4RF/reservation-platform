export interface AuthUser {
  memberId: number
  email: string
  role: 'USER' | 'ADMIN'
}

export type AuthState =
  | { status: 'anonymous'; user: null }
  | { status: 'login_response_received'; user: null }
  | { status: 'authenticated'; user: AuthUser }

export type AuthAction =
  | { type: 'login_response_received' }
  | { type: 'authenticated'; user: AuthUser }
  | { type: 'signed_out' }

export const initialAuthState: AuthState = { status: 'anonymous', user: null }

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'login_response_received':
      return { status: 'login_response_received', user: null }
    case 'authenticated':
      return { status: 'authenticated', user: action.user }
    case 'signed_out':
      return initialAuthState
  }
}
