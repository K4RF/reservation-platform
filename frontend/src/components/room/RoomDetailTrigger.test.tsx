import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomResponse } from '../../api/room'
import { room } from '../../test/room'
import { mockDialog } from '../../test/dialog'
import { RoomCard } from './RoomCard'

mockDialog()
const stay = { checkInDate: '2030-01-01', checkOutDate: '2030-01-03', guestCount: 2 }
const path =
  '/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2&search=city%3D서울'

function Harness({
  available = false,
  scope = 'catalog:7:0',
  current = room,
}: {
  available?: boolean
  scope?: string
  current?: RoomResponse
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState<number | null>(null)
  return (
    <>
      <output data-testid="path">{location.pathname + location.search}</output>
      <output data-testid="state">{JSON.stringify(location.state)}</output>
      <output data-testid="selection">{chosen ?? 'none'}</output>
      <button onClick={() => navigate(-1)}>뒤로</button>
      <button onClick={() => navigate(1)}>앞으로</button>
      <button onClick={() => navigate('/other')}>다른 페이지</button>
      {location.pathname !== '/other' && (
        <>
          <h2 id="room-list-title" tabIndex={-1}>
            객실 정보
          </h2>
          <RoomCard
            key={scope}
            room={current}
            detail={{
              scope,
              fallbackId: 'room-list-title',
              ...(available ? { request: stay, onSelect: (next) => setChosen(next.roomId) } : {}),
            }}
          />
        </>
      )}
    </>
  )
}
function view(props: Parameters<typeof Harness>[0] = {}) {
  return render(<Harness {...props} />, {
    wrapper: ({ children }) => (
      <MemoryRouter
        initialEntries={[
          '/accommodations',
          {
            pathname: '/accommodations/7',
            search: path.slice(path.indexOf('?')),
            state: { keep: 'ok' },
          },
        ]}
      >
        {children}
      </MemoryRouter>
    ),
  })
}
function mockResponse(value: unknown = room, status = 200) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json(value, { status })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
function open() {
  const button = screen.getByRole('button', { name: `${room.name} 상세 보기` })
  fireEvent.click(button)
  return button
}
afterEach(() => {
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
})

describe('public room detail and history boundary', () => {
  it('loads only on open using a public GET and shows the seven DTO fields without fabricated media/currency', async () => {
    const fetch = mockResponse()
    view()
    expect(fetch).not.toHaveBeenCalled()
    open()
    const dialog = await screen.findByRole('dialog', { name: '객실 상세' })
    await within(dialog).findByRole('heading', { name: room.name })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/rooms/3')
    expect(fetch.mock.calls[0][1].method).toBe('GET')
    expect(new Headers(fetch.mock.calls[0][1].headers).has('Authorization')).toBe(false)
    for (const label of ['객실 ID', '숙소 ID', '총 수용 인원', '운영 상태', '기본 1박 가격']) {
      expect(within(dialog).getByText(label)).toBeTruthy()
    }
    expect(within(dialog).getByText('123,456.78')).toBeTruthy()
    expect(within(dialog).getByText(/사진·설명·침대·면적·전망을 제공하지 않습니다/)).toBeTruthy()
    expect(within(dialog).queryByRole('img')).toBeNull()
    expect(within(dialog).queryByText(/KRW|₩|\d[\d,.]*\s?원/)).toBeNull()
    expect(within(dialog).queryByRole('button', { name: '이 객실 선택' })).toBeNull()
    expect(screen.getByTestId('path').textContent).toBe(path)
    const state = JSON.parse(screen.getByTestId('state').textContent!)
    expect(state).toEqual({
      keep: 'ok',
      roomDetail: { scope: 'catalog:7:0', roomId: 3, accommodationId: 7 },
    })
    expect(screen.getByTestId('selection').textContent).toBe('none')
  })
  it('focuses close, locks scrolling, restores the trigger/position and preserves pre-existing overflow on close', async () => {
    mockResponse()
    document.body.style.overflow = 'clip'
    document.documentElement.style.overflow = 'auto'
    vi.spyOn(window, 'scrollY', 'get').mockReturnValueOnce(620)
    view()
    const trigger = open()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '객실 상세 닫기' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: '객실 상세 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 620, behavior: 'instant' })
    expect(document.body.style.overflow).toBe('clip')
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(screen.getByTestId('path').textContent).toBe(path)
    expect(screen.getByTestId('state').textContent).toBe('{"keep":"ok"}')
  })
  it('Back closes only the detail, Forward reloads it and Escape cancellation closes without selecting', async () => {
    const fetch = mockResponse()
    view({ available: true })
    open()
    await screen.findByRole('button', { name: '이 객실 선택' })
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('path').textContent).toBe(path)
    fireEvent.click(screen.getByRole('button', { name: '앞으로' }))
    await screen.findByRole('button', { name: '이 객실 선택' })
    expect(fetch).toHaveBeenCalledTimes(2)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('selection').textContent).toBe('none')
  })
  it('wraps Tab/Shift+Tab between enabled dialog actions without moving focus to the background', async () => {
    mockResponse()
    view({ available: true })
    open()
    const select = await screen.findByRole('button', { name: '이 객실 선택' })
    const close = screen.getByRole('button', { name: '객실 상세 닫기' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(select)
    fireEvent.keyDown(select, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })
  it('selects only on explicit action from a verified available result; close and Forward do not replay selection', async () => {
    mockResponse()
    view({ available: true })
    open()
    const select = await screen.findByRole('button', { name: '이 객실 선택' })
    expect(screen.getByTestId('selection').textContent).toBe('none')
    fireEvent.click(select)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('selection').textContent).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: '앞으로' }))
    await screen.findByRole('button', { name: '이 객실 선택' })
    fireEvent.click(screen.getByRole('button', { name: '객실 상세 닫기' }))
    expect(screen.getByTestId('selection').textContent).toBe('3')
  })
  it.each([{ roomId: 9 }, { accommodationId: 8 }, { capacity: 0 }, { nightlyPrice: -1 }])(
    'rejects invalid detail/identity %j without enabling selection',
    async (override) => {
      mockResponse({ ...room, ...override })
      view({ available: true })
      open()
      const dialog = screen.getByRole('dialog')
      await within(dialog).findByRole('alert')
      expect(within(dialog).queryByRole('button', { name: '이 객실 선택' })).toBeNull()
      expect(within(dialog).queryByText('123,456.78')).toBeNull()
    },
  )
  it.each([
    { status: 'INACTIVE' },
    { capacity: 1 },
    { nightlyPrice: 10 },
    { name: '변경됨' },
    { amenities: [] },
  ])('keeps catalog information readable but disables stale selection %j', async (override) => {
    mockResponse({ ...room, ...override })
    view({ available: true })
    open()
    expect(await screen.findByRole('button', { name: '이 객실 선택' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByText(/닫고 가용성을 다시 조회하세요/)).toBeTruthy()
  })
  it.each([404, 500])('shows HTTP %s recovery and retries only the detail GET', async (status) => {
    const fetch = mockResponse({ status, code: 'ROOM_001', message: '오류' }, status)
    view({ available: true })
    open()
    const dialog = screen.getByRole('dialog')
    await within(dialog).findByRole('alert')
    if (status === 404) expect(within(dialog).getByText(/객실을 찾을 수 없습니다/)).toBeTruthy()
    fetch.mockResolvedValue(Response.json(room))
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 시도' }))
    expect(await within(dialog).findByRole('button', { name: '이 객실 선택' })).toHaveProperty(
      'disabled',
      false,
    )
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('selection').textContent).toBe('none')
  })
  it('aborts a loading request on close and ignores a response arriving after it', async () => {
    let resolve!: (response: Response) => void
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    vi.stubGlobal('fetch', fetch)
    view({ available: true })
    open()
    expect(screen.getByText('객실 상세를 불러오고 있습니다.')).toBeTruthy()
    const signal: AbortSignal = fetch.mock.calls[0][1].signal
    fireEvent.click(screen.getByRole('button', { name: '객실 상세 닫기' }))
    expect(signal.aborted).toBe(true)
    await act(async () => {
      resolve(Response.json(room))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('selection').textContent).toBe('none')
  })
  it('unmounts on scope or route change without restoring an old scroll position or selection', async () => {
    mockResponse()
    const result = view({ available: true })
    open()
    await screen.findByRole('button', { name: '이 객실 선택' })
    vi.mocked(window.scrollTo).mockClear()
    result.rerender(<Harness available scope="available:7:new-stay:0" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(document.body.style.overflow).toBe('')
    fireEvent.click(screen.getByRole('button', { name: `${room.name} 상세 보기` }))
    await screen.findByRole('button', { name: '이 객실 선택' })
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByRole('button', { name: '다른 페이지' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(screen.getByTestId('selection').textContent).toBe('none')
  })
})
