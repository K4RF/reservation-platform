import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { createGoogleLoginStartUrl, googleOAuth2BackendUrl } from '../api/googleOAuth2'
import { routePaths } from '../app/routePaths'
import { LoginForm } from '../components/login/LoginForm'
import { useAuth } from '../state/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useAuth()
  const [googleError, setGoogleError] = useState('')

  function startGoogleLogin() {
    try {
      window.location.assign(createGoogleLoginStartUrl(googleOAuth2BackendUrl))
    } catch {
      setGoogleError('Google 로그인을 시작하지 못했습니다. 설정을 확인하고 다시 시도해 주세요.')
    }
  }

  return (
    <section className="page-content login-page">
      <h1>로그인</h1>
      <p>이메일과 비밀번호로 로그인하세요.</p>
      {state.status === 'reauth_required' && (
        <p role="alert">인증이 만료되었습니다. 다시 로그인해 주세요.</p>
      )}
      {location.state?.logoutResult === 'success' && <p role="status">로그아웃되었습니다.</p>}
      {location.state?.logoutResult === 'server_unconfirmed' && (
        <p role="alert">이 브라우저의 인증은 종료했지만 서버 로그아웃은 확인하지 못했습니다.</p>
      )}
      <LoginForm
        onSuccess={() => {
          navigate(routePaths.home, { replace: true })
        }}
      />
      <button type="button" onClick={startGoogleLogin}>
        Google로 로그인
      </button>
      {googleError && <p role="alert">{googleError}</p>}
      <p>
        계정이 없나요? <Link to={routePaths.signup}>회원가입</Link>
      </p>
    </section>
  )
}
