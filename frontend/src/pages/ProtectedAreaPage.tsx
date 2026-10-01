export function ProtectedAreaPage({ admin = false }: { admin?: boolean }) {
  return (
    <section className="page-content">
      <h1>{admin ? '관리자 영역' : '내 예약'}</h1>
      <p>
        {admin ? '관리자 전용 접근이 확인되었습니다.' : '로그인 회원 전용 접근이 확인되었습니다.'}
      </p>
      <p>실제 {admin ? '관리' : '예약 조회'} 기능은 후속 작업에서 연결합니다.</p>
    </section>
  )
}
