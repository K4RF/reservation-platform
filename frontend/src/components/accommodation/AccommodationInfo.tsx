import type { AccommodationResponse } from '../../api/accommodation'
import { toAccommodationCard } from './accommodationView'

export function AccommodationInfo({ accommodation }: { accommodation: AccommodationResponse }) {
  const card = toAccommodationCard(accommodation)
  return (
    <section aria-label="숙소 기본 정보">
      <h1>{card.name}</h1>
      <p>{card.status}</p>
      <h2>숙소 설명</h2>
      <p className="accommodation-description">{card.description}</p>
      <h2>위치</h2>
      <p>{card.location}</p>
      <h2>숙소 편의시설</h2>
      {card.amenities.length ? (
        <ul>
          {card.amenities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>등록된 편의시설이 없습니다.</p>
      )}
      <h2>체크인·체크아웃</h2>
      <dl>
        <dt>체크인 시간</dt>
        <dd>{accommodation.checkInTime ?? '등록되지 않음'}</dd>
        <dt>체크아웃 시간</dt>
        <dd>{accommodation.checkOutTime ?? '등록되지 않음'}</dd>
        <dt>숙소 시간대</dt>
        <dd>{accommodation.timeZone}</dd>
      </dl>
      <h2>예약·취소 정책</h2>
      <p>현재 API는 숙소 정책 조회를 제공하지 않아 이 화면에서 정책 값을 확인할 수 없습니다.</p>
    </section>
  )
}
