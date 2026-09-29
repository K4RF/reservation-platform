import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { signUpMember } from '../../api/member'
import { ApiError } from '../../api/errors'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { validateSignUp } from './signupValidation'
import type { SignUpFieldErrors } from './signupValidation'

export function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<SignUpFieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    const request = { email: email.trim(), password }
    const validationErrors = validateSignUp(request)
    setErrors(validationErrors)
    setFormError('')
    if (validationErrors.email || validationErrors.password) return

    inFlight.current = true
    setSubmitting(true)
    let succeeded = false
    try {
      await signUpMember(request)
      succeeded = true
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'MEMBER_001') {
          setErrors({ email: '이미 가입된 이메일입니다.' })
        } else if (error.kind === 'http' && error.category === 'bad_request') {
          const nextErrors: SignUpFieldErrors = {}
          for (const fieldError of error.fieldErrors) {
            if (fieldError.field === 'email' || fieldError.field === 'password') {
              nextErrors[fieldError.field] = fieldError.message
            }
          }
          setErrors(nextErrors)
          if (!nextErrors.email && !nextErrors.password) {
            setFormError('입력값을 다시 확인해 주세요.')
          }
        } else if (error.kind === 'network' || error.kind === 'timeout') {
          setFormError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        } else {
          setFormError('회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        }
      } else {
        setFormError('회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
    if (succeeded) onSuccess()
  }

  return (
    <form className="signup-form" noValidate onSubmit={handleSubmit} aria-busy={submitting}>
      <div className="form-field">
        <label htmlFor="signup-email">이메일</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          onChange={(event) => {
            setEmail(event.target.value)
            setErrors((current) => ({ ...current, email: undefined }))
          }}
        />
        {errors.email && (
          <p id="signup-email-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="signup-password">비밀번호</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'signup-password-error' : undefined}
          onChange={(event) => {
            setPassword(event.target.value)
            setErrors((current) => ({ ...current, password: undefined }))
          }}
        />
        {errors.password && (
          <p id="signup-password-error" role="alert">
            {errors.password}
          </p>
        )}
      </div>
      {formError && <ErrorState message={formError} />}
      {submitting && <LoadingState message="회원가입을 처리하고 있습니다." />}
      <button type="submit" disabled={submitting}>
        회원가입
      </button>
    </form>
  )
}
