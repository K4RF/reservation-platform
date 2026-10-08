import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from './jwt'
import { accommodation } from './accommodation'
import { roomPage } from './room'
import { bookingRequest, reservationResult } from './reservation'

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}
function renderAt(path = '/accommodations/7') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <Location />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function mockApi(rejectFirst = false) {
  let attempts = 0
  const mock = vi.fn((url: string, init: RequestInit) => {
    if (init.method === 'POST') {
      attempts++
      if (rejectFirst && attempts === 1)
        return Promise.resolve(
          Response.json(
            {
              status: 400,
              code: 'COMMON_001',
              message: '입력 오류',
              errors: [{ field: 'representativeGuest.email', message: '이메일 확인' }],
            },
            { status: 400 },
          ),
        )
      return Promise.resolve(Response.json(reservationResult, { status: 201 }))
    }
    return Promise.resolve(
      Response.json(
        url.includes('/reservations/')
          ? reservationResult
          : url.includes('/prices/')
            ? {
                roomDailyPriceId: null,
                roomId: 3,
                stayDate: url.slice(-10),
                nightlyPrice: 100,
                source: 'DEFAULT',
              }
            : url.includes('/rooms')
              ? roomPage()
              : accommodation,
      ),
    )
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
async function reachReview() {
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
  for (const [label, value] of [
    ['대표 투숙객 이름', bookingRequest.representativeGuest.name],
    ['대표 투숙객 이메일', bookingRequest.representativeGuest.email],
    ['대표 투숙객 연락처', bookingRequest.representativeGuest.phone],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
  await screen.findByText('총 예상 금액: 200.00')
}
describe('authenticated booking creation flow (HTTP boundary mocks)', () => {
  it('creates once, replaces draft route, and displays backend amount rather than estimate', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const mock = mockApi()
    renderAt()
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByText('예약이 확정되었습니다.')
    expect(screen.getByTestId('location').textContent).toBe('/reservations/42/complete')
    expect(screen.getByText('예약 금액 Snapshot: 350.25')).toBeTruthy()
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
    const posts = mock.mock.calls.filter(([, init]) => init.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0][1].body as string)).toEqual(bookingRequest)
    expect(new Headers(posts[0][1].headers).get('Authorization')).toBe(`Bearer ${token}`)
  })
  it('preserves guest values on validation failure and only retries after explicit action', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = mockApi(true)
    renderAt()
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'representativeGuest.email: 이메일 확인',
      ),
    )
    expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '투숙객 정보 수정' }))
    expect((screen.getByLabelText('대표 투숙객 이름') as HTMLInputElement).value).toBe('홍길동')
    fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByText('예약이 확정되었습니다.')
    expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(2)
  })
  it.each(['/accommodations/7', '/reservations/42/complete'])(
    'requires login on direct %s access and sends no reservation requests',
    (path) => {
      const mock = mockApi()
      renderAt(path)
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      expect(mock).not.toHaveBeenCalled()
    },
  )
})
