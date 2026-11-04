import { useEffect, useRef, useState } from 'react'
import type { BookingRequest } from '../../api/booking'
import { createReservation } from '../../api/reservation'
import { bookingFailure } from './bookingFailure'
import { LoadingState } from '../ui/LoadingState'
import { getSessionVersion } from '../../state/accessToken'
import { Link } from 'react-router'
import { routePaths } from '../../app/routePaths'

export function BookingSubmit({
  request,
  onComplete,
  onEdit,
  onLockChange,
}: {
  request: BookingRequest
  onComplete?: (id: number) => void
  onEdit: () => void
  onLockChange?: (locked: boolean) => void
}) {
  const locked = useRef(false)
  const mounted = useRef(true)
  const [state, setState] = useState<'ready' | 'pending' | 'success' | 'error'>('ready')
  const [failure, setFailure] = useState<ReturnType<typeof bookingFailure>>()
  const [completedId, setCompletedId] = useState<number>()
  const failureFocus = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (failure) {
      failureFocus.current?.focus()
      failureFocus.current?.scrollIntoView?.({ block: 'center' })
    }
  }, [failure])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function submit() {
    if (locked.current) return
    locked.current = true
    onLockChange?.(true)
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
      onLockChange?.(!next.retryable)
      setFailure(next)
      setState('error')
    }
  }
  return (
    <>
      {state === 'pending' && (
        <LoadingState message="예약을 생성하고 있습니다. 중복 제출하지 마세요." />
      )}
      {failure && (
        <>
          <p ref={failureFocus} role="alert" tabIndex={-1}>
            {failure.message}
          </p>
          {!failure.retryable && <Link to={routePaths.reservations}>내 예약에서 결과 확인</Link>}
        </>
      )}
      {state === 'success' ? (
        <p role="status">
          예약이 생성되었습니다.{' '}
          <Link to={`${routePaths.reservations}/${completedId}`}>저장된 예약 확인</Link>
        </p>
      ) : (
        <div className="action-group booking-submit-actions">
          <button
            type="button"
            disabled={state === 'pending' || (state === 'error' && !failure?.retryable)}
            onClick={() => {
              if (!locked.current) onEdit()
            }}
          >
            투숙객 정보 수정
          </button>
          <button
            type="button"
            disabled={state === 'pending' || (state === 'error' && !failure?.retryable)}
            onClick={() => void submit()}
            className="primary-action"
            aria-busy={state === 'pending'}
          >
            {state === 'error' && failure?.retryable ? '예약 생성 다시 시도' : '예약 생성'}
          </button>
        </div>
      )}
    </>
  )
}
