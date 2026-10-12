import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReservationCancellationSection } from './ReservationCancellationSection'
import { ReservationCancellationSummary } from './ReservationCancellationSummary'
import { reservationDetail } from '../../test/reservation'

const open = () => fireEvent.click(screen.getByRole('button', { name: '취소 정책 및 수수료 확인' }))
const review = () => screen.findByText('취소 전 예상 수수료 금액: 제공되지 않음')
const cancelled = {
  ...reservationDetail,
  status: 'CANCELLED' as const,
  cancelledAt: '2029-12-30T00:00:00.123456789Z',
  cancellationFeeAmount: 175.13,
  refundAmount: 175.12,
}

describe('stored cancellation policy and confirmation', () => {
  it('loads fresh owner detail only on opening and acknowledges without cancelling or calculating a quote', async () => {
    const mock = vi.fn().mockImplementation(() => Response.json(reservationDetail))
    vi.stubGlobal('fetch', mock)
    render(<ReservationCancellationSection reservation={reservationDetail} />)
    expect(mock).not.toHaveBeenCalled()
    open()
    expect(screen.getByText('저장된 취소 정책과 예약 상태를 다시 조회하고 있습니다.')).toBeTruthy()
    await review()
    expect(screen.getByText('취소 전 예상 환불 금액: 제공되지 않음')).toBeTruthy()
    expect(screen.getByText('저장된 예약 총액: 350.25')).toBeTruthy()
    expect(screen.getByText('취소 마감: 체크인 1일 전까지')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(
      screen.getByText('안내를 확인했습니다. 아직 취소 요청은 전송되지 않았습니다.'),
    ).toBeTruthy()
    const button = screen.getByRole('button', { name: '예약 취소 실행 (준비 중)' })
    expect(button).toHaveProperty('disabled', true)
    fireEvent.click(button)
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatch(/\/reservations\/42$/)
    expect(mock.mock.calls[0][1].method).toBe('GET')
    open()
    expect(screen.queryByRole('checkbox')).toBeNull()
    open()
    await review()
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
    expect(mock).toHaveBeenCalledTimes(2)
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('renders custom saved thresholds including a zero-day deadline without choosing the currently applicable tier', async () => {
    const detail = {
      ...reservationDetail,
      cancellationPolicySnapshot: {
        freeCancellationDaysBeforeCheckIn: 14,
        cancellationDeadlineDaysBeforeCheckIn: 0,
        feeRules: [
          { minDaysBeforeCheckIn: 7, feeRatePercent: 20 },
          { minDaysBeforeCheckIn: 2, feeRatePercent: 60 },
          { minDaysBeforeCheckIn: 0, feeRatePercent: 100 },
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(detail)))
    render(<ReservationCancellationSection reservation={reservationDetail} />)
    open()
    await review()
    expect(screen.getByText('체크인 14일 전 이상: 무료 취소')).toBeTruthy()
    expect(screen.getByText('체크인 7–13일 전: 예약 총액의 20% 수수료')).toBeTruthy()
    expect(screen.getByText('체크인 2–6일 전: 예약 총액의 60% 수수료')).toBeTruthy()
    expect(screen.getByText('체크인 0–1일 전: 예약 총액의 100% 수수료')).toBeTruthy()
    expect(screen.getByText('취소 마감: 체크인 0일 전까지')).toBeTruthy()
    expect(screen.queryByText('체크인 7일 전 이상: 무료 취소')).toBeNull()
  })
  it('shows a server-cancelled status found during review and offers GET refresh, never another cancel', async () => {
    const refresh = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(cancelled)))
    render(<ReservationCancellationSection reservation={reservationDetail} onRefresh={refresh} />)
    open()
    await screen.findByRole('heading', { name: '이미 취소된 예약의 저장 결과' })
    expect(screen.getByText('175.13')).toBeTruthy()
    expect(screen.getByText('175.12')).toBeTruthy()
    expect(screen.getByText(cancelled.cancelledAt)).toHaveProperty(
      'dateTime',
      cancelled.cancelledAt,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: '예약 취소 실행 (준비 중)' })).toBeNull()
    expect(screen.queryByText('취소 전 예상 수수료 금액: 제공되지 않음')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    expect(refresh).toHaveBeenCalledOnce()
  })
  it('hides the action for already cancelled input without requesting', () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    render(<ReservationCancellationSection reservation={cancelled} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(mock).not.toHaveBeenCalled()
  })
  it.each([400, 401, 403, 404, 409, 500])(
    'handles HTTP %i with code/field details and GET-only retry',
    async (status) => {
      const mock = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            {
              status,
              code: 'RESERVATION_TEST',
              message: '서버 거절',
              errors: [{ field: 'reservationId', message: '예약 확인' }],
            },
            { status },
          ),
        )
        .mockImplementation(() => Response.json(reservationDetail))
      vi.stubGlobal('fetch', mock)
      render(<ReservationCancellationSection reservation={reservationDetail} />)
      open()
      expect((await screen.findByRole('alert')).textContent).toContain(
        '[RESERVATION_TEST] 서버 거절',
      )
      expect(screen.getByRole('alert').textContent).toContain('reservationId: 예약 확인')
      expect(screen.queryByRole('checkbox')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      await review()
      expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    },
  )
  it.each(['network', 'malformed'])(
    'reports %s rather than claiming cancellation is allowed',
    async (kind) => {
      vi.stubGlobal(
        'fetch',
        kind === 'network'
          ? vi.fn().mockRejectedValue(new TypeError('offline'))
          : vi
              .fn()
              .mockResolvedValue(
                Response.json({ ...reservationDetail, cancellationPolicySnapshot: null }),
              ),
      )
      render(<ReservationCancellationSection reservation={reservationDetail} />)
      open()
      await screen.findByRole('alert')
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(screen.queryByRole('button', { name: '예약 취소 실행 (준비 중)' })).toBeNull()
    },
  )
  it('aborts and ignores a late read after closing', async () => {
    let finish!: (response: Response) => void
    const mock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', mock)
    render(<ReservationCancellationSection reservation={reservationDetail} />)
    open()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    const signal = mock.mock.calls[0][1].signal as AbortSignal
    open()
    expect(signal.aborted).toBe(true)
    await act(async () => finish(Response.json(cancelled)))
    expect(screen.queryByRole('heading', { name: '이미 취소된 예약의 저장 결과' })).toBeNull()
  })
  it('resets acknowledged review when the source snapshot or ID changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Response.json(reservationDetail)),
    )
    const view = render(<ReservationCancellationSection reservation={reservationDetail} />)
    open()
    await review()
    fireEvent.click(screen.getByRole('checkbox'))
    view.rerender(
      <ReservationCancellationSection
        reservation={{ ...reservationDetail, totalAmount: 550.15 }}
      />,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    open()
    await review()
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
    view.rerender(
      <ReservationCancellationSection reservation={{ ...reservationDetail, reservationId: 43 }} />,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
  it.each(['2029-12-01T00:00:00Z', '2030-01-01T00:00:00Z', '2040-01-01T00:00:00Z'])(
    'never infers a fee or denies a CONFIRMED reservation from browser time %s',
    (now) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(now))
      render(<ReservationCancellationSummary reservation={reservationDetail} />)
      expect(screen.getByText('취소 전 예상 수수료 금액: 제공되지 않음')).toBeTruthy()
      expect(screen.getByText('취소 전 예상 환불 금액: 제공되지 않음')).toBeTruthy()
      expect(screen.queryByText(/현재 적용 수수료율/)).toBeNull()
    },
  )
  it.each([
    [0, 350.25, '0.00', '350.25'],
    [350.25, 0, '350.25', '0.00'],
    [null, null, '저장된 정보 없음', '저장된 정보 없음'],
  ] as const)(
    'shows stored result %s/%s without fabricating null data or missing zero',
    (fee, refund, feeLabel, refundLabel) => {
      render(
        <ReservationCancellationSummary
          reservation={{ ...cancelled, cancellationFeeAmount: fee, refundAmount: refund }}
        />,
      )
      expect(screen.getAllByText(feeLabel).length).toBeGreaterThan(0)
      expect(screen.getAllByText(refundLabel).length).toBeGreaterThan(0)
      expect(
        screen.getByText('저장된 취소 결과이며 결제 취소·환불 완료를 의미하지 않습니다.'),
      ).toBeTruthy()
    },
  )
})
