import { useId, useRef } from 'react'
import type { BookingPolicyResponse } from '../../api/bookingPolicy'
import type { QueryState } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'

export function BookingPolicyReadout({
  state,
  retry,
  admin = false,
}: {
  state: QueryState<BookingPolicyResponse | null>
  retry?: () => void
  admin?: boolean
}) {
  const heading = useId()
  const section = useRef<HTMLElement>(null)
  const retryWithFocus = retry
    ? () => {
        section.current?.focus({ preventScroll: true })
        retry()
      }
    : undefined
  return (
    <section
      className="booking-policy-readout"
      aria-labelledby={heading}
      ref={section}
      tabIndex={-1}
    >
      <h3 id={heading}>{admin ? '현재 예약 정책' : '예약 정책'}</h3>
      {state.status === 'loading' && <LoadingState message="예약 정책을 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState
          message={
            state.notFound
              ? '예약 정책을 조회할 숙소를 찾을 수 없습니다.'
              : '예약 정책을 불러오지 못했습니다.'
          }
          onRetry={retryWithFocus}
        />
      )}
      {state.status === 'success' &&
        (state.data ? (
          <>
            <dl className="booking-policy-limits">
              <div>
                <dt>숙박 기간</dt>
                <dd>
                  최소 {state.data.minStayNights}박 · 최대 {state.data.maxStayNights}박
                </dd>
              </div>
              <div>
                <dt>사전 예약</dt>
                <dd>
                  최소 {state.data.minAdvanceBookingDays}일 전 · 최대{' '}
                  {state.data.maxAdvanceBookingDays}일 전
                </dd>
              </div>
            </dl>
            {!admin && <p>사전 예약일은 숙소 현지 날짜 기준입니다.</p>}
          </>
        ) : (
          <p>설정된 예약 정책이 없습니다.</p>
        ))}
      {admin && state.status === 'success' && (
        <button type="button" onClick={retryWithFocus} disabled={!retry}>
          예약 정책 새로 조회
        </button>
      )}
    </section>
  )
}
