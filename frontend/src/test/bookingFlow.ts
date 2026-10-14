import { fireEvent, screen } from '@testing-library/react'
import { bookingRequest } from './reservation'

// Shared user actions, not mocks of Booking components or API helpers.
export async function selectBookingRoom() {
  await screen.findByLabelText('숙박 체크인')
  fireEvent.change(screen.getByLabelText('숙박 체크인'), {
    target: { value: bookingRequest.checkInDate },
  })
  fireEvent.change(screen.getByLabelText('숙박 체크아웃'), {
    target: { value: bookingRequest.checkOutDate },
  })
  fireEvent.change(screen.getByLabelText('숙박 인원'), { target: { value: '2' } })
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
