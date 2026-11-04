import type { AccommodationResponse } from '../../api/accommodation'
import { toAccommodationCard } from './accommodationView'

export function AccommodationTitle({ accommodation }: { accommodation: AccommodationResponse }) {
  const card = toAccommodationCard(accommodation)
  return (
    <header className="accommodation-detail-header">
      <p className="eyebrow">A CONSIDERED STAY</p>
      <h1>{card.name}</h1>
      <p>{card.shortLocation}</p>
      {accommodation.status === 'INACTIVE' && <p className="catalog-status">운영 중지</p>}
    </header>
  )
}

export function AccommodationInfo({ accommodation }: { accommodation: AccommodationResponse }) {
  const card = toAccommodationCard(accommodation)
  return (
    <section aria-labelledby="accommodation-introduction">
      <h2 id="accommodation-introduction" tabIndex={-1}>
        숙소 설명
      </h2>
      <p className="accommodation-description">{card.description}</p>
      <h3>위치</h3>
      <p>{card.location}</p>
      <h3>숙소 편의시설</h3>
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
  )
}

export function AccommodationOperatingInfo({
  accommodation,
}: {
  accommodation: AccommodationResponse
}) {
  return (
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
      <p>예약·취소 정책은 현재 이 화면에서 확인할 수 없습니다.</p>
      <p className="detail-policy-note">
        기본 1박 가격·날짜별 예상 요금은 확정 금액이 아닙니다. 예약 시 최종 금액과 가용성을 다시
        확인합니다.
      </p>
    </section>
  )
}
