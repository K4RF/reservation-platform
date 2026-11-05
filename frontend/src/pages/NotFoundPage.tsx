import { Link } from 'react-router'
import { routePaths } from '../app/routePaths'
import { AuthExploreLink, AuthPageLayout } from '../components/ui/AuthPageLayout'

export function NotFoundPage() {
  return (
    <AuthPageLayout
      headingId="not-found-title"
      eyebrow="PAGE NOT FOUND"
      title="페이지를 찾을 수 없습니다."
      variant="notice"
      description="주소가 바뀌었거나 더 이상 열 수 없는 페이지입니다."
    >
      <div className="auth-actions">
        <Link className="auth-return-link primary-action" to={routePaths.home}>
          홈으로 돌아가기
        </Link>
        <AuthExploreLink />
      </div>
    </AuthPageLayout>
  )
}
