import { fireEvent, screen } from '@testing-library/react'
import { bookingRequest } from './reservation'
import { setGuests, setStayDates } from './searchLayers'

// Shared user actions, not mocks of Booking components or API helpers.
export async function selectBookingRoom() {
  await screen.findByRole('button', { name: '숙박 날짜 선택' })
  setStayDates(bookingRequest.checkInDate, bookingRequest.checkOutDate, '숙박')
  setGuests('2', '숙박 인원')
  fireEvent.submit(screen.getByRole('form', { name: '객실 가용성 조건' }))
  fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
}

export async function reviewBooking(expectedTotal = '200.00') {
  await selectBookingRoom()
  for (const [label, value] of [
    ['대표 투숙객 이름', bookingRequest.representativeGuest.name],
    ['대표 투숙객 이메일', bookingRequest.representativeGuest.email],
    ['대표 투숙객 연락처', bookingRequest.representativeGuest.phone],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
  await screen.findByText(`총 예상 금액: ${expectedTotal}`)
}
