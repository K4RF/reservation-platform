import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { setTokenPair, clearAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import { reservationDetail, reservationPage, reservationResult } from '../test/reservation'
import { accommodation } from '../test/accommodation'
import { room } from '../test/room'

function signIn(role = 'USER') {
  setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60, 'ACCESS', role), 'refresh')
}
function HistoryButtons() {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate(-1)}>History back</button>
      <button onClick={() => navigate(1)}>History forward</button>
    </>
  )
}
function renderAt(path = '/reservations') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <HistoryButtons />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function catalogResponse(url: string) {
  return url.endsWith('/rooms/3') ? Response.json(room) : Response.json(accommodation)
}

describe('My Reservation flow with real router/auth/API client', () => {
  it.each(['USER', 'ADMIN'])(
    'loads only the owner endpoint for %s and opens a fresh owner detail GET',
    async (role) => {
      signIn(role)
      const mock = vi
        .fn()
        .mockImplementation((url: string) =>
          url.includes('/reservations?')
            ? Response.json(reservationPage())
            : url.endsWith('/reservations/42')
              ? Response.json(reservationDetail)
              : catalogResponse(url),
        )
      vi.stubGlobal('fetch', mock)
      renderAt()
      expect(screen.getByText('내 예약을 불러오고 있습니다.')).toBeTruthy()
      fireEvent.click(await screen.findByRole('link', { name: '예약 42 상세 보기' }))
      await screen.findByRole('heading', { name: '예약 상세' })
      await screen.findByText('350.25')
      expect(mock.mock.calls.some(([url]) => url.endsWith('/reservations/42'))).toBe(true)
      expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
      expect(screen.queryByText('예약이 확정되었습니다.')).toBeNull()
      fireEvent.click(screen.getByRole('link', { name: '내 예약 목록으로' }))
      await screen.findByRole('link', { name: '예약 42 상세 보기' })
    },
  )
  it.each(['/reservations', '/reservations/42'])(
    'redirects anonymous direct access at %s without a list/detail request',
    (path) => {
      const mock = vi.fn()
      vi.stubGlobal('fetch', mock)
      renderAt(path)
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      expect(mock).not.toHaveBeenCalled()
    },
  )
  it('does not expose reservation history to an unknown role', () => {
    signIn('UNKNOWN')
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    renderAt()
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
  })
  it('uses URL pages and re-queries on browser history navigation', async () => {
    signIn()
    const mock = vi.fn().mockImplementation((url: string) => {
      if (!url.includes('/reservations?')) return catalogResponse(url)
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
      return Response.json(
        reservationPage({
          page,
          first: page === 0,
          last: page === 1,
          totalElements: 21,
          totalPages: 2,
          content: [{ ...reservationResult, reservationId: page === 0 ? 42 : 41 }],
        }),
      )
    })
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByRole('link', { name: '예약 41 상세 보기' })
    expect(screen.getByText('2 / 2 페이지')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'History back' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    fireEvent.click(screen.getByRole('button', { name: 'History forward' }))
    await screen.findByRole('link', { name: '예약 41 상세 보기' })
    expect(mock.mock.calls.filter(([url]) => url.includes('/reservations?')).length).toBe(4)
  })
  it('shows a true Empty state without catalog requests', async () => {
    signIn()
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json(reservationPage({ content: [], totalElements: 0, totalPages: 0 })),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByText('표시할 예약이 없습니다.')
    expect(screen.getByText('0 / 0 페이지')).toBeTruthy()
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mock).toHaveBeenCalledOnce()
  })
  it.each(['abc', '-1', '0.5', '2147483648', '1&page=2'])(
    'rejects invalid page %s before fetch',
    (page) => {
      signIn()
      const mock = vi.fn()
      vi.stubGlobal('fetch', mock)
      renderAt(`/reservations?page=${page}`)
      expect(screen.getByRole('alert').textContent).toContain('페이지 번호')
      expect(mock).not.toHaveBeenCalled()
    },
  )
  it('offers first-page recovery for out-of-range empty pages', async () => {
    signIn()
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('page=2')
          ? Response.json(reservationPage({ page: 2, first: false, content: [] }))
          : url.includes('/reservations?')
            ? Response.json(reservationPage())
            : catalogResponse(url),
      )
    vi.stubGlobal('fetch', mock)
    renderAt('/reservations?page=2')
    fireEvent.click(await screen.findByRole('button', { name: '첫 페이지로 이동' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
  })
  it.each([
    [400, '조회 조건'],
    [403, '본인 예약'],
    [404, '찾을 수 없습니다'],
    [409, '충돌'],
    [500, '불러오지 못했습니다'],
  ])('shows HTTP %i errors, never Empty, and retries only GET', async (status, message) => {
    signIn()
    let failed = true
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/reservations?')
          ? failed
            ? Response.json(
                { status, code: 'TEST', message: 'server', errors: [] },
                { status: Number(status) },
              )
            : Response.json(reservationPage())
          : catalogResponse(url),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    expect((await screen.findByRole('alert')).textContent).toContain(String(message))
    expect(screen.queryByText('표시할 예약이 없습니다.')).toBeNull()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('recovers from a network error with an explicit read retry', async () => {
    signIn()
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockImplementation((url: string) =>
        url.includes('/reservations?') ? Response.json(reservationPage()) : catalogResponse(url),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
  })
  it('retains snapshots during catalog failure and allows catalog recovery', async () => {
    signIn()
    let failed = true
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/reservations?')
          ? Response.json(reservationPage())
          : failed
            ? Response.json({}, { status: 404 })
            : catalogResponse(url),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByText('350.25')
    expect(screen.getByText('객실: 객실 ID: 3')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: '현재 숙소·객실 정보 다시 조회' }))
    await screen.findByRole('heading', { name: '서울 호텔' })
  })
  it('discards late responses from a previous page instead of mixing histories', async () => {
    signIn()
    let finish!: (response: Response) => void
    let count = 0
    const mock = vi.fn().mockImplementation((url: string) => {
      if (!url.includes('/reservations?')) return catalogResponse(url)
      count += 1
      if (count === 3)
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      return Response.json(
        reservationPage({
          page: count === 1 ? 0 : 1,
          first: count === 1,
          last: count !== 1,
          totalElements: 21,
          totalPages: 2,
          content: [{ ...reservationResult, reservationId: count === 1 ? 42 : 41 }],
        }),
      )
    })
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByRole('link', { name: '예약 41 상세 보기' })
    fireEvent.click(screen.getByRole('button', { name: '이전' }))
    await waitFor(() => expect(count).toBe(3))
    fireEvent.click(screen.getByRole('button', { name: 'History back' }))
    await screen.findByRole('link', { name: '예약 41 상세 보기' })
    await act(async () => finish(Response.json(reservationPage())))
    expect(screen.queryByRole('link', { name: '예약 42 상세 보기' })).toBeNull()
  })
  it('clears the old member data on a new sign-in, even with the same role', async () => {
    signIn()
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/reservations?') ? Response.json(reservationPage()) : catalogResponse(url),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    mock.mockImplementation((url: string) =>
      url.includes('/reservations?')
        ? Response.json(reservationPage({ content: [], totalElements: 0, totalPages: 0 }))
        : catalogResponse(url),
    )
    act(() => signIn())
    expect(screen.queryByRole('link', { name: '예약 42 상세 보기' })).toBeNull()
    await screen.findByText('표시할 예약이 없습니다.')
    act(() => clearAccessToken())
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(screen.queryByText('표시할 예약이 없습니다.')).toBeNull()
  })
  it('redirects to re-login after refresh failure without leaking a previous list', async () => {
    signIn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 401 })))
    renderAt()
    await screen.findByRole('heading', { name: '로그인' })
    expect(screen.getByText('인증이 만료되었습니다. 다시 로그인해 주세요.')).toBeTruthy()
    expect(screen.queryByRole('list', { name: '내 예약 목록' })).toBeNull()
  })
  it.each(['abc', '0', '9007199254740992'])(
    'rejects invalid detail ID %s without fetching',
    (id) => {
      signIn()
      const mock = vi.fn()
      vi.stubGlobal('fetch', mock)
      renderAt(`/reservations/${id}`)
      expect(screen.getByRole('alert').textContent).toContain('예약 ID')
      expect(mock).not.toHaveBeenCalled()
    },
  )
})
