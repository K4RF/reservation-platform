import type { AccommodationResponse } from '../../api/accommodation'
import { toAccommodationCard } from './accommodationView'
import { CatalogMediaPlaceholder } from './CatalogMediaPlaceholder'

export function AccommodationInfo({ accommodation }: { accommodation: AccommodationResponse }) {
  const card = toAccommodationCard(accommodation)
  return (
    <section className="accommodation-info" aria-label="숙소 기본 정보">
      <div className="accommodation-detail-header">
        <p className="eyebrow">A CONSIDERED STAY</p>
        <h1>{card.name}</h1>
        <p className="catalog-status">{card.status}</p>
      </div>
      <CatalogMediaPlaceholder kind="accommodation" />
      <nav className="detail-section-nav" aria-label="숙소 상세 탐색">
        <a href="#accommodation-introduction">숙소 소개</a>
        <a className="detail-booking-entry" href="#availability-title">
          일정·객실 선택 ↓
        </a>
        <a href="#accommodation-operating-info">이용 안내</a>
        <a href="#room-list-title">객실 기본 정보</a>
      </nav>
      <div className="accommodation-overview-grid">
        <section aria-labelledby="accommodation-introduction">
          <h2 id="accommodation-introduction" tabIndex={-1}>
            숙소 설명
          </h2>
          <p className="accommodation-description">{card.description}</p>
          <h2>위치</h2>
          <p>{card.location}</p>
          <h2>숙소 편의시설</h2>
          {card.amenities.length ? (
            <ul className="catalog-amenities">
              {card.amenities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>등록된 편의시설이 없습니다.</p>
          )}
        </section>
        <section aria-labelledby="accommodation-operating-info">
          <h2 id="accommodation-operating-info" tabIndex={-1}>
            이용 안내
          </h2>
          <h3>체크인·체크아웃</h3>
          <dl className="accommodation-operating-facts">
            <div>
              <dt>체크인 시간</dt>
              <dd>{accommodation.checkInTime ?? '등록되지 않음'}</dd>
            </div>
            <div>
              <dt>체크아웃 시간</dt>
              <dd>{accommodation.checkOutTime ?? '등록되지 않음'}</dd>
            </div>
            <div>
              <dt>숙소 시간대</dt>
              <dd>{accommodation.timeZone}</dd>
            </div>
          </dl>
          <h3>예약·취소 정책</h3>
          <p>현재 API는 숙소 정책 조회를 제공하지 않아 이 화면에서 정책 값을 확인할 수 없습니다.</p>
          <p className="detail-policy-note">
            객실 기본 가격과 날짜별 예상 요금은 예약 확정 금액이 아닙니다. 최종 금액은 예약 생성 시
            계산되며 예약에 별도 스냅샷으로 저장됩니다.
          </p>
        </section>
      </div>
    </section>
  )
}
