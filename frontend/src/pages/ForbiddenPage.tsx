import { Link } from 'react-router'
import { routePaths } from '../app/routePaths'

export function ForbiddenPage() {
  return (
    <section className="page-content">
      <h1>접근 권한이 없습니다.</h1>
      <p role="alert">이 화면에 접근할 수 있는 역할이 아닙니다.</p>
      <Link to={routePaths.home}>홈으로 돌아가기</Link>
    </section>
  )
}
