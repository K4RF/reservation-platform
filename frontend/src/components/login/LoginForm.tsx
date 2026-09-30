import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { loginWithEmail } from '../../api/auth'
import { ApiError } from '../../api/errors'
import { useAuth } from '../../state/useAuth'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { validateLogin } from './loginValidation'
import type { LoginFieldErrors } from './loginValidation'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    const request = { email: email.trim(), password }
    const validationErrors = validateLogin(request)
    setErrors(validationErrors)
    setFormError('')
    if (validationErrors.email || validationErrors.password) return

    inFlight.current = true
    setSubmitting(true)
    let succeeded = false
    try {
      const response = await loginWithEmail(request)
      signIn(response.accessToken)
      succeeded = true
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.kind === 'http' && error.code === 'AUTH_003') {
          setFormError('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (error.kind === 'http' && error.category === 'bad_request') {
          const nextErrors: LoginFieldErrors = {}
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
          setFormError('로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        }
      } else {
        setFormError('로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
    if (succeeded) onSuccess()
  }

  return (
    <form className="login-form" noValidate onSubmit={handleSubmit} aria-busy={submitting}>
      <div className="form-field">
        <label htmlFor="login-email">이메일</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          onChange={(event) => {
            setEmail(event.target.value)
            setErrors((current) => ({ ...current, email: undefined }))
          }}
        />
        {errors.email && (
          <p id="login-email-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="login-password">비밀번호</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          onChange={(event) => {
            setPassword(event.target.value)
            setErrors((current) => ({ ...current, password: undefined }))
          }}
        />
        {errors.password && (
          <p id="login-password-error" role="alert">
            {errors.password}
          </p>
        )}
      </div>
      {formError && <ErrorState message={formError} />}
      {submitting && <LoadingState message="로그인을 처리하고 있습니다." />}
      <button type="submit" disabled={submitting}>
        로그인
      </button>
    </form>
  )
}
