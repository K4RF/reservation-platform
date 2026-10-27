import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { BookingSummary } from './BookingSummary'
import {
  bookingReducer,
  buildBookingRequest,
  initialBookingState,
  validateGuest,
  validateSelection,
  type BookingSelection,
  type GuestErrors,
} from './bookingState'
import { ErrorState } from '../ui/ErrorState'
import { BookingSubmit } from './BookingSubmit'

export function BookingFlow({
  selection,
  onComplete,
}: {
  selection: BookingSelection | null
  onComplete?: (id: number) => void
}) {
  const error = validateSelection(selection)
  if (error || !selection) return <ErrorState message={error ?? '예약 조건을 다시 선택하세요.'} />
  const { accommodation, room, stay } = selection
  return (
    <BookingInput
      key={`${accommodation.accommodationId}:${room.roomId}:${stay.checkInDate}:${stay.checkOutDate}:${stay.guestCount}`}
      selection={selection}
      onComplete={onComplete}
    />
  )
}

function BookingInput({
  selection,
  onComplete,
}: {
  selection: BookingSelection
  onComplete?: (id: number) => void
}) {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState)
  const [errors, setErrors] = useState<GuestErrors>({})
  const reviewTitle = useRef<HTMLHeadingElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const previousStep = useRef(state.step)
  useEffect(() => {
    if (previousStep.current !== state.step) {
      if (state.step === 'review') reviewTitle.current?.focus()
      else nameInput.current?.focus()
      previousStep.current = state.step
    }
  }, [state.step])
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = validateGuest(state.guest)
    setErrors(next)
    if (!Object.keys(next).length)
      dispatch({ type: 'review', request: buildBookingRequest(selection, state.guest) })
  }
  return (
    <section className="booking-flow" aria-label="예약 정보 입력 및 확인">
      <header className="booking-flow-header">
        <p className="booking-eyebrow">YOUR NEXT STAY</p>
        <h3>머무름을 준비하세요</h3>
        <ol className="booking-steps" aria-label="예약 입력 진행 단계">
          <li aria-current={state.step === 'input' ? 'step' : undefined}>1. 투숙객 입력</li>
          <li aria-current={state.step === 'review' ? 'step' : undefined}>2. 최종 확인</li>
        </ol>
        <p>아래 확인 단계를 마친 후 예약 생성을 직접 요청합니다.</p>
      </header>
      <p className="booking-accommodation">
        숙소: {selection.accommodation.name ?? `ID ${selection.accommodation.accommodationId}`}
      </p>
      <div className="booking-input-layout">
        <BookingSummary room={selection.room} request={selection.stay} />
        <div className="booking-input-content">
          <p className="booking-note">
            예약 소유자는 로그인한 회원입니다. 대표 투숙객은 별도로 입력하세요.
          </p>
          {state.step === 'input' ? (
            <form
              className="booking-guest-form"
              aria-label="대표 투숙객 정보"
              noValidate
              onSubmit={review}
            >
              <h3>대표 투숙객 정보</h3>
              <p className="booking-note">
                예약 안내를 받을 정보를 입력하세요. 모든 항목은 필수입니다.
              </p>
              {(['name', 'email', 'phone'] as const).map((field, index) => (
                <div className="form-field" key={field}>
                  <label htmlFor={`booking-${field}`}>
                    {['대표 투숙객 이름', '대표 투숙객 이메일', '대표 투숙객 연락처'][index]}
                  </label>
                  <input
                    ref={field === 'name' ? nameInput : undefined}
                    id={`booking-${field}`}
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                    autoComplete={field === 'phone' ? 'tel' : field}
                    required
                    maxLength={{ name: 100, email: 255, phone: 30 }[field]}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={errors[field] ? `booking-${field}-error` : undefined}
                    value={state.guest[field]}
                    onChange={(event) => {
                      dispatch({ type: 'change', field, value: event.target.value })
                      setErrors((current) => ({ ...current, [field]: undefined }))
                    }}
                  />
                  {errors[field] && (
                    <p id={`booking-${field}-error`} role="alert">
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
              <div className="booking-cta">
                <p className="booking-note">
                  다음 단계에서 입력 내용을 확인합니다. 아직 예약되지 않습니다.
                </p>
                <button type="submit">예약 입력 내용 확인</button>
              </div>
            </form>
          ) : (
            <section
              className="confirmation-panel booking-review"
              aria-labelledby="booking-review-title"
            >
              <h3 id="booking-review-title" ref={reviewTitle} tabIndex={-1}>
                제출 전 최종 확인
              </h3>
              <div className="booking-guest-details">
                <p>대표 투숙객: {state.request.representativeGuest.name}</p>
                <p>안내 이메일: {state.request.representativeGuest.email}</p>
                <p>연락처: {state.request.representativeGuest.phone}</p>
              </div>
              <p className="booking-review-notice">
                위 숙소·객실·날짜·인원과 예상 금액을 확인하세요. 예약은 아직 생성되지 않았습니다.
              </p>
              <BookingSubmit
                request={state.request}
                onComplete={onComplete}
                onEdit={() => dispatch({ type: 'edit' })}
              />
            </section>
          )}
          <p className="booking-note">
            입력 정보는 이 화면에만 유지됩니다. 새로고침·화면 이탈·객실 또는 조건 변경 시
            초기화됩니다.
          </p>
        </div>
      </div>
    </section>
  )
}
