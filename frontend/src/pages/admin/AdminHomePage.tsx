import { Link } from 'react-router'
import { adminSections, adminSectionPath } from '../../app/adminSections'
import { AdminPageHeading } from '../../components/admin/AdminPageHeading'

export function AdminHomePage() {
  return (
    <section aria-labelledby="admin-home-heading">
      <AdminPageHeading id="admin-home-heading" title="관리 홈" context="작업 영역 선택" />
      <p>관리 메뉴에서 작업 영역을 선택하세요.</p>
      <ul className="admin-area-list" aria-label="지원하는 관리 작업">
        {adminSections.map((section) => (
          <li key={section.path}>
            <h3>
              <Link to={adminSectionPath(section)}>{section.label}로 이동</Link>
            </h3>
            <p>{section.description}</p>
          </li>
        ))}
      </ul>
      <p role="status">
        숙소·객실 목록·생성·정보 수정·운영 상태 변경, 숙소 예약/취소 정책 입력과 단일 날짜의 객실
        적용 가격 조회·Override 생성/수정, 날짜 범위 재고 Calendar 조회와 단일 날짜의 총수량·판매
        상태 관리를 제공합니다.
      </p>
      <p>
        사용자·권한 관리, 전체 예약 관리, 매출·통계 Dashboard 및 결제·정산 기능은 제공하지 않습니다.
      </p>
      <p>새로고침하면 메모리 인증이 초기화됩니다. 다시 로그인한 뒤 원래 관리 경로로 돌아옵니다.</p>
    </section>
  )
}
