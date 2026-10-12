import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReservationCancellationSection } from './ReservationCancellationSection'
import { reservationDetail, cancellationResponse } from '../../test/reservation'
import { setTokenPair } from '../../state/accessToken'
import { accessTokenWithExpiry } from '../../test/jwt'

async function submit() {
  fireEvent.click(screen.getByRole('button', { name: '취소 정책 및 수수료 확인' }))
  await screen.findByText('취소 전 예상 수수료 금액: 제공되지 않음')
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '예약 취소 확정' }))
}

describe('explicit cancellation submission', () => {
  it('locks duplicate submit, acknowledgement, closing and refresh until one PATCH finishes', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn((_: string, init: RequestInit) =>
      init.method === 'PATCH'
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : Response.json(reservationDetail),
    )
    vi.stubGlobal('fetch', fetch)
    const refresh = vi.fn(),
      cancelled = vi.fn(),
      lock = vi.fn()
    render(
      <ReservationCancellationSection
        reservation={reservationDetail}
        onRefresh={refresh}
        onCancelled={cancelled}
        onLock={lock}
      />,
    )
    await submit()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    for (const name of ['예약 취소 확정', '취소 정책 및 수수료 확인', '예약 상세 다시 조회']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveProperty('disabled', true)
      fireEvent.click(button)
    }
    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true)
    expect(screen.getByText('예약을 취소하고 있습니다. 중복 제출하지 마세요.')).toBeTruthy()
    expect(lock).toHaveBeenCalledWith(true)
    await act(async () => finish(Response.json(cancellationResponse)))
    expect(cancelled).toHaveBeenCalledExactlyOnceWith(cancellationResponse)
    expect(refresh).not.toHaveBeenCalled()
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it.each([
    [400, 'COMMON_001'],
    [401, 'AUTH_001'],
    [403, 'RESERVATION_004'],
    [404, 'RESERVATION_003'],
    [409, 'RESERVATION_005'],
    [409, 'RESERVATION_009'],
    [409, 'INVENTORY_011'],
    [503, 'INVENTORY_013'],
  ] as const)('shows HTTP %i/%s and requires owner GET, not cancel retry', async (status, code) => {
    const fetch = vi.fn((_: string, init: RequestInit) =>
      init.method === 'PATCH'
        ? Response.json(
            {
              status,
              code,
              message: '서버 거절',
              errors: [{ field: 'reservationId', message: '예약 확인' }],
            },
            { status },
          )
        : Response.json(reservationDetail),
    )
    vi.stubGlobal('fetch', fetch)
    const refresh = vi.fn()
    render(<ReservationCancellationSection reservation={reservationDetail} onRefresh={refresh} />)
    await submit()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(code)
    expect(alert.textContent).toContain('reservationId: 예약 확인')
    expect(screen.getByRole('button', { name: '예약 취소 확정' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '취소 정책 및 수수료 확인' })).toHaveProperty(
      'disabled',
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
  })
  it.each(['network', 'malformed', 'server'] as const)(
    'locks ambiguous %s result until detail confirmation',
    async (kind) => {
      vi.stubGlobal(
        'fetch',
        vi.fn((_: string, init: RequestInit) => {
          if (init.method !== 'PATCH') return Response.json(reservationDetail)
          if (kind === 'network') return Promise.reject(new TypeError('lost response'))
          return kind === 'malformed' ? Response.json({}) : Response.json({}, { status: 500 })
        }),
      )
      render(<ReservationCancellationSection reservation={reservationDetail} onRefresh={vi.fn()} />)
      await submit()
      expect((await screen.findByRole('alert')).textContent).toContain('서버에서 이미 취소됐을 수')
      expect(screen.getByRole('button', { name: '예약 취소 확정' })).toHaveProperty(
        'disabled',
        true,
      )
      expect(screen.getByRole('button', { name: '예약 상세 다시 조회' })).toHaveProperty(
        'disabled',
        false,
      )
    },
  )
  it('aborts on unmount and ignores the late successful response', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn((_: string, init: RequestInit) =>
      init.method === 'PATCH'
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : Response.json(reservationDetail),
    )
    vi.stubGlobal('fetch', fetch)
    const cancelled = vi.fn()
    const view = render(
      <ReservationCancellationSection reservation={reservationDetail} onCancelled={cancelled} />,
    )
    await submit()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    const signal = fetch.mock.calls.find(([, init]) => init.method === 'PATCH')![1].signal!
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => finish(Response.json(cancellationResponse)))
    expect(cancelled).not.toHaveBeenCalled()
  })
  it('ignores mutation response from a previous authenticated session', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((_: string, init: RequestInit) =>
        init.method === 'PATCH'
          ? new Promise<Response>((resolve) => {
              finish = resolve
            })
          : Response.json(reservationDetail),
      ),
    )
    const cancelled = vi.fn()
    render(
      <ReservationCancellationSection reservation={reservationDetail} onCancelled={cancelled} />,
    )
    await submit()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    act(() =>
      setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'new-session'),
    )
    await act(async () => finish(Response.json(cancellationResponse)))
    expect(cancelled).not.toHaveBeenCalled()
  })
})
