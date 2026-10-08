import { useReducer, useState, type FormEvent } from 'react'
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

export function BookingFlow({ selection }: { selection: BookingSelection | null }) {
  const error = validateSelection(selection)
  if (error || !selection) return <ErrorState message={error ?? '예약 조건을 다시 선택하세요.'} />
  const { accommodation, room, stay } = selection
  return (
    <BookingInput
      key={`${accommodation.accommodationId}:${room.roomId}:${stay.checkInDate}:${stay.checkOutDate}:${stay.guestCount}`}
      selection={selection}
    />
  )
}

function BookingInput({ selection }: { selection: BookingSelection }) {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState)
  const [errors, setErrors] = useState<GuestErrors>({})
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = validateGuest(state.guest)
    setErrors(next)
    if (!Object.keys(next).length)
      dispatch({ type: 'review', request: buildBookingRequest(selection, state.guest) })
  }
  return (
    <section aria-label="예약 정보 입력 및 확인">
      <p>숙소: {selection.accommodation.name ?? `ID ${selection.accommodation.accommodationId}`}</p>
      <BookingSummary room={selection.room} request={selection.stay} />
      <p>예약 소유자는 로그인한 회원입니다. 대표 투숙객은 별도로 입력하세요.</p>
      {state.step === 'input' ? (
        <form aria-label="대표 투숙객 정보" noValidate onSubmit={review}>
          <h3>대표 투숙객 정보</h3>
          {(['name', 'email', 'phone'] as const).map((field, index) => (
            <div className="form-field" key={field}>
              <label htmlFor={`booking-${field}`}>
                {['대표 투숙객 이름', '대표 투숙객 이메일', '대표 투숙객 연락처'][index]}
              </label>
              <input
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
          <button type="submit">예약 입력 내용 확인</button>
        </form>
      ) : (
        <section aria-labelledby="booking-review-title">
          <h3 id="booking-review-title">제출 전 최종 확인</h3>
          <p>대표 투숙객: {state.request.representativeGuest.name}</p>
          <p>안내 이메일: {state.request.representativeGuest.email}</p>
          <p>연락처: {state.request.representativeGuest.phone}</p>
          <p>위 숙소·객실·날짜·인원과 예상 금액을 확인하세요. 예약은 아직 생성되지 않았습니다.</p>
          <button type="button" onClick={() => dispatch({ type: 'edit' })}>
            투숙객 정보 수정
          </button>
          <button type="button" disabled>
            예약 생성 (후속 작업)
          </button>
        </section>
      )}
      <p>
        입력 정보는 이 화면에만 유지됩니다. 새로고침·화면 이탈·객실 또는 조건 변경 시 초기화됩니다.
      </p>
    </section>
  )
}
