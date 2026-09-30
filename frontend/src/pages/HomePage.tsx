import { useLocation } from 'react-router'
import { useAuth } from '../state/useAuth'

export function HomePage() {
  const location = useLocation()
  const signupCompleted = location.state?.signupCompleted === true
  const { state } = useAuth()

  return (
    <section className="page-content">
      <h1>Reservation Platform</h1>
      <p>프런트엔드 개발 환경이 준비되었습니다.</p>
      {signupCompleted && (
        <p role="status">회원가입이 완료되었습니다. 로그인 화면에서 계속 진행해 주세요.</p>
      )}
      {state.status === 'login_response_received' && (
        <p role="status">
          로그인 응답을 확인했습니다. 인증 정보 유지와 보호된 기능은 후속 작업에서 제공됩니다.
        </p>
      )}
    </section>
  )
}
