import type { LoginRequest } from '../../api/auth'

export interface LoginFieldErrors {
  email?: string
  password?: string
}

export function validateLogin(request: LoginRequest): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const email = request.email.trim()

  if (!email) {
    errors.email = '이메일을 입력해 주세요.'
  } else if (email.length > 255) {
    errors.email = '이메일은 255자 이하여야 합니다.'
  } else if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    errors.email = '올바른 이메일 형식을 입력해 주세요.'
  }

  if (!request.password.trim()) {
    errors.password = '비밀번호를 입력해 주세요.'
  } else if (request.password.length > 72) {
    errors.password = '비밀번호는 72자 이하여야 합니다.'
  }

  return errors
}
