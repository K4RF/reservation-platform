import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../state/useAuth'
import { routePaths } from '../app/routePaths'
import { parseSearchQuery } from '../components/accommodation/searchQuery'

export function HomePage() {
  const location = useLocation()
  const signupCompleted = location.state?.signupCompleted === true
  const { state } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (String(value).trim()) query.set(key, String(value).trim())
    }
    const parsed = parseSearchQuery(query)
    if (!parsed.valid) {
      setError(parsed.message)
      return
    }
    navigate(`${routePaths.accommodations}?${query}`)
  }

  return (
    <section className="home-page">
      <div className="home-hero">
        <p className="eyebrow">FIND YOUR NEXT STAY</p>
        <h1>Reservation Platform</h1>
        <p className="hero-heading">
          잠시 머물 곳에서,
          <br />
          새로운 여정이 시작됩니다.
        </p>
        <p>
          숙소를 둘러보고 날짜와 인원에 맞는 객실을 찾아보세요.
          <br />
          로그인 없이 탐색하고, 마음에 드는 객실을 예약할 때 로그인하세요.
        </p>
        <form className="home-search" aria-label="여행 검색" onSubmit={search}>
          <div className="form-field">
            <label htmlFor="home-city">어디로 떠나세요?</label>
            <input id="home-city" name="city" maxLength={100} placeholder="도시의 정확한 이름" />
          </div>
          <div className="form-field">
            <label htmlFor="home-in">체크인</label>
            <input id="home-in" name="checkInDate" type="date" />
          </div>
          <div className="form-field">
            <label htmlFor="home-out">체크아웃</label>
            <input id="home-out" name="checkOutDate" type="date" />
          </div>
          <div className="form-field">
            <label htmlFor="home-guests">인원</label>
            <input
              id="home-guests"
              name="guestCount"
              type="number"
              min={1}
              max={2147483647}
              step={1}
              defaultValue={1}
            />
          </div>
          <button type="submit">숙소 찾기</button>
          {error && <p role="alert">{error}</p>}
        </form>
      </div>
      <div className="home-guide">
        <div>
          <span className="eyebrow">01 / EXPLORE</span>
          <h2>나에게 맞는 숙소</h2>
          <p>지역과 편의시설로 원하는 공간을 좁혀보세요.</p>
        </div>
        <div>
          <span className="eyebrow">02 / CHECK</span>
          <h2>실제 가능한 객실</h2>
          <p>날짜별 재고와 숙박 인원으로 예약 가능 여부를 확인합니다.</p>
        </div>
        <div>
          <span className="eyebrow">03 / BOOK</span>
          <h2>확인하고 예약하기</h2>
          <p>숙박일별 요금을 확인하고, 로그인 후 예약자 정보를 입력하세요.</p>
        </div>
      </div>
      <Link className="home-link" to={routePaths.accommodations}>
        전체 숙소 둘러보기 →
      </Link>
      {signupCompleted && (
        <p role="status">회원가입이 완료되었습니다. 로그인 화면에서 계속 진행해 주세요.</p>
      )}
      {state.status === 'authenticated' && <p role="status">로그인 상태입니다.</p>}
    </section>
  )
}
