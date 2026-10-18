export function AdminHomePage() {
  return (
    <section aria-labelledby="admin-home-heading">
      <h2 id="admin-home-heading">관리 홈</h2>
      <p>관리 메뉴에서 작업 영역을 선택하세요.</p>
      <p role="status">
        숙소 목록·생성·정보 수정·운영 상태 변경과 예약/취소 정책 입력을 제공합니다. 객실·가격·재고
        화면의 API 연결은 후속 작업입니다.
      </p>
      <p>
        사용자·권한 관리, 전체 예약 관리, 매출·통계 Dashboard 및 결제·정산 기능은 제공하지 않습니다.
      </p>
      <p>새로고침하면 메모리 인증이 초기화됩니다. 다시 로그인한 뒤 원래 관리 경로로 돌아옵니다.</p>
    </section>
  )
}
