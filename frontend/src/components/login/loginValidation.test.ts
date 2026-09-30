import { describe, expect, it } from 'vitest'
import { validateLogin } from './loginValidation'

describe('validateLogin', () => {
  it('requires both credentials', () => {
    expect(validateLogin({ email: ' ', password: ' ' })).toEqual({
      email: '이메일을 입력해 주세요.',
      password: '비밀번호를 입력해 주세요.',
    })
  })

  it('checks email format and backend upper bounds', () => {
    expect(validateLogin({ email: 'invalid', password: 'x'.repeat(73) })).toEqual({
      email: '올바른 이메일 형식을 입력해 주세요.',
      password: '비밀번호는 72자 이하여야 합니다.',
    })
    expect(validateLogin({ email: `${'a'.repeat(251)}@b.co`, password: 'valid' })).toEqual({
      email: '이메일은 255자 이하여야 합니다.',
    })
  })

  it('does not impose the signup-only minimum password length on login', () => {
    expect(validateLogin({ email: 'member@example.com', password: 'short' })).toEqual({})
  })
})
