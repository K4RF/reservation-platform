import type { ReservationDetail } from '../../api/reservationDetail'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'
import { ReservationChangeAvailabilitySection } from './ReservationChangeAvailabilitySection'

const amountLabel = (amount: number | null) =>
  amount === null ? '저장된 정보 없음' : formatMinorUnits(toMinorUnits(amount, 19))

export function ReservationSnapshots({
  reservation,
  accommodationId,
}: {
  reservation: ReservationDetail
  accommodationId: number | null
}) {
  const { representativeGuest: guest, cancellationPolicySnapshot: policy } = reservation
  return (
    <>
      <section className="reservation-card" aria-labelledby="guest-snapshot-heading">
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
        <h2 id="price-snapshot-heading">저장된 숙박 요금</h2>
        <p>첫 숙박일 요금 Snapshot: {amountLabel(reservation.nightlyPriceSnapshot)}</p>
        <p>확정 예약 금액은 위 예약 기록의 총액입니다. 현재 객실 요금으로 재계산하지 않습니다.</p>
        {reservation.nights.length ? (
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
        ) : (
          <p>숙박일별 요금이 저장되지 않은 과거 예약입니다. 일별 금액을 추정하지 않습니다.</p>
        )}
      </section>
      <section className="reservation-card" aria-labelledby="policy-snapshot-heading">
        <h2 id="policy-snapshot-heading">예약에 저장된 취소 정책</h2>
        <p>체크인 {policy.freeCancellationDaysBeforeCheckIn}일 전 이상: 무료 취소</p>
        <ul>
          {policy.feeRules.map((rule, index) => {
            const upper =
              (index === 0
                ? policy.freeCancellationDaysBeforeCheckIn
                : policy.feeRules[index - 1].minDaysBeforeCheckIn) - 1
            const range =
              upper === rule.minDaysBeforeCheckIn
                ? `${upper}일 전`
                : `${rule.minDaysBeforeCheckIn}–${upper}일 전`
            return (
              <li key={rule.minDaysBeforeCheckIn}>
                체크인 {range}: 예약 총액의 {rule.feeRatePercent}% 수수료
              </li>
            )
          })}
        </ul>
        <p>취소 마감: 체크인 {policy.cancellationDeadlineDaysBeforeCheckIn}일 전까지</p>
        <p>
          현재 숙소 정책이 아닌 예약에 저장된 정책입니다. 실제 취소 가능 여부와 수수료는 서버가 숙소
          TimeZone 기준으로 판단합니다.
        </p>
      </section>
      {reservation.status === 'CANCELLED' ? (
        <section className="reservation-card" aria-labelledby="cancellation-result-heading">
          <h2 id="cancellation-result-heading">저장된 취소 결과</h2>
          <dl className="reservation-facts">
            <div>
              <dt>취소 시각 (UTC)</dt>
              <dd>
                {reservation.cancelledAt ? (
                  <time dateTime={reservation.cancelledAt}>{reservation.cancelledAt}</time>
                ) : (
                  '저장된 정보 없음'
                )}
              </dd>
            </div>
            <div>
              <dt>적용 취소 수수료</dt>
              <dd>{amountLabel(reservation.cancellationFeeAmount)}</dd>
            </div>
            <div>
              <dt>예상 환불 금액</dt>
              <dd>{amountLabel(reservation.refundAmount)}</dd>
            </div>
          </dl>
          <p>저장된 취소 결과이며 결제 취소·환불 완료를 의미하지 않습니다.</p>
          <p>취소된 예약은 일정 변경하거나 다시 취소할 수 없습니다.</p>
        </section>
      ) : (
        <section className="reservation-card" aria-labelledby="reservation-actions-heading">
          <h2 id="reservation-actions-heading">예약 관리</h2>
          <ReservationChangeAvailabilitySection
            reservation={reservation}
            accommodationId={accommodationId}
          />{' '}
          <button type="button" disabled>
            예약 취소 (준비 중)
          </button>
          <p>
            변경·취소 실행 기능은 후속 작업입니다. 예약 확정 상태만으로 현재 취소 가능 여부를
            보장하지 않으며 사전 수수료 견적은 제공되지 않습니다.
          </p>
        </section>
      )}
    </>
  )
}
