import { Link } from 'react-router'
import { routePaths } from '../app/routePaths'
import { AuthPageLayout } from '../components/ui/AuthPageLayout'

export function NotFoundPage() {
  return (
    <AuthPageLayout
      className="not-found-page"
      headingId="not-found-title"
      eyebrow="PAGE NOT FOUND"
      title="페이지를 찾을 수 없습니다."
      description="입력한 주소를 확인하거나 홈으로 돌아가 주세요."
    >
      <Link className="auth-return-link primary-action" to={routePaths.home}>
        홈으로 돌아가기
      </Link>
    </AuthPageLayout>
  )
}
