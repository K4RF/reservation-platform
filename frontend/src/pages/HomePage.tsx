import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../state/useAuth'
import { routePaths } from '../app/routePaths'
import { parseSearchQuery } from '../components/accommodation/searchQuery'
import { StayDateFields } from '../components/room/StayDateFields'
import { GuestCountField } from '../components/room/GuestCountField'
import heroLarge from '../assets/brand/coast-hero-1600.webp'
import heroSmall from '../assets/brand/coast-hero-800.webp'

export function HomePage() {
  const location = useLocation()
  const signupCompleted = location.state?.signupCompleted === true
  const { state } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [dates, setDates] = useState({ checkInDate: '', checkOutDate: '' })
  const [guestCount, setGuestCount] = useState('1')
  const [imageFailed, setImageFailed] = useState(false)
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
        {!imageFailed && (
          <img
            className="home-hero-image"
            src={heroLarge}
            srcSet={`${heroSmall} 800w, ${heroLarge} 1600w`}
            sizes="100vw"
            width={1600}
            height={900}
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="home-hero-copy">
          <p className="home-hero-eyebrow">A JOURNEY WORTH STAYING FOR</p>
          <h1>
            Somewhere you can <em>slow down.</em>
          </h1>
          <p className="home-hero-description">
            일상에서 한 걸음, 당신만의 머무름.
            <br />
            마음이 먼저 도착하는 곳을 찾아보세요.
          </p>
          <a className="home-search-jump" href="#home-search-title">
            여행 검색으로 이동 ↓
          </a>
        </div>
        <p className="home-image-note" role={imageFailed ? 'status' : undefined}>
          {imageFailed
            ? '브랜드 이미지를 불러오지 못했습니다. 검색은 계속 이용할 수 있습니다.'
            : 'AI 생성 브랜드 이미지 · 실제 숙소 사진이 아닙니다.'}
        </p>
      </div>
      <section className="home-search-section" aria-labelledby="home-search-title">
        <div className="home-search-header">
          <h2 id="home-search-title" tabIndex={-1}>
            어디로 떠나고 싶으세요?
          </h2>
          <p>도시와 숙박 날짜, 전체 인원을 선택해 보세요.</p>
        </div>
        <form className="home-search" aria-label="여행 검색" onSubmit={search}>
          <div className="form-field">
            <label htmlFor="home-city">어디로 떠나세요?</label>
            <input id="home-city" name="city" maxLength={100} placeholder="도시의 정확한 이름" />
          </div>
          <StayDateFields
            prefix="home"
            labelPrefix=""
            required={false}
            draft={dates}
            onChange={(field, value) => {
              setDates((current) => ({ ...current, [field]: value }))
              setError('')
            }}
          />
          <GuestCountField
            id="home-guests"
            label="인원"
            value={guestCount}
            required={false}
            onChange={(value) => {
              setGuestCount(value)
              setError('')
            }}
          />
          <button type="submit">숙소 찾기</button>
          {error && <p role="alert">{error}</p>}
        </form>
      </section>
      <section className="home-discovery" aria-labelledby="home-discovery-title">
        <div className="home-discovery-header">
          <div>
            <p className="eyebrow">A DIFFERENT PACE</p>
            <h2 id="home-discovery-title">나에게 맞는 머무름.</h2>
          </div>
          <Link className="home-catalog-link" to={routePaths.accommodations}>
            전체 숙소 둘러보기 →
          </Link>
        </div>
        <div className="home-guide">
          <div>
            <span className="eyebrow">01 / EXPLORE</span>
            <h3>나에게 맞는 숙소</h3>
            <p>지역과 편의시설로 원하는 공간을 좁혀보세요.</p>
          </div>
          <div>
            <span className="eyebrow">02 / CHECK</span>
            <h3>실제 가능한 객실</h3>
            <p>날짜별 재고와 숙박 인원으로 예약 가능 여부를 확인합니다.</p>
          </div>
          <div>
            <span className="eyebrow">03 / BOOK</span>
            <h3>확인하고 예약하기</h3>
            <p>숙박일별 요금을 확인하고, 로그인 후 예약자 정보를 입력하세요.</p>
          </div>
        </div>
      </section>
      {signupCompleted && (
        <p role="status">회원가입이 완료되었습니다. 로그인 화면에서 계속 진행해 주세요.</p>
      )}
      {state.status === 'authenticated' && <p role="status">로그인 상태입니다.</p>}
    </section>
  )
}
