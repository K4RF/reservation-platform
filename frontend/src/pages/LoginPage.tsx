import { Link, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { LoginForm } from '../components/login/LoginForm'

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <section className="page-content login-page">
      <h1>로그인</h1>
      <p>이메일과 비밀번호로 로그인하세요.</p>
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
