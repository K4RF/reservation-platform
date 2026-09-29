import { useLocation } from 'react-router'

export function HomePage() {
  const location = useLocation()
  const signupCompleted = location.state?.signupCompleted === true

  return (
    <section className="page-content">
      <h1>Reservation Platform</h1>
      <p>프런트엔드 개발 환경이 준비되었습니다.</p>
      {signupCompleted && (
        <p role="status">회원가입이 완료되었습니다. 로그인 기능은 추후 제공됩니다.</p>
      )}
    </section>
  )
}
