import { describe, expect, it } from 'vitest'
import { validateSignUp } from './signupValidation'

describe('validateSignUp', () => {
  it('requires an email and password', () => {
    expect(validateSignUp({ email: ' ', password: ' ' })).toEqual({
      email: '이메일을 입력해 주세요.',
      password: '비밀번호를 입력해 주세요.',
    })
  })

  it('checks email format and backend field size limits', () => {
    expect(validateSignUp({ email: 'not-an-email', password: 'short' })).toEqual({
      email: '올바른 이메일 형식을 입력해 주세요.',
      password: '비밀번호는 8자 이상 72자 이하여야 합니다.',
    })
    expect(validateSignUp({ email: `${'a'.repeat(251)}@b.co`, password: 'a'.repeat(73) })).toEqual({
      email: '이메일은 255자 이하여야 합니다.',
      password: '비밀번호는 8자 이상 72자 이하여야 합니다.',
    })
  })

  it('accepts inputs matching the signup contract', () => {
    expect(validateSignUp({ email: 'member@example.com', password: 'Password123!' })).toEqual({})
  })
})
