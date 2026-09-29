import type { SignUpRequest } from '../../api/member'

export interface SignUpFieldErrors {
  email?: string
  password?: string
}

export function validateSignUp(request: SignUpRequest): SignUpFieldErrors {
  const errors: SignUpFieldErrors = {}
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
  } else if (request.password.length < 8 || request.password.length > 72) {
    errors.password = '비밀번호는 8자 이상 72자 이하여야 합니다.'
  }

  return errors
}
