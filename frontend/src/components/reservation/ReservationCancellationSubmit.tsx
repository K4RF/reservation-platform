import { useEffect, useRef, useState } from 'react'
import {
  cancelReservation,
  type ReservationCancellationResponse,
} from '../../api/reservationCancellation'
import { ApiError } from '../../api/errors'
import { getSessionVersion } from '../../state/accessToken'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { ReservationCancellationFeedback } from './ReservationCancellationFeedback'

export function ReservationCancellationSubmit({
  reservationId,
  onLock,
  onRefresh,
  onCancelled,
}: {
  reservationId: number
  onLock: (locked: boolean) => void
  onRefresh?: () => void
  onCancelled?: (result: ReservationCancellationResponse) => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [result, setResult] = useState<ReservationCancellationResponse>()
  const locked = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function submit() {
    if (!acknowledged || locked.current) return
    locked.current = true
    onLock(true)
    setPending(true)
    setFailure(undefined)
    const session = getSessionVersion()
    const operation = new AbortController()
    controller.current = operation
    try {
      const cancelled = await cancelReservation(reservationId, operation.signal)
      if (operation.signal.aborted || session !== getSessionVersion()) return
      setResult(cancelled)
      onCancelled?.(cancelled)
    } catch (error) {
      if (operation.signal.aborted || session !== getSessionVersion()) return
      const uncertain =
        !(error instanceof ApiError) || error.kind !== 'http' || (error.status ?? 500) >= 500
      const message = uncertain
        ? '취소 결과를 확인할 수 없습니다. 서버에서 이미 취소됐을 수 있으므로 다시 제출하지 마세요. 예약 상세를 다시 조회해 상태와 저장 결과를 확인해 주세요.'
        : {
            bad_request: '요청 및 취소 정책 조건을 확인해 주세요.',
            unauthorized: '다시 로그인한 뒤 예약 상세를 확인해 주세요.',
            forbidden: '본인 예약만 취소할 수 있습니다.',
            not_found: '예약 또는 날짜별 재고 정보를 찾을 수 없습니다.',
            conflict:
              '이미 취소된 예약, 취소 마감 또는 재고 충돌로 요청이 거절됐습니다. 예약 상세를 다시 확인해 주세요.',
            other: '서버가 취소 요청을 거절했습니다.',
            server_error: '',
          }[error.category ?? 'other']
      const details =
        error instanceof ApiError && error.kind === 'http'
          ? `${error.code ? ` [${error.code}]` : ''} ${error.message}${error.fieldErrors.map((field) => ` ${field.field}: ${field.message}`).join('')}`
          : ''
      setFailure(message + details)
      // Every failure requires a fresh owner GET and a new explicit confirmation before another PATCH.
      // In particular, never unlock closing/re-submitting after an ambiguous response.
    } finally {
      if (!operation.signal.aborted && session === getSessionVersion()) setPending(false)
    }
  }
  const disabled = pending || Boolean(failure) || Boolean(result)
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={disabled}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        저장된 정책과 사전 금액 미제공 안내를 확인했습니다.
      </label>
      {!pending && !failure && !result && (
        <p role="status">
          {acknowledged
            ? '안내를 확인했습니다. 아직 취소 요청은 전송되지 않았습니다.'
            : '취소 전에 저장된 정책과 금액 미제공 안내를 확인하세요.'}
        </p>
      )}
      <p>
        아래 버튼을 누르면 실제 취소를 요청합니다. 수수료가 발생할 수 있으며 취소 후 일정 변경은
        불가능합니다.
      </p>
      {pending && <LoadingState message="예약을 취소하고 있습니다. 중복 제출하지 마세요." />}
      {failure && <ErrorState message={failure} />}
      {result && !onCancelled && <ReservationCancellationFeedback result={result} />}
      <button type="button" disabled={disabled || !acknowledged} onClick={() => void submit()}>
        예약 취소 확정
      </button>
      {onRefresh && (
        <button type="button" disabled={pending} onClick={onRefresh}>
          예약 상세 다시 조회
        </button>
      )}
      <p>
        화면 이탈이나 요청 중단은 서버 롤백을 의미하지 않습니다. 중복 제출 방지는 다중 탭·서버
        멱등성을 보장하지 않습니다.
      </p>
    </>
  )
}
