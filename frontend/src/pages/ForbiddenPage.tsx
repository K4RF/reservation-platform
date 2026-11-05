import { Link } from 'react-router'
import { routePaths } from '../app/routePaths'
import { AuthPageLayout } from '../components/ui/AuthPageLayout'

export function ForbiddenPage() {
  return (
    <AuthPageLayout
      headingId="forbidden-title"
      eyebrow="ACCESS RESTRICTED"
      title="접근 권한이 없습니다."
      variant="notice"
      description="현재 계정으로는 이 화면을 열 수 없습니다."
    >
      <div className="auth-actions">
        <Link className="auth-return-link primary-action" to={routePaths.accommodations}>
          숙소 둘러보기
        </Link>
        <Link className="auth-return-link" to={routePaths.home}>
          홈으로 돌아가기
        </Link>
      </div>
    </AuthPageLayout>
  )
}
