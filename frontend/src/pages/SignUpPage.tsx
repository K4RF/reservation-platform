import { Link, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { SignUpForm } from '../components/signup/SignUpForm'

export function SignUpPage() {
  const navigate = useNavigate()

  return (
    <section className="page-content signup-page">
      <h1>회원가입</h1>
      <p>이메일과 비밀번호로 계정을 만드세요.</p>
      <SignUpForm
        onSuccess={() =>
          navigate(routePaths.home, { state: { signupCompleted: true }, replace: true })
        }
      />
      <p>
        이미 계정이 있나요? <Link to={routePaths.login}>로그인</Link>
      </p>
    </section>
  )
}
