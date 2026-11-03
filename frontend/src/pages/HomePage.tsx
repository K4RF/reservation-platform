import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../state/useAuth'
import { routePaths } from '../app/routePaths'
import { parseSearchQuery } from '../components/accommodation/searchQuery'
import { CompactSearchBar } from '../components/room/CompactSearchBar'
import { HomeCatalog } from '../components/accommodation/HomeCatalog'
import heroLarge from '../assets/brand/home-a1-1600.webp'
import heroSmall from '../assets/brand/home-a1-800.webp'

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
            <span className="home-headline-lead">Somewhere</span>{' '}
            <span>
              you can <em>slow down.</em>
            </span>
          </h1>
          <p className="home-hero-description">
            일상에서 한 걸음, 당신만의 머무름.
            <br />
            마음이 먼저 도착하는 곳을 찾아보세요.
          </p>
        </div>
        <section className="home-search-section" aria-labelledby="home-search-title">
          <div className="home-search-header sr-only">
            <h2 id="home-search-title">어디로 떠나고 싶으세요?</h2>
          </div>
          <form className="home-search" aria-label="여행 검색" onSubmit={search}>
            <CompactSearchBar
              prefix="home"
              city={{}}
              required={false}
              dates={dates}
              onDateChange={(field, value) => {
                setDates((current) => ({ ...current, [field]: value }))
                setError('')
              }}
              guestCount={guestCount}
              onGuestChange={(value) => {
                setGuestCount(value)
                setError('')
              }}
              actionLabel="숙소 찾기"
              error={error}
            />
          </form>
        </section>
        <div className="home-hero-footer">
          <a className="home-search-jump" href="#home-city">
            여행 검색으로 이동 ↓
          </a>
          <p className="home-image-note" role={imageFailed ? 'status' : undefined}>
            {imageFailed
              ? '브랜드 이미지를 불러오지 못했습니다. 검색은 계속 이용할 수 있습니다.'
              : 'AI 생성 브랜드 이미지 · 실제 숙소 사진이 아닙니다.'}
          </p>
        </div>
      </div>
      <section className="home-discovery" aria-labelledby="home-discovery-title">
        <div className="home-discovery-header">
          <div>
            <p className="eyebrow">A DIFFERENT PACE</p>
            <h2 id="home-discovery-title">Stay for the feeling.</h2>
            <p className="home-discovery-description">사진 너머, 머물고 싶은 공간을 만나보세요.</p>
          </div>
          <Link className="home-catalog-link" to={routePaths.accommodations}>
            전체 숙소 →
          </Link>
        </div>
        <HomeCatalog />
      </section>
      {signupCompleted && (
        <p role="status">회원가입이 완료되었습니다. 로그인 화면에서 계속 진행해 주세요.</p>
      )}
      {state.status === 'authenticated' && (
        <p className="sr-only" role="status">
          로그인 상태입니다.
        </p>
      )}
    </section>
  )
}
