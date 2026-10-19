import { useCallback, useEffect, useRef, useState } from 'react'
import { getBookingPrice } from '../../api/bookingPrice'
import {
  changeReservationSchedule,
  type ReservationChangeRequest,
} from '../../api/reservationChange'
import type { ReservationDetail } from '../../api/reservationDetail'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { getSessionVersion } from '../../state/accessToken'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { reservationChangeFailure } from './reservationChangeFailure'

export function ReservationChangeConfirmation({
  reservation,
  request,
  onLock,
  onRefresh,
}: {
  reservation: ReservationDetail
  request: ReservationChangeRequest
  onLock: (locked: boolean) => void
  onRefresh?: (changed?: ReservationDetail) => void
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getBookingPrice(reservation.roomId, request.checkInDate, request.checkOutDate, signal),
    [reservation.roomId, request.checkInDate, request.checkOutDate],
  )
  const { state: price, retry } = useDetailQuery(load)
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<ReturnType<typeof reservationChangeFailure>>()
  const [result, setResult] = useState<ReservationDetail>()
  const locked = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function submit() {
    if (locked.current || price.status !== 'success' || !acknowledged) return
    locked.current = true
    onLock(true)
    setPending(true)
    setFailure(undefined)
    const session = getSessionVersion()
    const operation = new AbortController()
    controller.current = operation
    try {
      const changed = await changeReservationSchedule(reservation, request, operation.signal)
      if (operation.signal.aborted || session !== getSessionVersion()) return
      setResult(changed)
      onRefresh?.(changed)
    } catch (error) {
      if (operation.signal.aborted || session !== getSessionVersion()) return
      const next = reservationChangeFailure(error)
      setFailure(next)
      locked.current = next.uncertain
      onLock(next.uncertain)
    } finally {
      if (!operation.signal.aborted && session === getSessionVersion()) setPending(false)
    }
  }
  const disabled = pending || Boolean(result) || Boolean(failure?.uncertain)
  return (
    <section className="confirmation-panel" aria-labelledby="reservation-change-confirm-heading">
      <h4 id="reservation-change-confirm-heading">일정 변경 전 확인</h4>
      <p>
        기존 일정: {reservation.checkInDate} ~ {reservation.checkOutDate}
      </p>
      <p>
        새 일정: {request.checkInDate} ~ {request.checkOutDate} (체크아웃 제외)
      </p>
      <p>기존 확정 총액: {formatMinorUnits(toMinorUnits(reservation.totalAmount, 19))}</p>
      <p>객실·인원·대표 투숙객·취소 정책 Snapshot은 변경하지 않습니다.</p>
      {price.status === 'loading' && <LoadingState message="변경 참고 요금을 조회하고 있습니다." />}
      {price.status === 'error' && (
        <ErrorState message="변경 참고 요금을 확인하지 못했습니다." onRetry={retry} />
      )}
      {price.status === 'success' && (
        <>
          <table className="booking-price-table">
            <caption>변경 참고 숙박일별 요금</caption>
            <thead>
              <tr>
                <th scope="col">숙박일</th>
                <th scope="col">가격 출처</th>
                <th scope="col">참고 요금</th>
              </tr>
            </thead>
            <tbody>
              {price.data.nights.map((night) => (
                <tr key={night.stayDate}>
                  <th scope="row">{night.stayDate}</th>
                  <td>{night.source === 'DAILY' ? '날짜별 요금' : '기본 요금'}</td>
                  <td>{formatMinorUnits(toMinorUnits(night.nightlyPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>새 일정 참고 예상 총액: {formatMinorUnits(price.data.totalMinorUnits)}</p>
        </>
      )}
      <p>
        예상액은 가격 보장이나 원자적 견적이 아닙니다. 변경 시 서버가 전체 기간 요금·재고·예약
        정책·현재 상태를 재검증하며 응답 금액이 확정값입니다.
      </p>
      <label className="confirmation-check">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={disabled}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        참고 예상 금액과 서버 재검증 안내를 확인했습니다.
      </label>
      {pending && <LoadingState message="일정을 변경하고 있습니다. 중복 제출하지 마세요." />}
      {failure && <ErrorState message={failure.message} />}
      {result && (
        <p role="status">
          일정 변경 완료. 서버 확정 총액: {formatMinorUnits(toMinorUnits(result.totalAmount, 19))}
        </p>
      )}
      <div className="action-group">
        <button
          type="button"
          disabled={disabled || price.status !== 'success' || !acknowledged}
          onClick={() => void submit()}
          className="primary-action"
          aria-busy={pending}
        >
          예약 일정 변경 확정
        </button>
        {failure && (
          <button type="button" disabled={!onRefresh || pending} onClick={() => onRefresh?.()}>
            예약 상세 다시 조회
          </button>
        )}
      </div>
      <p>
        화면 이탈이나 요청 취소가 서버 롤백을 의미하지 않습니다. 이 화면의 중복 제출 방지는 다중
        탭·서버 멱등성을 보장하지 않습니다.
      </p>
    </section>
  )
}
