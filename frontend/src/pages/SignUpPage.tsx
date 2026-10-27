import { Link, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { SignUpForm } from '../components/signup/SignUpForm'
import { AuthPageLayout } from '../components/ui/AuthPageLayout'

export function SignUpPage() {
  const navigate = useNavigate()

  return (
    <AuthPageLayout
      className="signup-page"
      headingId="signup-title"
      eyebrow="BEGIN YOUR JOURNEY"
      title="회원가입"
      description="이메일과 비밀번호로 계정을 만드세요."
    >
      <SignUpForm
        onSuccess={() =>
          navigate(routePaths.home, { state: { signupCompleted: true }, replace: true })
        }
      />
      <p className="auth-note">회원가입만으로 로그인되지는 않습니다. 가입 후 로그인해 주세요.</p>
      <p className="auth-switch">
        이미 계정이 있나요? <Link to={routePaths.login}>로그인</Link>
      </p>
    </AuthPageLayout>
  )
}
