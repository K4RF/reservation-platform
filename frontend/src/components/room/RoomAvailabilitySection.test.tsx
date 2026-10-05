import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoomAvailabilitySection } from './RoomAvailabilitySection'
import { room, roomPage } from '../../test/room'

const submit = () => fireEvent.submit(screen.getByRole('form', { name: '객실 가용성 조건' }))
function dates() {
  fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2030-01-01' } })
  fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-01-03' } })
}
function mockApi() {
  const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json(roomPage())))
  vi.stubGlobal('fetch', mock)
  return mock
}
describe('availability and selection lifecycle with real API client', () => {
  it('only queries after valid submission and selects a backend-returned room', async () => {
    const mock = mockApi()
    render(<RoomAvailabilitySection accommodationId={7} />)
    expect(mock).not.toHaveBeenCalled()
    dates()
    submit()
    expect(screen.getByText('예약 가능한 객실을 확인하고 있습니다.')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    expect(screen.getByRole('status', { name: '선택한 객실' }).textContent).toContain(
      '2030-01-01 ~ 2030-01-03',
    )
    expect(screen.getByRole('button', { name: '스탠다드 선택' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: '객실 선택 해제' }))
    expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
  })
  it('blocks same/reversed dates without API calls', () => {
    const mock = mockApi()
    render(<RoomAvailabilitySection accommodationId={7} />)
    dates()
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-01-01' } })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('늦은 날짜')
    expect(mock).not.toHaveBeenCalled()
  })
  it.each(['숙박 체크인', '숙박 체크아웃', '숙박 인원'])(
    'immediately clears selection/results when %s changes, even before submission',
    async (label) => {
      mockApi()
      render(<RoomAvailabilitySection accommodationId={7} />)
      dates()
      submit()
      fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: label === '숙박 인원' ? '2' : '2030-01-02' },
      })
      expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
      expect(screen.queryByRole('button', { name: '스탠다드 선택' })).toBeNull()
    },
  )
  it('resets dates, response and selection when accommodation changes', async () => {
    mockApi()
    const view = render(<RoomAvailabilitySection accommodationId={7} />)
    dates()
    submit()
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    view.rerender(<RoomAvailabilitySection accommodationId={8} />)
    expect((screen.getByLabelText('숙박 체크인') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
  })
  it('clears selection on re-query and room pagination', async () => {
    const mock = mockApi()
    mock.mockImplementation(() =>
      Promise.resolve(Response.json(roomPage({ totalPages: 2, last: false }))),
    )
    render(<RoomAvailabilitySection accommodationId={7} />)
    dates()
    submit()
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    submit()
    expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    mock.mockImplementationOnce(() =>
      Promise.resolve(Response.json(roomPage({ page: 1, first: false }))),
    )
    fireEvent.click(screen.getByRole('button', { name: '다음 가용 객실' }))
    await screen.findByRole('button', { name: '스탠다드 선택' })
    expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
    expect(mock.mock.calls.at(-1)![0]).toContain('page=1')
  })
  it('shows empty availability without selecting the ordinary room list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(roomPage({ content: [], totalElements: 0, totalPages: 0 })),
        ),
    )
    render(<RoomAvailabilitySection accommodationId={7} />)
    dates()
    submit()
    await screen.findByText('선택한 조건에 예약 가능한 객실이 없습니다.')
    expect(screen.queryByRole('button', { name: '스탠다드 선택' })).toBeNull()
  })
  it('does not reuse rooms after a failed query and supports retry', async () => {
    const mock = mockApi()
    mock.mockRejectedValueOnce(new TypeError('offline'))
    render(<RoomAvailabilitySection accommodationId={7} />)
    dates()
    submit()
    await screen.findByRole('alert')
    expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('button', { name: '스탠다드 선택' })
  })
  it('ignores old availability responses after dates change', async () => {
    let resolveOld!: (response: Response) => void
    const mock = mockApi()
    mock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce(
        Response.json(roomPage({ content: [{ ...room, roomId: 4, name: '새 객실' }] })),
      )
    render(<RoomAvailabilitySection accommodationId={7} />)
    dates()
    submit()
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-01-04' } })
    submit()
    await screen.findByRole('button', { name: '새 객실 선택' })
    resolveOld(Response.json(roomPage()))
    await waitFor(() => expect(screen.queryByRole('button', { name: '스탠다드 선택' })).toBeNull())
  })
})
