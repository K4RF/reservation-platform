import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { AuthProvider } from '../../state/AuthProvider'
import { getRoleHint, setTokenPair } from '../../state/accessToken'
import { accessTokenWithExpiry } from '../../test/jwt'
import { accommodation, accommodationPage } from '../../test/accommodation'
import { room, roomPage, roomWrite } from '../../test/room'

function signIn(role = 'ADMIN') {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'refresh',
  )
}
function History() {
  const location = useLocation(),
    navigate = useNavigate()
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button onClick={() => navigate(-1)}>뒤로</button>
      <button onClick={() => navigate('/admin/rooms/new?accommodationId=8')}>
        다른 숙소의 생성 화면
      </button>
    </>
  )
}
function open(path = '/admin/rooms?accommodationId=7') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <History />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function publicResponse(url: string) {
  if (url.includes('/rooms?')) return roomPage()
  if (url.endsWith('/rooms/3')) return room
  return accommodation
}
function fillRoom() {
  for (const [label, value] of [
    ['객실 이름', room.name],
    ['전체 수용 인원', '2'],
    ['기본 1박 가격', '123456.78'],
  ])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
  fireEvent.click(screen.getByLabelText('와이파이'))
  fireEvent.click(screen.getByLabelText('에어컨'))
}
function selectAccommodation(id: string) {
  fireEvent.change(screen.getByLabelText('관리할 숙소 ID'), { target: { value: id } })
  fireEvent.submit(screen.getByRole('form', { name: '관리 숙소 선택' }))
}
const errorResponse = (status: number) =>
  Response.json(
    {
      status,
      code: `ROOM_${status}`,
      message: '객실 요청 오류',
      errors: [{ field: 'capacity', message: '수용 인원 확인' }],
    },
    { status },
  )
const writes = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([, init]) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method))

describe('Room Admin scoped list', () => {
  it('starts without requests until a parent is selected and offers the existing accommodation list', () => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms')
    expect(screen.getByRole('form', { name: '관리 숙소 선택' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '숙소 관리 목록에서 선택' }).getAttribute('href')).toBe(
      '/admin/accommodations',
    )
    expect(screen.queryByRole('form', { name: '객실 생성' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('opens inactive rooms without ACTIVE or availability defaults and keeps the Room menu selected', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes('/rooms?')
              ? roomPage({ content: [{ ...room, status: 'INACTIVE' }] })
              : { ...accommodation, status: 'INACTIVE' },
          ),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    expect(screen.getByText('숙소와 관리 객실 목록을 불러오고 있습니다.')).toBeTruthy()
    await screen.findByRole('link', { name: '스탠다드 조회·편집 (ID 3)' })
    expect(screen.getByText('숙소 상태: 운영 중지')).toBeTruthy()
    expect(within(screen.getByRole('article')).getByText('운영 중지', { exact: true })).toBeTruthy()
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit]
    expect(new URL(url, 'http://localhost').searchParams.has('status')).toBe(false)
    expect(url).not.toMatch(/available|checkIn|guestCount/)
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(
      within(screen.getByRole('navigation', { name: '관리 메뉴' }))
        .getByRole('link', { name: '객실 관리' })
        .getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.getByRole('link', { name: '새 객실 생성' }).getAttribute('href')).toBe(
      '/admin/rooms/new?accommodationId=7',
    )
    expect(writes(fetch)).toHaveLength(0)
  })
  it('serializes supported filters/AND amenities, resets page and preserves conditions through paging/history', async () => {
    signIn()
    const fetch = vi.fn().mockImplementation((url: string) => {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
      return Promise.resolve(
        Response.json(
          url.includes('/rooms?')
            ? roomPage({ page, first: page === 0, last: false, totalPages: 5 })
            : accommodation,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms?accommodationId=7&page=2')
    await screen.findByText('총 1개 객실')
    for (const [label, value] of [
      ['최소 수용 인원', '2'],
      ['최소 기본 가격', '0'],
      ['최대 기본 가격', '200000.50'],
      ['객실 상태 필터', 'INACTIVE'],
      ['객실 정렬 필드', 'NIGHTLY_PRICE'],
      ['객실 정렬 방향', 'DESC'],
      ['객실 페이지 크기', '10'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    const search = within(screen.getByRole('form', { name: '객실 관리 검색' }))
    fireEvent.click(search.getByLabelText('와이파이'))
    fireEvent.click(search.getByLabelText('에어컨'))
    fireEvent.submit(screen.getByRole('form', { name: '객실 관리 검색' }))
    await screen.findByText('1 / 5 페이지')
    const params = new URL(fetch.mock.calls[3][0], 'http://localhost').searchParams
    expect(Object.fromEntries(params)).toMatchObject({
      minCapacity: '2',
      minPrice: '0',
      maxPrice: '200000.50',
      status: 'INACTIVE',
      size: '10',
      sortBy: 'NIGHTLY_PRICE',
      direction: 'DESC',
      page: '0',
    })
    expect(params.getAll('amenities')).toEqual(['WIFI', 'AIR_CONDITIONER'])
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByText('2 / 5 페이지')
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    await screen.findByText('1 / 5 페이지')
    expect((screen.getByLabelText('객실 상태 필터') as HTMLSelectElement).value).toBe('INACTIVE')
    expect((screen.getByLabelText('최대 기본 가격') as HTMLInputElement).value).toBe('200000.50')
  })
  it('resets the previous accommodation filters and ignores late room responses after switching parent', async () => {
    signIn()
    let finishOld!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/accommodations/7/rooms?'))
        return new Promise<Response>((done) => {
          finishOld = done
        })
      if (url.includes('/rooms?'))
        return Promise.resolve(
          Response.json(
            roomPage({ content: [{ ...room, roomId: 4, accommodationId: 8, name: '다른 객실' }] }),
          ),
        )
      return Promise.resolve(
        Response.json(
          url.endsWith('/8')
            ? { ...accommodation, accommodationId: 8, name: '다른 숙소' }
            : accommodation,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms?accommodationId=7&page=2&status=INACTIVE&minCapacity=4')
    await waitFor(() => expect(finishOld).toBeTypeOf('function'))
    const oldSignal = fetch.mock.calls[1][1].signal as AbortSignal
    selectAccommodation('8')
    await screen.findByRole('link', { name: '다른 객실 조회·편집 (ID 4)' })
    expect(screen.getByTestId('location').textContent).toBe('/admin/rooms?accommodationId=8')
    expect((screen.getByLabelText('최소 수용 인원') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('객실 상태 필터') as HTMLSelectElement).value).toBe('')
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finishOld(Response.json(roomPage({ page: 2 }))))
    expect(screen.queryByRole('link', { name: '스탠다드 조회·편집 (ID 3)' })).toBeNull()
    expect(screen.getByRole('heading', { name: '다른 숙소 (숙소 ID 8)' })).toBeTruthy()
  })
  it('shows read errors and empty results with explicit GET retry', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) => Promise.resolve(Response.json(publicResponse(url))))
    fetch.mockResolvedValueOnce(errorResponse(404))
    vi.stubGlobal('fetch', fetch)
    open()
    expect((await screen.findByRole('alert')).textContent).toContain('ROOM_404')
    expect(screen.queryByRole('link', { name: '새 객실 생성' })).toBeNull()
    fetch.mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.includes('/rooms?')
            ? roomPage({ content: [], totalPages: 0, totalElements: 0 })
            : accommodation,
        ),
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('검색 조건에 맞는 객실이 없습니다.')
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('does not treat a wrong-parent response as a valid or empty list', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes('/rooms?')
              ? roomPage({ content: [{ ...room, accommodationId: 8 }] })
              : accommodation,
          ),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    expect((await screen.findByRole('alert')).textContent).toContain('목록 응답이 올바르지')
    expect(screen.queryByText('검색 조건에 맞는 객실이 없습니다.')).toBeNull()
  })
  it('rejects an invalid URL before requesting a parent or rooms', () => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms?accommodationId=7&minPrice=100&maxPrice=50')
    expect(screen.getByRole('alert').textContent).toContain('검색 조건이 올바르지')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['/admin/accommodations', '/admin/accommodations/7'])(
    'links %s to the correct accommodation-scoped management list',
    async (path) => {
      signIn()
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json(path.endsWith('/7') ? accommodation : accommodationPage()),
          ),
      )
      open(path)
      const link = await screen.findByRole('link', {
        name: path.endsWith('/7') ? '이 숙소의 객실 관리' : '서울 호텔 객실 관리',
      })
      expect(link.getAttribute('href')).toBe('/admin/rooms?accommodationId=7')
    },
  )
})

describe('Room Admin create, full update and operating status', () => {
  it('creates once for the verified parent, opens the returned detail and reloads the list on return', async () => {
    signIn()
    let resolve!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) =>
      init.method === 'POST'
        ? new Promise<Response>((done) => {
            resolve = done
          })
        : Promise.resolve(Response.json(publicResponse(url))),
    )
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/new?accommodationId=7')
    await screen.findByRole('form', { name: '객실 생성' })
    fillRoom()
    const form = screen.getByRole('form', { name: '객실 생성' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    expect(writes(fetch)[0][0]).toMatch(/\/accommodations\/7\/rooms$/)
    expect(JSON.parse(writes(fetch)[0][1].body)).toEqual(roomWrite)
    expect(
      (screen.getByLabelText('객실 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(true)
    await act(async () => resolve(Response.json(room, { status: 201 })))
    await screen.findByRole('form', { name: '객실 정보 수정' })
    expect(screen.getByTestId('location').textContent).toBe('/admin/rooms/3?accommodationId=7')
    fireEvent.click(screen.getByRole('link', { name: '객실 관리 목록으로' }))
    await screen.findByRole('link', { name: '스탠다드 조회·편집 (ID 3)' })
    expect(fetch.mock.calls.at(-1)![0]).toMatch(/\/accommodations\/7\/rooms\?/)
  })
  it('allows preparation for an inactive accommodation, without pretending it is bookable', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...accommodation, status: 'INACTIVE' })),
    )
    open('/admin/rooms/new?accommodationId=7')
    await screen.findByRole('form', { name: '객실 생성' })
    expect(screen.getByText(/대상 숙소: 서울 호텔 .*INACTIVE/)).toBeTruthy()
    expect(
      (screen.getByLabelText('객실 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(false)
  })
  it('validates missing name, total guest capacity and positive price before any write', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(Response.json(accommodation))
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/new?accommodationId=7')
    await screen.findByRole('form', { name: '객실 생성' })
    fireEvent.submit(screen.getByRole('form', { name: '객실 생성' }))
    expect(screen.getByRole('alert').textContent).toContain('전체 수용 인원')
    fillRoom()
    fireEvent.change(screen.getByLabelText('기본 1박 가격'), { target: { value: '0.001' } })
    fireEvent.submit(screen.getByRole('form', { name: '객실 생성' }))
    expect(screen.getByRole('alert').textContent).toContain('소수 2자리')
    expect(writes(fetch)).toHaveLength(0)
  })
  it('derives parent from a direct detail GET and updates only room fields, followed by fresh detail', async () => {
    signIn()
    let row = room
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'PUT') row = { ...row, ...JSON.parse(init.body as string) }
      return Promise.resolve(Response.json(url.endsWith('/rooms/3') ? row : accommodation))
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/3')
    await screen.findByRole('form', { name: '객실 정보 수정' })
    expect(screen.getByRole('link', { name: '객실 관리 목록으로' }).getAttribute('href')).toBe(
      '/admin/rooms?accommodationId=7',
    )
    fireEvent.change(screen.getByLabelText('객실 이름'), { target: { value: '수정 객실' } })
    fireEvent.change(screen.getByLabelText('기본 1박 가격'), { target: { value: '200000.50' } })
    fireEvent.submit(screen.getByRole('form', { name: '객실 정보 수정' }))
    await screen.findByRole('heading', { name: '수정 객실', level: 3 })
    expect(writes(fetch)).toHaveLength(1)
    expect(JSON.parse(writes(fetch)[0][1].body)).toEqual({
      ...roomWrite,
      name: '수정 객실',
      nightlyPrice: 200000.5,
    })
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual([
      'GET',
      'GET',
      'PUT',
      'GET',
      'GET',
    ])
    expect(fetch.mock.calls.some(([url]) => /prices|inventories/.test(url))).toBe(false)
  })
  it('confirms ACTIVE/INACTIVE changes separately and reloads detail without DELETE', async () => {
    signIn()
    let row = room
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') row = { ...row, status: JSON.parse(init.body as string).status }
      return Promise.resolve(Response.json(url.includes('/rooms/3') ? row : accommodation))
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/3?accommodationId=7')
    await screen.findByRole('form', { name: '객실 운영 상태 변경' })
    fireEvent.submit(screen.getByRole('form', { name: '객실 운영 상태 변경' }))
    expect(writes(fetch)).toHaveLength(0)
    for (const status of ['INACTIVE', 'ACTIVE']) {
      fireEvent.change(screen.getByLabelText('변경할 객실 상태'), { target: { value: status } })
      fireEvent.click(screen.getByLabelText('객실 상태 변경을 확인했습니다.'))
      fireEvent.submit(screen.getByRole('form', { name: '객실 운영 상태 변경' }))
      await waitFor(() =>
        expect(
          screen.getByText(status === 'INACTIVE' ? '운영 중지' : '운영 중', { exact: true }),
        ).toBeTruthy(),
      )
    }
    expect(writes(fetch).map(([, init]) => init.method)).toEqual(['PATCH', 'PATCH'])
    expect(screen.queryByRole('button', { name: /삭제/ })).toBeNull()
  })
  it('blocks editing when the query parent does not match RoomResponse', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(Response.json(room))
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/3?accommodationId=8')
    expect((await screen.findByRole('alert')).textContent).toContain(
      '선택한 숙소에 속한 객실이 아닙니다',
    )
    expect(screen.queryByRole('form')).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('does not guess a positive replacement for a legacy zero base price', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(url.endsWith('/rooms/3') ? { ...room, nightlyPrice: 0 } : accommodation),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/3')
    await screen.findByRole('form', { name: '객실 정보 수정' })
    expect((screen.getByLabelText('기본 1박 가격') as HTMLInputElement).value).toBe('0')
    fireEvent.submit(screen.getByRole('form', { name: '객실 정보 수정' }))
    expect(screen.getByRole('alert').textContent).toContain('0 초과')
    expect(writes(fetch)).toHaveLength(0)
  })
  it.each([
    '/admin/rooms/new',
    '/admin/rooms/0',
    '/admin/rooms/unknown',
    '/admin/rooms/3?accommodationId=0',
    '/admin/rooms/new?accommodationId=7&accommodationId=8',
  ])('rejects invalid entry %s without reads or writes', (path) => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open(path)
    expect(screen.getByRole('alert').textContent).toContain('ID')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('shows detail 404 without mounting either write form', async () => {
    signIn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(404)))
    open('/admin/rooms/3')
    expect((await screen.findByRole('alert')).textContent).toContain('ROOM_404')
    expect(screen.queryByRole('form')).toBeNull()
  })
})

describe('Room Admin auth and write safety', () => {
  it('shares one submit gate between full update and status PATCH while pending', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) =>
      init.method === 'PUT'
        ? new Promise<Response>((done) => {
            finish = done
          })
        : Promise.resolve(Response.json(publicResponse(url))),
    )
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/3?accommodationId=7')
    await screen.findByRole('form', { name: '객실 정보 수정' })
    fireEvent.click(screen.getByLabelText('객실 상태 변경을 확인했습니다.'))
    fireEvent.submit(screen.getByRole('form', { name: '객실 정보 수정' }))
    fireEvent.submit(screen.getByRole('form', { name: '객실 운영 상태 변경' }))
    fireEvent.submit(screen.getByRole('form', { name: '객실 정보 수정' }))
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    expect(
      (screen.getByRole('button', { name: '객실 상세 새로 조회' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await act(async () => finish(Response.json(room)))
    await screen.findByRole('form', { name: '객실 정보 수정' })
    expect(writes(fetch)).toHaveLength(1)
  })
  it.each([400, 403, 404, 409])(
    'keeps HTTP %s code and field details without replay',
    async (status) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation((url: string, init: RequestInit) =>
          Promise.resolve(
            init.method === 'POST' ? errorResponse(status) : Response.json(publicResponse(url)),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open('/admin/rooms/new?accommodationId=7')
      await screen.findByRole('form', { name: '객실 생성' })
      fillRoom()
      fireEvent.submit(screen.getByRole('form', { name: '객실 생성' }))
      expect((await screen.findByRole('alert')).textContent).toContain(`ROOM_${status}`)
      expect(screen.getByRole('list', { name: '서버 입력 오류' }).textContent).toContain(
        'capacity: 수용 인원 확인',
      )
      expect(writes(fetch)).toHaveLength(1)
      expect(getRoleHint()).toBe('ADMIN')
    },
  )
  it.each(['network', '500', 'wrong_parent'])(
    'locks ambiguous %s update and status together, even after read refresh',
    async (failure) => {
      signIn()
      const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        if (init.method === 'PUT')
          return failure === 'network'
            ? Promise.reject(new TypeError('offline'))
            : Promise.resolve(
                failure === '500'
                  ? errorResponse(500)
                  : Response.json({ ...room, accommodationId: 8 }),
              )
        return Promise.resolve(Response.json(publicResponse(url)))
      })
      vi.stubGlobal('fetch', fetch)
      open('/admin/rooms/3?accommodationId=7')
      await screen.findByRole('form', { name: '객실 정보 수정' })
      fireEvent.submit(screen.getByRole('form', { name: '객실 정보 수정' }))
      await screen.findByRole('region', { name: '불명확한 저장 결과 확인' })
      fireEvent.submit(screen.getByRole('form', { name: '객실 정보 수정' }))
      expect(writes(fetch)).toHaveLength(1)
      expect(
        (screen.getByLabelText('객실 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
      ).toBe(true)
      expect(
        screen.getByRole('link', { name: '객실 목록에서 결과 확인' }).getAttribute('href'),
      ).toBe('/admin/rooms?accommodationId=7')
      fireEvent.click(screen.getByRole('button', { name: '객실 상세 새로 조회' }))
      await screen.findByRole('form', { name: '객실 정보 수정' })
      expect(
        (screen.getByLabelText('객실 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
      ).toBe(true)
      fireEvent.click(screen.getByLabelText('저장 결과를 별도로 확인했으며 새 요청을 준비합니다.'))
      fireEvent.click(screen.getByRole('button', { name: '확인 후 입력 잠금 해제' }))
      expect(
        (screen.getByLabelText('객실 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
      ).toBe(false)
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it('does not replay the create POST after 401 and routes to the shared login', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string, init: RequestInit) =>
        Promise.resolve(
          init.method === 'POST' ? errorResponse(401) : Response.json(publicResponse(url)),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/new?accommodationId=7')
    await screen.findByRole('form', { name: '객실 생성' })
    fillRoom()
    fireEvent.submit(screen.getByRole('form', { name: '객실 생성' }))
    await screen.findByRole('heading', { name: '로그인' })
    expect(writes(fetch)).toHaveLength(1)
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/auth/reissue'))).toBe(false)
  })
  it('clears pending create input and ignores the old response when the accommodation changes', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) =>
      init.method === 'POST'
        ? new Promise<Response>((done) => {
            finish = done
          })
        : Promise.resolve(
            Response.json(
              url.endsWith('/8')
                ? { ...accommodation, accommodationId: 8, name: '새 숙소' }
                : accommodation,
            ),
          ),
    )
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/new?accommodationId=7')
    await screen.findByRole('form', { name: '객실 생성' })
    fillRoom()
    fireEvent.submit(screen.getByRole('form', { name: '객실 생성' }))
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    const signal = writes(fetch)[0][1].signal as AbortSignal
    fireEvent.click(screen.getByRole('button', { name: '다른 숙소의 생성 화면' }))
    await screen.findByText(/대상 숙소: 새 숙소/)
    expect((screen.getByLabelText('객실 이름') as HTMLInputElement).value).toBe('')
    expect(signal.aborted).toBe(true)
    await act(async () => finish(Response.json(room)))
    expect(screen.getByTestId('location').textContent).toBe('/admin/rooms/new?accommodationId=8')
    expect(writes(fetch)).toHaveLength(1)
  })
  it.each(['anonymous', 'USER'])('blocks %s from list and deep create without HTTP', (role) => {
    if (role !== 'anonymous') signIn(role)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open('/admin/rooms/new?accommodationId=7')
    expect(
      screen.getByRole('heading', {
        name: role === 'anonymous' ? '로그인' : '접근 권한이 없습니다.',
      }),
    ).toBeTruthy()
    expect(screen.queryByRole('form', { name: '객실 생성' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
