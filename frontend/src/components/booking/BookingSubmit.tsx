import { useEffect, useRef, useState } from 'react'
import type { BookingRequest } from '../../api/booking'
import { createReservation } from '../../api/reservation'
import { bookingFailure } from './bookingFailure'
import { LoadingState } from '../ui/LoadingState'
import { getSessionVersion } from '../../state/accessToken'

export function BookingSubmit({
  request,
  onComplete,
  onEdit,
}: {
  request: BookingRequest
  onComplete?: (id: number) => void
  onEdit: () => void
}) {
  const locked = useRef(false)
  const mounted = useRef(true)
  const [state, setState] = useState<'ready' | 'pending' | 'success' | 'error'>('ready')
  const [failure, setFailure] = useState<ReturnType<typeof bookingFailure>>()
  const [completedId, setCompletedId] = useState<number>()
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function submit() {
    if (locked.current) return
    locked.current = true
    setState('pending')
    setFailure(undefined)
    const session = getSessionVersion()
    try {
      const result = await createReservation(request)
      if (!mounted.current || session !== getSessionVersion()) return
      setCompletedId(result.reservationId)
      setState('success')
      onComplete?.(result.reservationId)
    } catch (error) {
      if (!mounted.current || session !== getSessionVersion()) return
      const next = bookingFailure(error)
      locked.current = !next.retryable
      setFailure(next)
      setState('error')
    }
  }
  return (
    <>
      {state === 'pending' && (
        <LoadingState message="예약을 생성하고 있습니다. 중복 제출하지 마세요." />
      )}
      {failure && <p role="alert">{failure.message}</p>}
      {state === 'success' ? (
        <p role="status">
          예약 생성 완료: ID {completedId}. 입력 내용은 더 이상 제출할 수 없습니다.
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={state === 'pending' || (state === 'error' && !failure?.retryable)}
            onClick={onEdit}
          >
            투숙객 정보 수정
          </button>
          <button
            type="button"
            disabled={state === 'pending' || (state === 'error' && !failure?.retryable)}
            onClick={() => void submit()}
          >
            {state === 'error' && failure?.retryable ? '예약 생성 다시 시도' : '예약 생성'}
          </button>
        </>
      )}
      <p>중복 클릭 방지는 이 화면에만 적용됩니다. 실제 재고 검증은 Backend가 수행합니다.</p>
    </>
  )
}
