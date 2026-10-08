import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingSubmit } from './BookingSubmit'
import { bookingRequest, reservationResult } from '../../test/reservation'
import { bookingFailure } from './bookingFailure'
import { ApiError } from '../../api/errors'

describe('booking submission', () => {
  it('blocks rapid repeated clicks and locks success after one POST', async () => {
    let resolve!: (value: Response) => void
    const mock = vi.fn(
      () =>
        new Promise<Response>((next) => {
          resolve = next
        }),
    )
    vi.stubGlobal('fetch', mock)
    const onComplete = vi.fn()
    render(<BookingSubmit request={bookingRequest} onComplete={onComplete} onEdit={vi.fn()} />)
    const button = screen.getByRole('button', { name: '예약 생성' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: '투숙객 정보 수정' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolve(Response.json(reservationResult, { status: 201 }))
    })
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(42)
    expect(screen.queryByRole('button', { name: '예약 생성' })).toBeNull()
  })
  it.each([
    [400, 'COMMON_001'],
    [409, 'INVENTORY_005'],
    [409, 'INVENTORY_011'],
    [409, 'BOOKING_POLICY_005'],
    [503, 'INVENTORY_013'],
  ])('keeps explicit retry for definite domain rejection %s %s', async (status, code) => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            status,
            code,
            message: 'Backend 도메인 오류',
            errors: [{ field: 'representativeGuest.email', message: '형식 오류' }],
          },
          { status: status as number },
        ),
      )
      .mockResolvedValue(Response.json(reservationResult))
    vi.stubGlobal('fetch', mock)
    render(<BookingSubmit request={bookingRequest} onEdit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByRole('alert')
    expect(mock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '예약 생성 다시 시도' }))
    await screen.findByText(/예약 생성 완료: ID 42/)
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it('does not resend after network ambiguity', async () => {
    const mock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', mock)
    render(<BookingSubmit request={bookingRequest} onEdit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      '예약 생성 여부를 확인할 수 없습니다',
    )
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('does not navigate from a stale request after unmount', async () => {
    let resolve!: (value: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((next) => {
            resolve = next
          }),
      ),
    )
    const onComplete = vi.fn()
    const view = render(
      <BookingSubmit request={bookingRequest} onEdit={vi.fn()} onComplete={onComplete} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await waitFor(() => expect(resolve).toBeDefined())
    view.unmount()
    await act(async () => {
      resolve(Response.json(reservationResult))
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
  it.each(['network', 'timeout', 'cancelled', 'unexpected_response'] as const)(
    'never marks ambiguous %s failures retryable',
    (kind) => {
      expect(bookingFailure(new ApiError('failed', { kind })).retryable).toBe(false)
    },
  )
  it.each([401, 403, 500])('handles auth/server %i without replay', (status) => {
    expect(bookingFailure(new ApiError('failed', { kind: 'http', status })).retryable).toBe(false)
  })
})
