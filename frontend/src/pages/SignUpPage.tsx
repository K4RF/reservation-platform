import { Link, useLocation, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { authReturnDestination, safeLoginReturn } from '../app/loginReturn'
import { SignUpForm } from '../components/signup/SignUpForm'
import { AuthExploreLink, AuthPageLayout } from '../components/ui/AuthPageLayout'

export function SignUpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = safeLoginReturn(location.state?.from)
  const destination = authReturnDestination(returnPath)

  return (
    <AuthPageLayout
      headingId="signup-title"
      eyebrow="BEGIN YOUR JOURNEY"
      title="회원가입"
      description="여행을 예약하고 일정을 관리할 계정을 만드세요."
    >
      <SignUpForm
        onSuccess={() =>
          navigate(routePaths.login, {
            state: { from: returnPath, signupCompleted: true },
            replace: true,
          })
        }
      />
      <div className="auth-next">
        <p>
          이미 계정이 있나요?{' '}
          <Link to={routePaths.login} state={{ from: returnPath }}>
            로그인
          </Link>
        </p>
        <AuthExploreLink to={destination.explore} />
      </div>
    </AuthPageLayout>
  )
}
