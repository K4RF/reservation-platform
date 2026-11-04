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
  const heading = useRef<HTMLHeadingElement>(null)
  const failureFocus = useRef<HTMLDivElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    heading.current?.focus()
  }, [])
  useEffect(() => {
    if (failure) {
      failureFocus.current?.focus()
      failureFocus.current?.scrollIntoView?.({ block: 'center' })
    }
  }, [failure])

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
    <section
      className="confirmation-panel reservation-change-confirmation"
      aria-labelledby="reservation-change-confirm-heading"
    >
      <h4 id="reservation-change-confirm-heading" ref={heading} tabIndex={-1}>
        일정 변경 전 확인
      </h4>
      <div className="reservation-schedule-comparison">
        <section aria-label="변경 전 저장 기록">
          <p className="reservation-source-label">현재 저장된 일정</p>
          <p className="reservation-stay-line">
            기존 일정: {reservation.checkInDate} ~ {reservation.checkOutDate}
          </p>
          <p>기존 확정 총액: {formatMinorUnits(toMinorUnits(reservation.totalAmount, 19))}</p>
        </section>
        <section aria-label="변경 요청 일정">
          <p className="reservation-source-label">변경할 일정</p>
          <p className="reservation-stay-line reservation-new-stay">
            새 일정: {request.checkInDate} ~ {request.checkOutDate} (체크아웃 제외)
          </p>
          <p className="reservation-note">아래 참고 예상액은 변경 응답의 확정 금액이 아닙니다.</p>
          {price.status === 'success' && (
            <p className="reservation-reference-total">
              새 일정 참고 예상 총액: {formatMinorUnits(price.data.totalMinorUnits)}
            </p>
          )}
        </section>
      </div>
      <p className="reservation-note">
        객실·총 인원·대표 투숙객·저장 취소 정책은 그대로 유지합니다.
      </p>
      {price.status === 'loading' && <LoadingState message="변경 참고 요금을 조회하고 있습니다." />}
      {price.status === 'error' && (
        <ErrorState message="변경 참고 요금을 확인하지 못했습니다." onRetry={retry} />
      )}
      {price.status === 'success' && (
        <details className="reservation-snapshot-disclosure">
          <summary>변경 참고 요금 내역</summary>
          <p className="reservation-note" id="change-price-scroll-hint">
            좁은 화면에서는 요금 표를 좌우로 스크롤할 수 있습니다.
          </p>
          <div
            className="reservation-price-scroll"
            role="region"
            aria-label="변경 참고 요금 표"
            aria-describedby="change-price-scroll-hint"
            tabIndex={0}
          >
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
          </div>
        </details>
      )}
      <p className="reservation-note">
        참고 예상액은 확정 금액이 아닙니다. 변경 시 전체 기간의 요금·재고·예약 조건을 다시
        확인합니다.
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
      {failure && (
        <div ref={failureFocus} tabIndex={-1}>
          <ErrorState message={failure.message} />
        </div>
      )}
      {result && (
        <p className="reservation-feedback reservation-success" role="status">
          일정 변경 완료. 서버 확정 총액: {formatMinorUnits(toMinorUnits(result.totalAmount, 19))}
        </p>
      )}
      <div className="action-group reservation-mutation-actions">
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
      <p className="reservation-note">
        화면을 나가도 요청이 처리될 수 있습니다. 다시 변경하기 전 내 예약에서 결과를 확인하세요.
      </p>
    </section>
  )
}
