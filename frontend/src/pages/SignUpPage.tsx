import { Link, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { SignUpForm } from '../components/signup/SignUpForm'

export function SignUpPage() {
  const navigate = useNavigate()

  return (
    <section className="page-content auth-page signup-page" aria-labelledby="signup-title">
      <header className="auth-header">
        <h1 id="signup-title">회원가입</h1>
        <p>이메일과 비밀번호로 계정을 만드세요.</p>
      </header>
      <SignUpForm
        onSuccess={() =>
          navigate(routePaths.home, { state: { signupCompleted: true }, replace: true })
        }
      />
      <p className="auth-switch">
        이미 계정이 있나요? <Link to={routePaths.login}>로그인</Link>
      </p>
    </section>
  )
}
