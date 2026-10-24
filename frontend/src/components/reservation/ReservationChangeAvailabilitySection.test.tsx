import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReservationChangeAvailabilitySection } from './ReservationChangeAvailabilitySection'
import { reservationDetail } from '../../test/reservation'
import { room, roomPage } from '../../test/room'

const found = '현재 객실이 일반 신규 예약 가능 목록에 포함되어 있습니다.'
const missing = '현재 객실이 일반 신규 예약 가능 목록에 없습니다.'
const submit = () => fireEvent.submit(screen.getByRole('form', { name: '예약 변경 날짜 조건' }))
const open = () => fireEvent.click(screen.getByRole('button', { name: '예약 일정 변경 준비' }))
function dates(start = '2030-01-02', end = '2030-01-04') {
  fireEvent.change(screen.getByLabelText('새 체크인'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('새 체크아웃'), { target: { value: end } })
}
function renderPreparation() {
  return render(
    <ReservationChangeAvailabilitySection reservation={reservationDetail} accommodationId={7} />,
  )
}

describe('reservation change date preparation', () => {
  it('keeps the original reservation and fixed room/count, querying only on explicit submission', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(roomPage()))
    vi.stubGlobal('fetch', mock)
    renderPreparation()
    expect(screen.queryByRole('form')).toBeNull()
    open()
    expect(mock).not.toHaveBeenCalled()
    expect(screen.getByText('현재 예약 일정: 2030-01-01 ~ 2030-01-03')).toBeTruthy()
    expect(screen.getByText('객실 ID: 3 · 인원: 2명 (변경하지 않음)')).toBeTruthy()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    dates()
    submit()
    expect(screen.getByText('새 일정의 일반 가용성을 확인하고 있습니다.')).toBeTruthy()
    await screen.findByText(found)
    expect(screen.getByText(/일정 변경 성공을 보장하지/)).toBeTruthy()
    expect(screen.getByText('현재 예약 일정: 2030-01-01 ~ 2030-01-03')).toBeTruthy()
    expect(mock.mock.calls[0][0]).toContain(
      'checkInDate=2030-01-02&checkOutDate=2030-01-04&guestCount=2',
    )
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    expect(reservationDetail.checkInDate).toBe('2030-01-01')
  })
  it.each([
    [[], 0],
    [[{ ...room, roomId: 4, name: '다른 객실' }], 1],
  ])(
    'does not claim change denial or switch rooms when the current room is absent %j',
    async (content, totalElements) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json(roomPage({ content, totalElements, totalPages: totalElements ? 1 : 0 })),
          ),
      )
      renderPreparation()
      open()
      dates()
      submit()
      await screen.findByText(missing)
      expect(screen.getByText(/이 결과만으로 변경을 차단하지/)).toBeTruthy()
      expect(screen.queryByText('다른 객실')).toBeNull()
      expect(screen.queryByRole('button', { name: /선택/ })).toBeNull()
      expect(screen.getByRole('button', { name: '변경 날짜 가용성 조회' })).toHaveProperty(
        'disabled',
        false,
      )
    },
  )
  it.each([
    ['', '2030-01-04'],
    ['2030-01-02', ''],
    ['2030-01-02', '2030-01-02'],
    ['2030-01-03', '2030-01-02'],
  ])('blocks invalid dates %s / %s without querying', (start, end) => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    renderPreparation()
    open()
    dates(start, end)
    submit()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
  })
  it.each(['새 체크인', '새 체크아웃'])(
    'clears old availability immediately on editing %s and requires a fresh GET',
    async (label) => {
      const mock = vi.fn().mockImplementation(() => Response.json(roomPage()))
      vi.stubGlobal('fetch', mock)
      renderPreparation()
      open()
      dates()
      submit()
      await screen.findByText(found)
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: label === '새 체크인' ? '2030-01-03' : '2030-01-05' },
      })
      expect(screen.queryByText(found)).toBeNull()
      expect(mock).toHaveBeenCalledTimes(1)
      submit()
      await screen.findByText(found)
      expect(mock).toHaveBeenCalledTimes(2)
    },
  )
  it('explicit re-query of identical dates gets a new response', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(roomPage()))
      .mockResolvedValueOnce(
        Response.json(roomPage({ content: [], totalElements: 0, totalPages: 0 })),
      )
    vi.stubGlobal('fetch', mock)
    renderPreparation()
    open()
    dates()
    submit()
    await screen.findByText(found)
    submit()
    expect(screen.queryByText(found)).toBeNull()
    await screen.findByText(missing)
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it.each([400, 401, 403, 404, 409, 500])(
    'handles HTTP %i without treating failure as unavailability and retries only GET',
    async (status) => {
      const mock = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ status, code: 'INVENTORY_TEST', message: '서버 검증 오류' }, { status }),
        )
        .mockResolvedValue(Response.json(roomPage()))
      vi.stubGlobal('fetch', mock)
      renderPreparation()
      open()
      dates()
      submit()
      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('INVENTORY_TEST')
      expect(alert.textContent).toContain('서버 검증 오류')
      expect(screen.queryByText(missing)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      await screen.findByText(found)
      expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    },
  )
  it('shows network failure and removes the error when dates change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    renderPreparation()
    open()
    dates()
    submit()
    await screen.findByRole('alert')
    expect(screen.getByText(/연결 상태를 확인/)).toBeTruthy()
    expect(screen.queryByText(missing)).toBeNull()
    dates('2030-01-03', '2030-01-05')
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it.each(['direct input', 'calendar apply'])(
    'aborts and ignores an old response after %s',
    async (edit) => {
      let finish!: (response: Response) => void
      const mock = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              finish = resolve
            }),
        )
        .mockResolvedValue(
          Response.json(roomPage({ content: [], totalElements: 0, totalPages: 0 })),
        )
      vi.stubGlobal('fetch', mock)
      renderPreparation()
      open()
      dates()
      submit()
      await waitFor(() => expect(finish).toBeTypeOf('function'))
      const signal = mock.mock.calls[0][1].signal as AbortSignal
      if (edit === 'direct input') {
        dates('2030-01-03', '2030-01-05')
      } else {
        fireEvent.click(screen.getByRole('button', { name: '날짜 달력 열기' }))
        fireEvent.click(screen.getByRole('button', { name: '2030-01-03' }))
        fireEvent.click(screen.getByRole('button', { name: '2030-01-05' }))
        fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
      }
      expect(signal.aborted).toBe(true)
      submit()
      await screen.findByText(missing)
      await act(async () => finish(Response.json(roomPage())))
      expect(screen.queryByText(found)).toBeNull()
      expect(screen.getByText('조회한 새 일정: 2030-01-03 ~ 2030-01-05 · 2명')).toBeTruthy()
    },
  )
  it('closing the preparation clears the draft and cancels in-flight requests', async () => {
    const mock = vi.fn().mockReturnValue(new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', mock)
    renderPreparation()
    open()
    dates()
    submit()
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1))
    const signal = mock.mock.calls[0][1].signal as AbortSignal
    open()
    expect(signal.aborted).toBe(true)
    expect(screen.queryByRole('form')).toBeNull()
    open()
    expect(screen.getByLabelText('새 체크인')).toHaveProperty(
      'value',
      reservationDetail.checkInDate,
    )
    expect(screen.queryByText(found)).toBeNull()
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('resets the preparation when the original reservation changes and hides it for cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(roomPage())))
    const view = renderPreparation()
    open()
    dates()
    submit()
    await screen.findByText(found)
    view.rerender(
      <ReservationChangeAvailabilitySection
        reservation={{ ...reservationDetail, reservationId: 43 }}
        accommodationId={7}
      />,
    )
    expect(screen.queryByRole('form')).toBeNull()
    open()
    expect(screen.queryByText(found)).toBeNull()
    view.rerender(
      <ReservationChangeAvailabilitySection
        reservation={{ ...reservationDetail, status: 'CANCELLED' }}
        accommodationId={7}
      />,
    )
    expect(screen.queryByRole('button', { name: '예약 일정 변경 준비' })).toBeNull()
    expect(screen.queryByRole('form')).toBeNull()
  })
  it('requires a catalogue accommodation ID and never guesses it from the reservation ID', () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    render(
      <ReservationChangeAvailabilitySection
        reservation={reservationDetail}
        accommodationId={null}
      />,
    )
    expect(screen.getByRole('button', { name: '예약 일정 변경 준비' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByText(/현재 객실의 숙소 정보를 조회해야/)).toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
  })
})
