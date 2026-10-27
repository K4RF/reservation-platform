import type { ReservationCancellationResponse } from '../../api/reservationCancellation'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'

export function ReservationCancellationFeedback({
  result,
}: {
  result: ReservationCancellationResponse
}) {
  const amount = (value: number) => formatMinorUnits(toMinorUnits(value, 19))
  return (
    <section
      className="reservation-card reservation-operation-result"
      aria-labelledby="cancel-success-heading"
    >
      <p className="reservation-source-label">취소 API 응답 · 서버 처리 결과</p>
      <h2 id="cancel-success-heading">예약 취소 완료</h2>
      <p role="status">
        서버에서 예약을 CANCELLED로 처리했습니다. 최신 예약 상세를 다시 조회합니다.
      </p>
      <dl className="reservation-facts">
        <div>
          <dt>취소 시각 (UTC)</dt>
          <dd>
            <time dateTime={result.cancelledAt}>{result.cancelledAt}</time>
          </dd>
        </div>
        <div>
          <dt>숙소 기준 취소일</dt>
          <dd>{result.cancellationDate}</dd>
        </div>
        <div>
          <dt>체크인까지 남은 달력 일수</dt>
          <dd>{result.daysBeforeCheckIn}일</dd>
        </div>
        <div className="reservation-amount">
          <dt>서버 확정 예약 총액</dt>
          <dd>{amount(result.totalAmount)}</dd>
        </div>
        <div>
          <dt>서버 적용 수수료율</dt>
          <dd>{result.cancellationFeeRate}%</dd>
        </div>
        <div className="reservation-amount">
          <dt>서버 적용 취소 수수료</dt>
          <dd>{amount(result.cancellationFeeAmount)}</dd>
        </div>
        <div className="reservation-amount">
          <dt>서버 예상 환불 금액</dt>
          <dd>{amount(result.estimatedRefundAmount)}</dd>
        </div>
      </dl>
      <p className="reservation-result-disclaimer">
        결제 취소·환불 완료가 아닙니다. 재고 복구와 수수료 계산은 서버가 수행합니다.
      </p>
    </section>
  )
}
