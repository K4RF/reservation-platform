import type { ReservationDetail } from '../../api/reservationDetail'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'
import { ReservationChangeAvailabilitySection } from './ReservationChangeAvailabilitySection'
import {
  ReservationCancellationPolicy,
  ReservationCancellationResult,
} from './ReservationCancellationSummary'
import { ReservationCancellationSection } from './ReservationCancellationSection'
import { useState } from 'react'
import type { ReservationCancellationResponse } from '../../api/reservationCancellation'

const amountLabel = (amount: number | null) =>
  amount === null ? '저장된 정보 없음' : formatMinorUnits(toMinorUnits(amount, 19))

export function ReservationSnapshots({
  reservation,
  accommodationId,
  onRefresh,
  onRefreshDetail,
  onCancelled,
}: {
  reservation: ReservationDetail
  accommodationId: number | null
  onRefresh?: (changed?: ReservationDetail) => void
  onRefreshDetail?: () => void
  onCancelled?: (result: ReservationCancellationResponse) => void
}) {
  const [changeLocked, setChangeLocked] = useState(false)
  const [cancelLocked, setCancelLocked] = useState(false)
  const { representativeGuest: guest } = reservation
  return (
    <div className="reservation-snapshot-grid">
      <section className="reservation-card" aria-labelledby="guest-snapshot-heading">
        <p className="reservation-source-label">서버 저장 Snapshot</p>
        <h2 id="guest-snapshot-heading">대표 투숙객</h2>
        {guest ? (
          <dl className="reservation-facts">
            <div>
              <dt>이름</dt>
              <dd>{guest.name}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{guest.email}</dd>
            </div>
            <div>
              <dt>연락처</dt>
              <dd>{guest.phone}</dd>
            </div>
          </dl>
        ) : (
          <p>대표 투숙객 정보가 저장되지 않은 과거 예약입니다.</p>
        )}
      </section>
      <section className="reservation-card" aria-labelledby="price-snapshot-heading">
        <p className="reservation-source-label">현재 객실 가격과 구분되는 저장 기록</p>
        <h2 id="price-snapshot-heading">저장된 숙박 요금</h2>
        <p>첫 숙박일 요금 Snapshot: {amountLabel(reservation.nightlyPriceSnapshot)}</p>
        <p>확정 예약 금액은 위 예약 기록의 총액입니다. 현재 객실 요금으로 재계산하지 않습니다.</p>
        {reservation.nights.length ? (
          <>
            <p className="reservation-note" id="saved-price-scroll-hint">
              좁은 화면에서는 요금 표를 좌우로 스크롤할 수 있습니다.
            </p>
            <div
              className="reservation-price-scroll"
              role="region"
              aria-label="저장된 숙박 요금 표"
              aria-describedby="saved-price-scroll-hint"
              tabIndex={0}
            >
              <table className="booking-price-table">
                <caption>숙박일별 확정 요금 Snapshot</caption>
                <thead>
                  <tr>
                    <th scope="col">숙박일</th>
                    <th scope="col">저장된 요금</th>
                  </tr>
                </thead>
                <tbody>
                  {[...reservation.nights]
                    .sort((a, b) => a.stayDate.localeCompare(b.stayDate))
                    .map((night) => (
                      <tr key={night.stayDate}>
                        <th scope="row">
                          <time dateTime={night.stayDate}>{night.stayDate}</time>
                        </th>
                        <td>{amountLabel(night.priceSnapshot)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>숙박일별 요금이 저장되지 않은 과거 예약입니다. 일별 금액을 추정하지 않습니다.</p>
        )}
      </section>
      <section
        className="reservation-card reservation-snapshot-wide"
        aria-labelledby="policy-snapshot-heading"
      >
        <h2 id="policy-snapshot-heading">예약에 저장된 취소 정책</h2>
        <ReservationCancellationPolicy policy={reservation.cancellationPolicySnapshot} />
      </section>
      {reservation.status === 'CANCELLED' ? (
        <section
          className="reservation-card reservation-snapshot-wide"
          aria-labelledby="cancellation-result-heading"
        >
          <h2 id="cancellation-result-heading">저장된 취소 결과</h2>
          <ReservationCancellationResult reservation={reservation} />
        </section>
      ) : (
        <section
          className="reservation-card reservation-snapshot-wide"
          aria-labelledby="reservation-actions-heading"
        >
          <p className="reservation-eyebrow">MANAGE YOUR STAY</p>
          <h2 id="reservation-actions-heading">예약 관리</h2>
          <p className="reservation-note">
            일정 변경과 취소는 별도 작업입니다. 실행 전 안내를 각각 확인하세요.
          </p>
          <fieldset
            className="reservation-change-fields reservation-change-action"
            disabled={cancelLocked}
          >
            <legend>일정 변경</legend>
            <ReservationChangeAvailabilitySection
              reservation={reservation}
              accommodationId={accommodationId}
              onRefresh={onRefresh}
              onLock={setChangeLocked}
            />
          </fieldset>
          <fieldset
            className="reservation-change-fields reservation-cancel-action"
            disabled={changeLocked}
          >
            <legend>예약 취소</legend>
            <ReservationCancellationSection
              reservation={reservation}
              onRefresh={onRefreshDetail}
              onCancelled={onCancelled}
              onLock={setCancelLocked}
            />
          </fieldset>
          <p>
            예약 확정 상태만으로 현재 취소 가능 여부를 보장하지 않으며 사전 수수료 견적은 제공되지
            않습니다.
          </p>
        </section>
      )}
    </div>
  )
}
