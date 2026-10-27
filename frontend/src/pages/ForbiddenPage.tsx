import { Link } from 'react-router'
import { routePaths } from '../app/routePaths'
import { AuthPageLayout } from '../components/ui/AuthPageLayout'

export function ForbiddenPage() {
  return (
    <AuthPageLayout
      className="forbidden-page"
      headingId="forbidden-title"
      eyebrow="ACCESS RESTRICTED"
      title="접근 권한이 없습니다."
      description="현재 계정의 접근 범위를 확인해 주세요."
    >
      <p role="alert">이 화면에 접근할 수 있는 역할이 아닙니다.</p>
      <Link className="auth-return-link primary-action" to={routePaths.home}>
        홈으로 돌아가기
      </Link>
    </AuthPageLayout>
  )
}
