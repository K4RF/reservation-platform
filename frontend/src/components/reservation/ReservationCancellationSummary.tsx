import type { CancellationPolicySnapshot } from '../../api/reservationDetail'
import type { ReservationCancellationSummary as CancellationSummary } from '../../api/reservationCancellation'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'

export function ReservationCancellationPolicy({ policy }: { policy: CancellationPolicySnapshot }) {
  return (
    <>
      <p>체크인 {policy.freeCancellationDaysBeforeCheckIn}일 전 이상: 무료 취소</p>
      <ul>
        {policy.feeRules.map((rule, index) => {
          // Display saved relative thresholds only; never calculate a fee, today or deadline date.
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
    </>
  )
}

export function ReservationCancellationResult({
  reservation,
}: {
  reservation: CancellationSummary
}) {
  const amount = (value: number | null) =>
    value === null ? '저장된 정보 없음' : formatMinorUnits(toMinorUnits(value, 19))
  return (
    <>
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
          <dd>{amount(reservation.cancellationFeeAmount)}</dd>
        </div>
        <div>
          <dt>예상 환불 금액</dt>
          <dd>{amount(reservation.refundAmount)}</dd>
        </div>
      </dl>
      <p>저장된 취소 결과이며 결제 취소·환불 완료를 의미하지 않습니다.</p>
      <p>취소된 예약은 일정 변경하거나 다시 취소할 수 없습니다.</p>
    </>
  )
}

export function ReservationCancellationSummary({
  reservation,
}: {
  reservation: CancellationSummary
}) {
  return (
    <>
      <p>확인 시 다시 조회한 서버 예약 정보입니다.</p>
      <p>예약 번호: {reservation.reservationNumber ?? '미등록 (과거 예약)'}</p>
      <p>
        예약 일정: {reservation.checkInDate} ~ {reservation.checkOutDate}
      </p>
      <p>저장된 예약 총액: {formatMinorUnits(toMinorUnits(reservation.totalAmount, 19))}</p>
      <h4>확인할 저장 취소 정책</h4>
      <ReservationCancellationPolicy policy={reservation.cancellationPolicySnapshot} />
      {reservation.status === 'CANCELLED' ? (
        <>
          <h4>이미 취소된 예약의 저장 결과</h4>
          <ReservationCancellationResult reservation={reservation} />
        </>
      ) : (
        <>
          <p>취소 전 예상 수수료 금액: 제공되지 않음</p>
          <p>취소 전 예상 환불 금액: 제공되지 않음</p>
          <p>
            확정 상태만으로 현재 취소 가능 여부를 보장하지 않습니다. 수수료·환불 금액은 실제 취소 시
            서버가 계산하며, 브라우저에서 계산하지 않습니다.
          </p>
          <p>
            취소 요청은 수수료가 발생할 수 있습니다. 실제 결제 취소나 환불 완료를 의미하지 않습니다.
          </p>
        </>
      )}
    </>
  )
}
