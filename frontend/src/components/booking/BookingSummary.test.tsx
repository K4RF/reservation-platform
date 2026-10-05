import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingSummary } from './BookingSummary'
import { room } from '../../test/room'

const request = { checkInDate: '2030-01-01', checkOutDate: '2030-01-03', guestCount: 2 }
function mockPrices() {
  const mock = vi.fn().mockImplementation((url: string) =>
    Promise.resolve(
      Response.json({
        roomDailyPriceId: url.endsWith('2030-01-01') ? 9 : null,
        roomId: Number(url.match(/\/rooms\/(\d+)/)?.[1]),
        stayDate: url.slice(-10),
        nightlyPrice: url.endsWith('2030-01-01') ? 180000.55 : 100000.1,
        source: url.endsWith('2030-01-01') ? 'DAILY' : 'DEFAULT',
      }),
    ),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}
describe('BookingSummary', () => {
  it('renders the stay, base information, backend nightly breakdown and expected total', async () => {
    mockPrices()
    render(<BookingSummary room={room} request={request} />)
    expect(screen.getByText('숙박일별 요금을 확인하고 있습니다.')).toBeTruthy()
    await screen.findByText('총 예상 금액: 280,000.65')
    expect(screen.getByText('2박')).toBeTruthy()
    expect(screen.getByText('날짜별 요금')).toBeTruthy()
    expect(screen.getByText('기본 요금')).toBeTruthy()
    expect(screen.getByText(/최종 금액은 예약 생성 시 Backend/)).toBeTruthy()
  })
  it('does not show a partial total on failure and retries all prices', async () => {
    const mock = mockPrices()
    mock.mockRejectedValueOnce(new TypeError('offline'))
    render(<BookingSummary room={room} request={request} />)
    await screen.findByRole('alert')
    expect(screen.queryByText(/총 예상 금액:/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('총 예상 금액: 280,000.65')
  })
  it('clears old price state and requests the changed room and dates', async () => {
    const mock = mockPrices()
    const view = render(<BookingSummary room={room} request={request} />)
    await screen.findByText('총 예상 금액: 280,000.65')
    view.rerender(
      <BookingSummary
        room={{ ...room, roomId: 4 }}
        request={{ ...request, checkOutDate: '2030-01-02' }}
      />,
    )
    expect(screen.queryByText('총 예상 금액: 280,000.65')).toBeNull()
    await screen.findByText('총 예상 금액: 180,000.55')
    expect(mock.mock.calls.at(-1)![0]).toContain('/rooms/4/prices/')
  })
  it('ignores late prices after changing the selected room', async () => {
    let resolveOld!: (response: Response) => void
    const mock = mockPrices()
    mock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve
        }),
    )
    const view = render(
      <BookingSummary room={room} request={{ ...request, checkOutDate: '2030-01-02' }} />,
    )
    view.rerender(
      <BookingSummary
        room={{ ...room, roomId: 4 }}
        request={{ ...request, checkOutDate: '2030-01-02' }}
      />,
    )
    await screen.findByText('총 예상 금액: 180,000.55')
    resolveOld(
      Response.json({
        roomDailyPriceId: 1,
        roomId: 3,
        stayDate: '2030-01-01',
        nightlyPrice: 1,
        source: 'DAILY',
      }),
    )
    await waitFor(() => expect(screen.queryByText('총 예상 금액: 1.00')).toBeNull())
  })
})
