import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { AuthProvider } from '../../state/AuthProvider'
import { getRoleHint, setTokenPair } from '../../state/accessToken'
import { accessTokenWithExpiry } from '../../test/jwt'
import { room, roomPage } from '../../test/room'
import { accommodation } from '../../test/accommodation'
import { defaultPrice, dailyPrice } from '../../test/dailyPrice'
import { readAdminDailyPriceQuery } from './adminDailyPriceQuery'

const path = '/admin/prices?roomId=3&stayDate=2030-07-20'
function signIn(role = 'ADMIN') {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'refresh',
  )
}
function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}
function open(url = path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
        <Location />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function selectTarget(roomId: string, stayDate: string) {
  fireEvent.change(screen.getByLabelText('가격 관리 객실 ID'), { target: { value: roomId } })
  fireEvent.change(screen.getByLabelText('가격 관리 숙박 날짜'), { target: { value: stayDate } })
  fireEvent.submit(screen.getByRole('form', { name: '가격 조회 대상 선택' }))
}
const form = () => screen.getByRole('form', { name: '날짜별 가격 입력' })
function preparePrice(value = '180000.50') {
  fireEvent.change(screen.getByLabelText('설정할 날짜별 1박 가격'), { target: { value } })
  fireEvent.click(screen.getByLabelText('객실·숙박 날짜·가격과 생성/수정 작업을 확인했습니다.'))
}
const writes = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([, init]) => init.method !== 'GET')
const errorResponse = (status: number, code = `PRICE_${status}`) =>
  Response.json(
    {
      status,
      code,
      message: '가격 요청 오류',
      errors: [{ field: 'nightlyPrice', message: '금액 형식 확인' }],
    },
    { status },
  )

describe('single-date price selection and public effective reads', () => {
  it.each(['/admin/prices', '/admin/prices?roomId=3'])(
    'does not guess a date or request a period/calendar from %s',
    (url) => {
      signIn()
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      open(url)
      expect(screen.getByRole('form', { name: '가격 조회 대상 선택' })).toBeTruthy()
      expect(
        screen.getByText('객실 ID와 숙박 날짜를 선택해 주세요. 아직 가격을 조회하지 않았습니다.'),
      ).toBeTruthy()
      expect(screen.queryByRole('form', { name: '날짜별 가격 입력' })).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it('shows DEFAULT as a valid base fallback, including zero, with no fabricated currency or override ID', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes('/prices/')
              ? { ...defaultPrice, nightlyPrice: 0 }
              : { ...room, status: 'INACTIVE', nightlyPrice: 0 },
          ),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    expect(screen.getByText('객실과 적용 가격을 불러오고 있습니다.')).toBeTruthy()
    await screen.findByRole('region', { name: '현재 적용 가격' })
    const current = within(screen.getByRole('region', { name: '현재 적용 가격' }))
    expect(current.getByText('DEFAULT')).toBeTruthy()
    expect(current.getByText('0.00')).toBeTruthy()
    expect(current.getByText('없음 (기본 가격 적용)')).toBeTruthy()
    expect(current.getByText(/Override는 미등록/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '날짜별 가격 생성' })).toBeTruthy()
    expect((screen.getByLabelText('설정할 날짜별 1박 가격') as HTMLInputElement).value).toBe('')
    expect(
      within(screen.getByRole('region', { name: '가격 관리 대상 객실' })).getByText('운영 중지'),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: '현재 적용 가격' }).textContent).not.toMatch(
      /KRW|USD|₩|\$/,
    )
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/rooms\/3$/),
      expect.stringMatching(/\/rooms\/3\/prices\/2030-07-20$/),
    ])
    for (const [, init] of fetch.mock.calls)
      expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })
  it('uses DAILY from Backend and preloads only that override for a PUT', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(Response.json(url.includes('/prices/') ? dailyPrice : room)),
        ),
    )
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    const current = within(screen.getByRole('region', { name: '현재 적용 가격' }))
    expect(current.getByText('180,000.50')).toBeTruthy()
    expect(current.getByText('DAILY')).toBeTruthy()
    expect(current.getByText('9')).toBeTruthy()
    expect((screen.getByLabelText('설정할 날짜별 1박 가격') as HTMLInputElement).value).toBe(
      '180000.5',
    )
    expect(screen.getByRole('button', { name: '날짜별 가격 저장' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '날짜별 가격 생성' })).toBeNull()
    expect(
      within(screen.getByRole('navigation', { name: '관리 메뉴' }))
        .getByRole('link', { name: '가격 관리' })
        .getAttribute('aria-current'),
    ).toBe('page')
  })
  it.each([
    'roomId=0&stayDate=2030-07-20',
    'roomId=9007199254740992&stayDate=2030-07-20',
    'roomId=3&stayDate=2030-02-30',
    'roomId=3&roomId=4&stayDate=2030-07-20',
    'roomId=3&stayDate=2030-07-20&stayDate=2030-07-21',
  ])('rejects invalid target %s before HTTP', (query) => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open(`/admin/prices?${query}`)
    expect(screen.getByRole('alert').textContent).toContain('숙박 날짜가 올바르지')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('accepts a past leap date without inventing a today/minimum-booking policy', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes('/prices/') ? { ...defaultPrice, stayDate: '2000-02-29' } : room,
          ),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open('/admin/prices?roomId=3&stayDate=2000-02-29')
    await screen.findByRole('region', { name: '현재 적용 가격' })
    expect(fetch.mock.calls[1][0]).toMatch(/\/prices\/2000-02-29$/)
    expect(readAdminDailyPriceQuery(new URLSearchParams('roomId=3&stayDate=0000-01-01'))).toBeNull()
  })
  it('does not treat a failed price GET as DEFAULT or enable a write until read retry succeeds', async () => {
    signIn()
    let failed = true
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.includes('/prices/')
            ? failed
              ? errorResponse(500)
              : Response.json(defaultPrice)
            : Response.json(room),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    expect((await screen.findByRole('alert')).textContent).toContain('PRICE_500')
    expect(screen.queryByRole('form', { name: '날짜별 가격 입력' })).toBeNull()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('button', { name: '날짜별 가격 생성' })
    expect(writes(fetch)).toHaveLength(0)
  })
  it('stops on a missing room without making a price request', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(errorResponse(404, 'ROOM_001'))
    vi.stubGlobal('fetch', fetch)
    open()
    expect((await screen.findByRole('alert')).textContent).toContain('ROOM_001')
    expect(fetch).toHaveBeenCalledOnce()
    expect(screen.queryByRole('form', { name: '날짜별 가격 입력' })).toBeNull()
  })
})

describe('price mutation and reconciliation', () => {
  it('creates only once, blocks duplicate submits, then uses a fresh authoritative GET', async () => {
    signIn()
    let finish!: (response: Response) => void,
      saved = false
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'POST')
        return new Promise<Response>((done) => {
          finish = done
        })
      return Promise.resolve(
        Response.json(
          url.includes('/prices/')
            ? saved
              ? { ...dailyPrice, nightlyPrice: 190000.25 }
              : defaultPrice
            : room,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice()
    fireEvent.submit(form())
    fireEvent.submit(form())
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    expect(JSON.parse(writes(fetch)[0][1].body)).toEqual({
      stayDate: '2030-07-20',
      nightlyPrice: 180000.5,
    })
    expect(
      (screen.getByRole('button', { name: '적용 가격 새로 조회' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    saved = true
    await act(async () => finish(Response.json(dailyPrice, { status: 201 })))
    await screen.findByRole('button', { name: '날짜별 가격 저장' })
    expect(screen.getByText('190,000.25')).toBeTruthy()
    expect((screen.getByLabelText('설정할 날짜별 1박 가격') as HTMLInputElement).value).toBe(
      '190000.25',
    )
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual([
      'GET',
      'GET',
      'POST',
      'GET',
      'GET',
    ])
    expect(
      (
        screen.getByLabelText(
          '객실·숙박 날짜·가격과 생성/수정 작업을 확인했습니다.',
        ) as HTMLInputElement
      ).checked,
    ).toBe(false)
  })
  it('updates only nightlyPrice at the selected date URL and leaves Room/default/inventory untouched', async () => {
    signIn()
    let price = dailyPrice
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'PUT')
        price = { ...price, nightlyPrice: JSON.parse(init.body as string).nightlyPrice }
      return Promise.resolve(Response.json(url.includes('/prices') ? price : room))
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice('0.01')
    fireEvent.submit(form())
    await screen.findByText('0.01', { selector: 'dd' })
    expect(writes(fetch)).toHaveLength(1)
    expect(writes(fetch)[0][0]).toMatch(/\/rooms\/3\/prices\/2030-07-20$/)
    expect(JSON.parse(writes(fetch)[0][1].body)).toEqual({ nightlyPrice: 0.01 })
    expect(fetch.mock.calls.some(([url]) => /inventories|reservations|\/prices\?/.test(url))).toBe(
      false,
    )
    expect(writes(fetch).every(([url]) => /\/prices/.test(url))).toBe(true)
  })
  it.each(['0', '-1', '0.001', '10000000000'])(
    'rejects invalid amount %s before POST',
    async (amount) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(Response.json(url.includes('/prices/') ? defaultPrice : room)),
        )
      vi.stubGlobal('fetch', fetch)
      open()
      await screen.findByRole('form', { name: '날짜별 가격 입력' })
      preparePrice(amount)
      fireEvent.submit(form())
      expect(screen.getByRole('alert').textContent).toContain('0보다 크고')
      expect(writes(fetch)).toHaveLength(0)
    },
  )
  it('requires renewed acknowledgement when amount changes', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(Response.json(url.includes('/prices/') ? defaultPrice : room)),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice()
    fireEvent.change(screen.getByLabelText('설정할 날짜별 1박 가격'), {
      target: { value: '10.50' },
    })
    expect(
      (screen.getByRole('button', { name: '날짜별 가격 생성' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.submit(form())
    expect(screen.getByRole('alert').textContent).toContain('확인해 주세요')
    expect(writes(fetch)).toHaveLength(0)
  })
  it.each([409, 404])(
    'does not switch POST/PUT after %s until manual GET and new confirmation',
    async (status) => {
      signIn()
      let refreshed = false
      const initial = status === 409 ? defaultPrice : dailyPrice,
        after = status === 409 ? dailyPrice : defaultPrice
      const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        if (init.method !== 'GET')
          return Promise.resolve(
            errorResponse(status, status === 409 ? 'ROOM_PRICE_002' : 'ROOM_PRICE_001'),
          )
        return Promise.resolve(
          Response.json(url.includes('/prices/') ? (refreshed ? after : initial) : room),
        )
      })
      vi.stubGlobal('fetch', fetch)
      open()
      await screen.findByRole('form', { name: '날짜별 가격 입력' })
      preparePrice()
      fireEvent.submit(form())
      await screen.findByRole('alert')
      expect(screen.getByRole('alert').textContent).toContain(
        status === 409 ? 'ROOM_PRICE_002' : 'ROOM_PRICE_001',
      )
      expect(writes(fetch).map(([, init]) => init.method)).toEqual([
        status === 409 ? 'POST' : 'PUT',
      ])
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(
        screen.getByRole('button', {
          name: status === 409 ? '날짜별 가격 생성' : '날짜별 가격 저장',
        }),
      ).toBeTruthy()
      refreshed = true
      fireEvent.click(screen.getByRole('button', { name: '적용 가격 새로 조회' }))
      const next = await screen.findByRole('button', {
        name: status === 409 ? '날짜별 가격 저장' : '날짜별 가격 생성',
      })
      expect((next as HTMLButtonElement).disabled).toBe(true)
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it.each(['network', '500', 'malformed'])(
    'locks an ambiguous %s result even after successful GET until explicit review',
    async (failure) => {
      signIn()
      let readSaved = false
      const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        if (init.method === 'POST')
          return failure === 'network'
            ? Promise.reject(new TypeError('offline'))
            : Promise.resolve(
                failure === '500'
                  ? errorResponse(500)
                  : Response.json({ ...dailyPrice, roomId: 4 }),
              )
        return Promise.resolve(
          Response.json(url.includes('/prices/') ? (readSaved ? dailyPrice : defaultPrice) : room),
        )
      })
      vi.stubGlobal('fetch', fetch)
      open()
      await screen.findByRole('form', { name: '날짜별 가격 입력' })
      preparePrice()
      fireEvent.submit(form())
      await screen.findByRole('region', { name: '불명확한 저장 결과 확인' })
      fireEvent.submit(form())
      expect(writes(fetch)).toHaveLength(1)
      readSaved = true
      fireEvent.click(screen.getByRole('button', { name: '적용 가격 새로 조회' }))
      await screen.findByRole('button', { name: '날짜별 가격 저장' })
      expect(
        (screen.getByLabelText('설정할 날짜별 1박 가격').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(true)
      expect(
        (screen.getByRole('button', { name: '확인 후 입력 잠금 해제' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true)
      fireEvent.click(screen.getByLabelText('저장 결과를 별도로 확인했으며 새 요청을 준비합니다.'))
      fireEvent.click(screen.getByRole('button', { name: '확인 후 입력 잠금 해제' }))
      expect(
        (screen.getByLabelText('설정할 날짜별 1박 가격').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(false)
      expect(
        (screen.getByRole('button', { name: '날짜별 가격 저장' }) as HTMLButtonElement).disabled,
      ).toBe(true)
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it('keeps known write success separate from a subsequent read failure without resending', async () => {
    signIn()
    let saved = false
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        saved = true
        return Promise.resolve(Response.json(dailyPrice))
      }
      return Promise.resolve(
        url.includes('/prices/')
          ? saved
            ? errorResponse(500)
            : Response.json(defaultPrice)
          : Response.json(room),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice()
    fireEvent.submit(form())
    await screen.findByRole('alert')
    expect(
      screen.getByText('날짜별 가격 저장 응답을 받았습니다. 최신 적용 가격을 다시 조회합니다.'),
    ).toBeTruthy()
    expect(screen.queryByRole('form', { name: '날짜별 가격 입력' })).toBeNull()
    expect(writes(fetch)).toHaveLength(1)
  })
})

describe('target lifetime, authorization and navigation', () => {
  it.each([
    ['3', '2030-07-21'],
    ['4', '2030-07-20'],
  ])('ignores late price reads after selecting %s/%s', async (roomId, stayDate) => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/rooms/3/prices/2030-07-20'))
        return new Promise<Response>((done) => {
          finish = done
        })
      if (url.includes('/prices/'))
        return Promise.resolve(Response.json({ ...defaultPrice, roomId: Number(roomId), stayDate }))
      return Promise.resolve(Response.json({ ...room, roomId: url.endsWith('/4') ? 4 : 3 }))
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    const oldSignal = fetch.mock.calls[1][1].signal as AbortSignal
    selectTarget(roomId, stayDate)
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finish(Response.json(dailyPrice)))
    expect(
      within(screen.getByRole('region', { name: '현재 적용 가격' })).getByText('DEFAULT'),
    ).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe(
      `/admin/prices?roomId=${roomId}&stayDate=${stayDate}`,
    )
    expect(writes(fetch)).toHaveLength(0)
  })
  it('discards late write success and form state after date selection changes', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'POST')
        return new Promise<Response>((done) => {
          finish = done
        })
      return Promise.resolve(
        Response.json(
          url.includes('/prices/') ? { ...defaultPrice, stayDate: url.split('/').at(-1) } : room,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice()
    fireEvent.submit(form())
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    const signal = writes(fetch)[0][1].signal as AbortSignal
    selectTarget('3', '2030-07-21')
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    expect(signal.aborted).toBe(true)
    expect((screen.getByLabelText('설정할 날짜별 1박 가격') as HTMLInputElement).value).toBe('')
    await act(async () => finish(Response.json(dailyPrice)))
    expect(screen.getByTestId('location').textContent).toBe(
      '/admin/prices?roomId=3&stayDate=2030-07-21',
    )
    expect(
      screen.queryByText('날짜별 가격 저장 응답을 받았습니다. 최신 적용 가격을 다시 조회합니다.'),
    ).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(5)
  })
  it('ignores an old success when another ADMIN login replaces the session', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) =>
      init.method === 'POST'
        ? new Promise<Response>((done) => {
            finish = done
          })
        : Promise.resolve(Response.json(url.includes('/prices/') ? defaultPrice : room)),
    )
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice()
    fireEvent.submit(form())
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    act(() => signIn())
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    await act(async () => finish(Response.json(dailyPrice)))
    expect(
      screen.queryByText('날짜별 가격 저장 응답을 받았습니다. 최신 적용 가격을 다시 조회합니다.'),
    ).toBeNull()
    expect((screen.getByLabelText('설정할 날짜별 1박 가격') as HTMLInputElement).value).toBe('')
    expect(writes(fetch)).toHaveLength(1)
  })
  it.each([400, 403])(
    'retains HTTP %s field errors without inventing a role or replay',
    async (status) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation((url: string, init: RequestInit) =>
          Promise.resolve(
            init.method === 'POST'
              ? errorResponse(status)
              : Response.json(url.includes('/prices/') ? defaultPrice : room),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open()
      await screen.findByRole('form', { name: '날짜별 가격 입력' })
      preparePrice()
      fireEvent.submit(form())
      await screen.findByRole('alert')
      expect(screen.getByRole('alert').textContent).toContain(`PRICE_${status}`)
      expect(screen.getByRole('list', { name: '서버 입력 오류' }).textContent).toContain(
        'nightlyPrice: 금액 형식 확인',
      )
      expect(getRoleHint()).toBe('ADMIN')
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it('never replays POST after 401 and uses the shared re-login route', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string, init: RequestInit) =>
        Promise.resolve(
          init.method === 'POST'
            ? errorResponse(401)
            : Response.json(url.includes('/prices/') ? defaultPrice : room),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    await screen.findByRole('form', { name: '날짜별 가격 입력' })
    preparePrice()
    fireEvent.submit(form())
    await screen.findByRole('heading', { name: '로그인' })
    expect(writes(fetch)).toHaveLength(1)
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/auth/reissue'))).toBe(false)
  })
  it.each(['anonymous', 'USER'])(
    'does not mount management reads/writes for %s at a deep price URL',
    (role) => {
      if (role !== 'anonymous') signIn(role)
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      open()
      expect(
        screen.getByRole('heading', {
          name: role === 'anonymous' ? '로그인' : '접근 권한이 없습니다.',
        }),
      ).toBeTruthy()
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it.each(['/admin/rooms?accommodationId=7', '/admin/rooms/3'])(
    'links %s to price management without guessing a date',
    async (url) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation((target: string) =>
          Promise.resolve(
            Response.json(
              target.includes('/rooms?')
                ? roomPage()
                : target.endsWith('/rooms/3')
                  ? room
                  : accommodation,
            ),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open(url)
      const link = await screen.findByRole('link', {
        name: url.includes('?') ? '스탠다드 날짜별 가격 관리' : '이 객실의 날짜별 가격 관리',
      })
      expect(link.getAttribute('href')).toBe('/admin/prices?roomId=3')
      fireEvent.click(link)
      expect(screen.getByRole('form', { name: '가격 조회 대상 선택' })).toBeTruthy()
      expect((screen.getByLabelText('가격 관리 객실 ID') as HTMLInputElement).value).toBe('3')
      expect((screen.getByLabelText('가격 관리 숙박 날짜') as HTMLInputElement).value).toBe('')
      expect(fetch.mock.calls.some(([target]) => target.includes('/prices/'))).toBe(false)
    },
  )
})
