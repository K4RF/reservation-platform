import { Link } from 'react-router'
import { routePaths } from '../app/routePaths'

// Route handoff only: the detail API and booking flow belong to subsequent issues.
export function AccommodationDetailPendingPage() {
  return (
    <section className="page-content">
      <h1>숙소 상세 화면 준비 중</h1>
      <p>숙소 상세 조회와 예약 화면은 후속 작업에서 제공됩니다.</p>
      <Link to={routePaths.accommodations}>숙소 검색으로 돌아가기</Link>
    </section>
  )
}
