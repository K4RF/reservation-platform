import { Link, useLocation, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { LoginForm } from '../components/login/LoginForm'
import { useAuth } from '../state/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useAuth()

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
      <p>
        계정이 없나요? <Link to={routePaths.signup}>회원가입</Link>
      </p>
    </section>
  )
}
