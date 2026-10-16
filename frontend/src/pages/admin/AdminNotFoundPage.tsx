import { Link } from 'react-router'
import { routePaths } from '../../app/routePaths'

export function AdminNotFoundPage() {
  return (
    <section aria-labelledby="admin-not-found-heading">
      <h2 id="admin-not-found-heading">관리 페이지를 찾을 수 없습니다.</h2>
      <p>지원하는 관리 메뉴를 선택하거나 관리 홈으로 돌아가 주세요.</p>
      <Link to={routePaths.admin}>관리 홈으로 돌아가기</Link>
    </section>
  )
}
