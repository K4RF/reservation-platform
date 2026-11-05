import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { createGoogleLoginStartUrl, googleOAuth2BackendUrl } from '../api/googleOAuth2'
import { routePaths } from '../app/routePaths'
import { LoginForm } from '../components/login/LoginForm'
import { useAuth } from '../state/useAuth'
import { authReturnDestination, safeLoginReturn, saveGoogleReturn } from '../app/loginReturn'
import { AuthExploreLink, AuthPageLayout } from '../components/ui/AuthPageLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useAuth()
  const [googleError, setGoogleError] = useState('')
  const returnPath = safeLoginReturn(location.state?.from)
  const destination = authReturnDestination(returnPath)

  function startGoogleLogin() {
    try {
      const url = createGoogleLoginStartUrl(googleOAuth2BackendUrl)
      saveGoogleReturn(returnPath)
      window.location.assign(url)
    } catch {
      setGoogleError(
        'Google 로그인을 시작하지 못했습니다. 다시 시도하거나 이메일로 로그인해 주세요.',
      )
    }
  }

  return (
    <AuthPageLayout
      headingId="login-title"
      eyebrow="WELCOME BACK"
      title="로그인"
      description={destination.purpose}
    >
      {location.state?.signupCompleted === true && (
        <p className="auth-success" role="status">
          회원가입이 완료되었습니다. 가입한 이메일로 로그인해 주세요.
        </p>
      )}
      {state.status === 'reauth_required' && (
        <p role="alert">인증이 만료되었습니다. 다시 로그인해 주세요.</p>
      )}
      {location.state?.logoutResult === 'success' && (
        <p className="auth-success" role="status">
          로그아웃되었습니다.
        </p>
      )}
      {location.state?.logoutResult === 'server_unconfirmed' && (
        <p role="alert">이 브라우저의 인증은 종료했지만 서버 로그아웃은 확인하지 못했습니다.</p>
      )}
      <LoginForm
        onSuccess={() => {
          navigate(returnPath, { replace: true })
        }}
      />
      <div className="auth-divider" aria-hidden="true">
        또는
      </div>
      <button
        className="google-login-button"
        type="button"
        aria-describedby="google-login-hint"
        onClick={startGoogleLogin}
      >
        Google로 로그인
      </button>
      <p className="sr-only" id="google-login-hint">
        Google 인증 화면으로 이동합니다.
      </p>
      {googleError && <p role="alert">{googleError}</p>}
      <div className="auth-next">
        <p>
          계정이 없나요?{' '}
          <Link to={routePaths.signup} state={{ from: returnPath }}>
            회원가입
          </Link>
        </p>
        <AuthExploreLink to={destination.explore} />
      </div>
    </AuthPageLayout>
  )
}
