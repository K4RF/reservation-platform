import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReservationChangeConfirmation } from './ReservationChangeConfirmation'
import { reservationChangeFailure } from './reservationChangeFailure'
import { ApiError } from '../../api/errors'
import { reservationDetail, changedReservationDetail } from '../../test/reservation'
import { setTokenPair } from '../../state/accessToken'
import { accessTokenWithExpiry } from '../../test/jwt'

const request = { checkInDate: '2030-01-02', checkOutDate: '2030-01-04' }
const patchButton = () => screen.getByRole('button', { name: '예약 일정 변경 확정' })
function priceResponse(url: string) {
  return Response.json({
    roomId: 3,
    stayDate: url.slice(-10),
    nightlyPrice: 100.1,
    source: 'DEFAULT',
    roomDailyPriceId: null,
  })
}
function prepare(onRefresh = vi.fn(), onLock = vi.fn()) {
  return render(
    <ReservationChangeConfirmation
      reservation={reservationDetail}
      request={request}
      onRefresh={onRefresh}
      onLock={onLock}
    />,
  )
}
async function acknowledge() {
  await screen.findByText('새 일정 참고 예상 총액: 200.20')
  fireEvent.click(screen.getByRole('checkbox'))
}

describe('reservation change confirmation', () => {
  it('shows separate saved and reference prices, requires confirmation and blocks duplicate PATCH', async () => {
    let finish!: (response: Response) => void
    const mock = vi.fn((url: string, init: RequestInit) =>
      init.method === 'PATCH'
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : Promise.resolve(priceResponse(url)),
    )
    vi.stubGlobal('fetch', mock)
    const refresh = vi.fn(),
      lock = vi.fn()
    prepare(refresh, lock)
    expect(screen.getByText('기존 확정 총액: 350.25')).toBeTruthy()
    await screen.findByText('새 일정 참고 예상 총액: 200.20')
    expect(patchButton()).toHaveProperty('disabled', true)
    await acknowledge()
    fireEvent.click(patchButton())
    fireEvent.click(patchButton())
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(lock).toHaveBeenLastCalledWith(true)
    expect(patchButton()).toHaveProperty('disabled', true)
    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true)
    expect(screen.getByText('일정을 변경하고 있습니다. 중복 제출하지 마세요.')).toBeTruthy()
    await act(async () => finish(Response.json(changedReservationDetail)))
    expect(refresh).toHaveBeenCalledExactlyOnceWith(changedReservationDetail)
    expect(screen.getByText('일정 변경 완료. 서버 확정 총액: 550.15')).toBeTruthy()
    expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
    expect(reservationDetail.totalAmount).toBe(350.25)
  })
  it.each([
    [400, 'COMMON_001'],
    [403, 'RESERVATION_004'],
    [404, 'INVENTORY_003'],
    [409, 'INVENTORY_005'],
    [409, 'INVENTORY_011'],
    [409, 'BOOKING_POLICY_005'],
    [409, 'RESERVATION_006'],
  ])('keeps the original after definite %i %s rejection', async (status, code) => {
    const mock = vi.fn((url: string, init: RequestInit) =>
      Promise.resolve(
        init.method === 'PATCH'
          ? Response.json(
              {
                status,
                code,
                message: '서버 검증 거절',
                errors: [{ field: 'checkInDate', message: '날짜 확인' }],
              },
              { status },
            )
          : priceResponse(url),
      ),
    )
    vi.stubGlobal('fetch', mock)
    const refresh = vi.fn(),
      lock = vi.fn()
    prepare(refresh, lock)
    await acknowledge()
    fireEvent.click(patchButton())
    expect((await screen.findByRole('alert')).textContent).toContain(code)
    expect(screen.getByRole('alert').textContent).toContain('checkInDate: 날짜 확인')
    expect(screen.getByText('기존 일정: 2030-01-01 ~ 2030-01-03')).toBeTruthy()
    expect(screen.getByText('기존 확정 총액: 350.25')).toBeTruthy()
    expect(lock).toHaveBeenLastCalledWith(false)
    expect(refresh).not.toHaveBeenCalled()
    expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    expect(refresh).toHaveBeenCalledExactlyOnceWith()
  })
  it.each(['network', '500', 'malformed'])(
    'locks an ambiguous %s result until detail GET, without replay',
    async (kind) => {
      const mock = vi.fn((url: string, init: RequestInit) => {
        if (init.method !== 'PATCH') return Promise.resolve(priceResponse(url))
        if (kind === 'network') return Promise.reject(new TypeError('offline'))
        return Promise.resolve(
          kind === '500' ? Response.json({}, { status: 500 }) : Response.json({}),
        )
      })
      vi.stubGlobal('fetch', mock)
      const refresh = vi.fn(),
        lock = vi.fn()
      prepare(refresh, lock)
      await acknowledge()
      fireEvent.click(patchButton())
      expect((await screen.findByRole('alert')).textContent).toContain('이미 변경됐을 수')
      expect(lock).toHaveBeenLastCalledWith(true)
      expect(patchButton()).toHaveProperty('disabled', true)
      fireEvent.click(patchButton())
      expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
      expect(refresh).toHaveBeenCalledExactlyOnceWith()
    },
  )
  it('retries failed price GET, never PATCH, before allowing confirmation', async () => {
    let fail = true
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(fail ? Response.json({}, { status: 500 }) : priceResponse(url)),
      )
    vi.stubGlobal('fetch', mock)
    prepare()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(patchButton())
    expect(patchButton()).toHaveProperty('disabled', true)
    fail = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('새 일정 참고 예상 총액: 200.20')
    expect(patchButton()).toHaveProperty('disabled', false)
    expect(mock.mock.calls.every(([, init]) => (init as RequestInit).method === 'GET')).toBe(true)
  })
  it.each(['unmount', 'session'])('ignores late PATCH completion after %s', async (kind) => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) =>
        init.method === 'PATCH'
          ? new Promise<Response>((resolve) => {
              finish = resolve
              signal = init.signal as AbortSignal
            })
          : Promise.resolve(priceResponse(url)),
      ),
    )
    const refresh = vi.fn(),
      lock = vi.fn()
    const view = prepare(refresh, lock)
    await acknowledge()
    fireEvent.click(patchButton())
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    if (kind === 'unmount') {
      view.unmount()
      expect(signal.aborted).toBe(true)
    } else setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'new-refresh')
    await act(async () => finish(Response.json(changedReservationDetail)))
    expect(refresh).not.toHaveBeenCalled()
  })
  it.each(['timeout', 'cancelled', 'unexpected_response'] as const)(
    'classifies %s as uncertain, not a retryable rollback',
    (kind) => {
      expect(reservationChangeFailure(new ApiError('failure', { kind })).uncertain).toBe(true)
    },
  )
})
