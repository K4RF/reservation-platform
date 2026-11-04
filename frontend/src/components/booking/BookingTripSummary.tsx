import type { BookingSelection } from './bookingState'
import { CatalogImage } from '../media/CatalogImage'

export function BookingTripSummary({ selection }: { selection: BookingSelection }) {
  const roomPhoto = selection.room.representativeImage
  return (
    <section className="booking-trip" aria-label="선택한 여행">
      <div className="booking-trip-heading">
        <CatalogImage
          image={roomPhoto ?? selection.accommodation.representativeImage ?? null}
          label={roomPhoto ? '객실 사진' : '숙소 사진'}
          priority
        />
        <div>
          <p className="booking-eyebrow">YOUR STAY</p>
          <h2>{selection.accommodation.name ?? '선택한 숙소'}</h2>
          <p>{selection.room.name}</p>
        </div>
      </div>
      <dl className="booking-trip-facts">
        <div>
          <dt>머무는 일정</dt>
          <dd>
            {selection.stay.checkInDate} → {selection.stay.checkOutDate}
          </dd>
        </div>
        <div>
          <dt>숙박 인원</dt>
          <dd>
            총 {selection.stay.guestCount}명 · 객실 정원 {selection.room.capacity}명
          </dd>
        </div>
      </dl>
      <p className="booking-note">숙소·객실 이름과 사진은 현재 정보입니다.</p>
    </section>
  )
}
