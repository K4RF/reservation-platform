import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { AuthProvider } from '../../state/AuthProvider'
import { getRoleHint, setTokenPair } from '../../state/accessToken'
import { accessTokenWithExpiry } from '../../test/jwt'
import { inventory, inventoryCalendar } from '../../test/inventory'
import { room, roomPage } from '../../test/room'
import { accommodation } from '../../test/accommodation'

const path = '/admin/inventories?roomId=3&startDate=2030-07-20&endDate=2030-07-22'
const confirmation = '객실·날짜·총수량·판매 상태와 생성/수정 작업을 확인했습니다.'
const reviewConfirmation = '최신 Calendar의 재고 수량과 판매 상태를 확인했습니다.'
function signIn(role = 'ADMIN') {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'refresh',
  )
}
function open(url = path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}
const calendar = () => screen.getByRole('region', { name: '날짜별 재고 Calendar' })
const form = () => screen.getByRole('form', { name: '날짜 재고 입력' })
const writes = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([, init]) => init.method !== 'GET')
const errorResponse = (status: number, code = `INVENTORY_${status}`) =>
  Response.json(
    {
      status,
      code,
      message: '재고 요청 거절',
      errors: [{ field: 'totalQuantity', message: '수량 확인' }],
    },
    { status },
  )
function prepare(total = '5') {
  fireEvent.change(screen.getByLabelText('설정할 총수량'), { target: { value: total } })
  fireEvent.click(screen.getByLabelText(confirmation))
}
async function selectDate(date = '2030-07-20') {
  await screen.findByRole('region', { name: '날짜별 재고 Calendar' })
  fireEvent.click(within(calendar()).getByRole('button', { name: date }))
}
function selectRange(id: string, start: string, end: string) {
  fireEvent.change(screen.getByLabelText('재고 관리 객실 ID'), { target: { value: id } })
  fireEvent.change(screen.getByLabelText('재고 조회 시작일'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('재고 조회 종료일'), { target: { value: end } })
  fireEvent.submit(screen.getByRole('form', { name: '재고 조회 대상 선택' }))
}
function stubReads(inactive = false, empty = false) {
  const fetch = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.includes('/inventories?')
            ? { ...inventoryCalendar, inventories: empty ? [] : inventoryCalendar.inventories }
            : { ...room, status: inactive ? 'INACTIVE' : 'ACTIVE' },
        ),
      ),
    )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('Inventory Calendar reads and uncreated dates', () => {
  it.each(['/admin/inventories', '/admin/inventories?roomId=3'])(
    'requires an explicit room and date range from %s',
    (url) => {
      signIn()
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      open(url)
      expect(screen.getByRole('form', { name: '재고 조회 대상 선택' })).toBeTruthy()
      expect(screen.queryByRole('table')).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it('shows inclusive dates, server quantities, CLOSED with remaining stock and a missing date without guessed values', async () => {
    signIn()
    const fetch = stubReads()
    open()
    await screen.findByRole('table')
    expect(calendar().getAttribute('tabindex')).toBe('0')
    const help = document.getElementById(calendar().getAttribute('aria-describedby')!)!
    expect(help.textContent).toContain('가로로 스크롤')
    expect(help.textContent).toContain('미생성은 0이나 CLOSED를 뜻하지 않습니다')
    const rows = within(calendar()).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['5', '2', '3', 'OPEN'])
    expect(
      within(rows[2])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['미생성 (수량·상태 미정)'])
    expect(
      within(rows[3])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['5', '2', '3', 'CLOSED'])
    expect(screen.queryByLabelText('예약 수량')).toBeNull()
    expect(screen.queryByLabelText('가용 수량')).toBeNull()
    expect(new Headers(fetch.mock.calls[0][1].headers).has('Authorization')).toBe(false) // Public Room read only.
    expect(new Headers(fetch.mock.calls[1][1].headers).get('Authorization')).toMatch(/^Bearer /)
    await selectDate('2030-07-21')
    expect((screen.getByLabelText('설정할 총수량') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: '날짜 재고 생성' })).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    await selectDate('2030-07-22')
    expect(
      within(calendar()).getByRole('button', { name: '2030-07-22' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(calendar()).getByRole('cell', { name: 'CLOSED' }).textContent).toBe('CLOSED')
    expect((screen.getByLabelText('판매 상태') as HTMLSelectElement).value).toBe('CLOSED')
    expect((screen.getByLabelText('설정할 총수량') as HTMLInputElement).value).toBe('5')
    expect(writes(fetch)).toHaveLength(0)
  })
  it('renders an empty successful range as all uncreated, never as a read error', async () => {
    signIn()
    stubReads(false, true)
    open()
    await screen.findByRole('table')
    expect(within(calendar()).getAllByText('미생성 (수량·상태 미정)')).toHaveLength(3)
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it.each([
    'roomId=0&startDate=2030-07-20&endDate=2030-07-22',
    'roomId=3&startDate=2030-07-22&endDate=2030-07-20',
    'roomId=3&startDate=2030-01-01&endDate=2031-01-02',
    'roomId=3&startDate=2030-02-30&endDate=2030-07-22',
    'roomId=3&roomId=4',
  ])('rejects invalid selection %s before HTTP', (query) => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open(`/admin/inventories?${query}`)
    expect(screen.getByRole('alert').textContent).toContain('범위를 확인')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('allows a past leap-date, single-day inclusive Calendar', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            Response.json(
              url.includes('/inventories?')
                ? { roomId: 3, startDate: '2000-02-29', endDate: '2000-02-29', inventories: [] }
                : room,
            ),
          ),
        ),
    )
    open('/admin/inventories?roomId=3&startDate=2000-02-29&endDate=2000-02-29')
    await screen.findByRole('table')
    expect(within(calendar()).getAllByRole('row')).toHaveLength(2)
    expect(within(calendar()).getByRole('button', { name: '2000-02-29' })).toBeTruthy()
  })
  it('reads inactive Room inventory but blocks creation and updates even on direct form submission', async () => {
    signIn()
    const fetch = stubReads(true)
    open()
    await selectDate()
    expect(screen.getByText(/INACTIVE 객실은 재고 조회만/)).toBeTruthy()
    expect(
      (screen.getByLabelText('설정할 총수량').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(true)
    fireEvent.submit(form())
    await selectDate('2030-07-21')
    fireEvent.submit(form())
    expect(writes(fetch)).toHaveLength(0)
  })
  it.each([400, 403, 404, 500])(
    'does not turn failed Calendar GET %s into missing stock or a write form',
    async (status) => {
      signIn()
      let fail = true
      const fetch = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            url.includes('/inventories?')
              ? fail
                ? errorResponse(status)
                : Response.json(inventoryCalendar)
              : Response.json(room),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open()
      expect((await screen.findByRole('alert')).textContent).toContain(`INVENTORY_${status}`)
      expect(screen.queryByRole('table')).toBeNull()
      expect(screen.queryByRole('form', { name: '날짜 재고 입력' })).toBeNull()
      fail = false
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      await selectDate()
      expect(writes(fetch)).toHaveLength(0)
    },
  )
})

describe('single-date Inventory mutation', () => {
  it('creates zero stock once, blocks duplicates and reloads the authoritative Calendar rather than using write response', async () => {
    signIn()
    let finish!: (response: Response) => void,
      saved = false
    const newRow = {
      ...inventory,
      inventoryId: 21,
      inventoryDate: '2030-07-21',
      totalQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    }
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'POST')
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      return Promise.resolve(
        Response.json(
          url.includes('/inventories?')
            ? {
                ...inventoryCalendar,
                inventories: saved
                  ? [
                      inventory,
                      { ...newRow, totalQuantity: 4, availableQuantity: 4 },
                      inventoryCalendar.inventories[1],
                    ]
                  : inventoryCalendar.inventories,
              }
            : room,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await selectDate('2030-07-21')
    prepare('0')
    fireEvent.submit(form())
    fireEvent.submit(form())
    await waitFor(() => expect(writes(fetch)).toHaveLength(1))
    expect(JSON.parse(writes(fetch)[0][1].body)).toEqual({
      inventoryDate: '2030-07-21',
      totalQuantity: 0,
    })
    expect(
      (screen.getByRole('button', { name: '재고 Calendar 새로 조회' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    saved = true
    await act(async () => finish(Response.json(newRow, { status: 201 })))
    await screen.findByRole('button', { name: '날짜 재고 저장' })
    expect((screen.getByLabelText('설정할 총수량') as HTMLInputElement).value).toBe('4')
    expect((screen.getByLabelText(confirmation) as HTMLInputElement).checked).toBe(false)
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual([
      'GET',
      'GET',
      'POST',
      'GET',
      'GET',
    ])
  })
  it('updates only totalQuantity and saleStatus for one date, retaining server occupancy and positive CLOSED availability', async () => {
    signIn()
    let row = inventory
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'PUT')
        row = { ...inventory, totalQuantity: 4, availableQuantity: 2, saleStatus: 'CLOSED' }
      return Promise.resolve(
        Response.json(
          url.includes('/inventories?')
            ? { ...inventoryCalendar, inventories: [row] }
            : url.includes('/inventories/')
              ? row
              : room,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await selectDate()
    fireEvent.change(screen.getByLabelText('판매 상태'), { target: { value: 'CLOSED' } })
    prepare('4')
    fireEvent.submit(form())
    await waitFor(() =>
      expect((screen.getByLabelText('설정할 총수량') as HTMLInputElement).value).toBe('4'),
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5))
    expect(writes(fetch)).toHaveLength(1)
    expect(writes(fetch)[0][0]).toMatch(/\/rooms\/3\/inventories\/2030-07-20$/)
    expect(JSON.parse(writes(fetch)[0][1].body)).toEqual({ totalQuantity: 4, saleStatus: 'CLOSED' })
    const first = within(calendar()).getAllByRole('row')[1]
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['4', '2', '2', 'CLOSED'])
    expect(fetch.mock.calls.some(([url]) => /prices|reservations/.test(url))).toBe(false)
  })
  it.each(['-1', '1.5', '2147483648', '1e2', ''])(
    'rejects invalid quantity %s before POST',
    async (value) => {
      signIn()
      const fetch = stubReads()
      open()
      await selectDate('2030-07-21')
      prepare(value)
      fireEvent.submit(form())
      expect(screen.getByRole('alert').textContent).toContain('정수')
      expect(writes(fetch)).toHaveLength(0)
    },
  )
  it('rejects total below the read-time reserved quantity without changing occupancy', async () => {
    signIn()
    const fetch = stubReads()
    open()
    await selectDate()
    prepare('1')
    fireEvent.submit(form())
    expect(screen.getByRole('alert').textContent).toContain('예약 수량보다 줄일 수 없습니다')
    expect(writes(fetch)).toHaveLength(0)
  })
  it('requires a new acknowledgement after quantity or sale status changes', async () => {
    signIn()
    const fetch = stubReads()
    open()
    await selectDate()
    prepare('5')
    fireEvent.change(screen.getByLabelText('판매 상태'), { target: { value: 'CLOSED' } })
    expect((screen.getByLabelText(confirmation) as HTMLInputElement).checked).toBe(false)
    fireEvent.submit(form())
    expect(screen.getByRole('alert').textContent).toContain('확인해 주세요')
    fireEvent.click(screen.getByLabelText(confirmation))
    fireEvent.change(screen.getByLabelText('설정할 총수량'), { target: { value: '6' } })
    expect((screen.getByLabelText(confirmation) as HTMLInputElement).checked).toBe(false)
    expect(writes(fetch)).toHaveLength(0)
  })
})

describe('Inventory conflicts and uncertain outcomes', () => {
  it('never switches a duplicate POST to PUT until fresh Calendar and explicit review', async () => {
    signIn()
    let refreshed = false
    const created = { ...inventory, inventoryId: 21, inventoryDate: '2030-07-21' }
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'POST') return Promise.resolve(errorResponse(409, 'INVENTORY_002'))
      return Promise.resolve(
        Response.json(
          url.includes('/inventories?')
            ? {
                ...inventoryCalendar,
                inventories: refreshed
                  ? [inventory, created, inventoryCalendar.inventories[1]]
                  : inventoryCalendar.inventories,
              }
            : room,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await selectDate('2030-07-21')
    prepare('5')
    fireEvent.submit(form())
    await screen.findByRole('region', { name: '재고 저장 결과 재확인' })
    expect(writes(fetch).map(([, init]) => init.method)).toEqual(['POST'])
    expect(fetch).toHaveBeenCalledTimes(3)
    expect((screen.getByLabelText(reviewConfirmation) as HTMLInputElement).disabled).toBe(true)
    refreshed = true
    fireEvent.click(screen.getByRole('button', { name: '재고 Calendar 새로 조회' }))
    await screen.findByRole('button', { name: '날짜 재고 저장' })
    fireEvent.submit(form())
    expect(writes(fetch)).toHaveLength(1)
    fireEvent.click(screen.getByLabelText(reviewConfirmation))
    fireEvent.click(screen.getByRole('button', { name: '확인 후 새 재고 요청 준비' }))
    expect((screen.getByLabelText('설정할 총수량') as HTMLInputElement).value).toBe('5')
    expect((screen.getByLabelText(confirmation) as HTMLInputElement).checked).toBe(false)
    expect(writes(fetch)).toHaveLength(1)
  })
  it.each(['INVENTORY_006', 'INVENTORY_011', 'INVENTORY_008'])(
    'locks %s until successful fresh Calendar, explicit review and new write confirmation',
    async (code) => {
      signIn()
      let refreshed = false,
        failRead = false
      const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        if (init.method !== 'GET') return Promise.resolve(errorResponse(409, code))
        return Promise.resolve(
          url.includes('/inventories?')
            ? failRead
              ? errorResponse(500)
              : Response.json({
                  ...inventoryCalendar,
                  inventories: refreshed
                    ? [
                        {
                          ...inventory,
                          totalQuantity: 6,
                          reservedQuantity: 5,
                          availableQuantity: 1,
                        },
                      ]
                    : inventoryCalendar.inventories,
                })
            : Response.json(room),
        )
      })
      vi.stubGlobal('fetch', fetch)
      open()
      await selectDate()
      prepare('4')
      fireEvent.submit(form())
      await screen.findByRole('region', { name: '재고 저장 결과 재확인' })
      expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes(code))).toBe(
        true,
      )
      expect((screen.getByLabelText(reviewConfirmation) as HTMLInputElement).disabled).toBe(true)
      fireEvent.submit(form())
      await selectDate('2030-07-21') // Switching to a missing date must not bypass the page-level conflict gate.
      prepare('4')
      fireEvent.submit(form())
      expect(writes(fetch)).toHaveLength(1)
      failRead = true
      fireEvent.click(screen.getByRole('button', { name: '재고 Calendar 새로 조회' }))
      await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
      expect(screen.queryByRole('button', { name: '확인 후 새 재고 요청 준비' })).toBeNull()
      failRead = false
      refreshed = true
      fireEvent.click(screen.getByRole('button', { name: '재고 Calendar 새로 조회' }))
      await screen.findByRole('table')
      expect((screen.getByLabelText(reviewConfirmation) as HTMLInputElement).disabled).toBe(false)
      fireEvent.submit(form())
      expect(writes(fetch)).toHaveLength(1)
      fireEvent.click(screen.getByLabelText(reviewConfirmation))
      fireEvent.click(screen.getByRole('button', { name: '확인 후 새 재고 요청 준비' }))
      await selectDate()
      expect((screen.getByLabelText('설정할 총수량') as HTMLInputElement).value).toBe('6')
      expect((screen.getByLabelText(confirmation) as HTMLInputElement).checked).toBe(false)
      expect(
        (screen.getByLabelText('설정할 총수량').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(false)
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it.each(['network', '500', 'malformed'])(
    'requires the same fresh-read gate for ambiguous %s without generic acknowledgement bypass',
    async (failure) => {
      signIn()
      const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        if (init.method === 'POST')
          return failure === 'network'
            ? Promise.reject(new TypeError('offline'))
            : Promise.resolve(
                failure === '500' ? errorResponse(500) : Response.json({ ...inventory, roomId: 4 }),
              )
        return Promise.resolve(
          Response.json(url.includes('/inventories?') ? inventoryCalendar : room),
        )
      })
      vi.stubGlobal('fetch', fetch)
      open()
      await selectDate('2030-07-21')
      prepare('0')
      fireEvent.submit(form())
      await screen.findByRole('region', { name: '불명확한 저장 결과 확인' })
      expect(screen.queryByRole('button', { name: '확인 후 입력 잠금 해제' })).toBeNull()
      expect((screen.getByLabelText(reviewConfirmation) as HTMLInputElement).disabled).toBe(true)
      fireEvent.submit(form())
      fireEvent.click(screen.getByRole('button', { name: '재고 Calendar 새로 조회' }))
      await screen.findByRole('table')
      expect(
        (screen.getByLabelText('설정할 총수량').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(true)
      fireEvent.click(screen.getByLabelText(reviewConfirmation))
      fireEvent.click(screen.getByRole('button', { name: '확인 후 새 재고 요청 준비' }))
      expect(
        (screen.getByLabelText('설정할 총수량').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(false)
      expect((screen.getByLabelText(confirmation) as HTMLInputElement).checked).toBe(false)
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it('retains successful write evidence when its subsequent read fails, with no editable form or automatic replay', async () => {
    signIn()
    let saved = false
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'PUT') {
        saved = true
        return Promise.resolve(Response.json(inventory))
      }
      return Promise.resolve(
        url.includes('/inventories?')
          ? saved
            ? errorResponse(500)
            : Response.json(inventoryCalendar)
          : Response.json(room),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await selectDate()
    prepare()
    fireEvent.submit(form())
    await screen.findByRole('alert')
    expect(
      screen.getByText('재고 저장 응답을 받았습니다. 최신 Calendar를 다시 조회합니다.'),
    ).toBeTruthy()
    expect(screen.queryByRole('form', { name: '날짜 재고 입력' })).toBeNull()
    expect(writes(fetch)).toHaveLength(1)
  })
})

describe('Inventory authorization and request lifetimes', () => {
  it.each(['anonymous', 'USER'])(
    'blocks %s at a fully specified Calendar deep link before reads',
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
  it.each([400, 403, 404])(
    'shows common write HTTP %s/fields and stays locked without inventing a role',
    async (status) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation((url: string, init: RequestInit) =>
          Promise.resolve(
            init.method === 'PUT'
              ? errorResponse(status)
              : Response.json(url.includes('/inventories?') ? inventoryCalendar : room),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open()
      await selectDate()
      prepare()
      fireEvent.submit(form())
      await screen.findByRole('region', { name: '재고 저장 결과 재확인' })
      expect(screen.getByRole('list', { name: '서버 입력 오류' }).textContent).toContain(
        'totalQuantity: 수량 확인',
      )
      expect(getRoleHint()).toBe('ADMIN')
      expect(
        (screen.getByLabelText('설정할 총수량').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(true)
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it('uses shared login recovery on write 401 without reissue or replay', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string, init: RequestInit) =>
        Promise.resolve(
          init.method === 'PUT'
            ? errorResponse(401)
            : Response.json(url.includes('/inventories?') ? inventoryCalendar : room),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    await selectDate()
    prepare()
    fireEvent.submit(form())
    await screen.findByRole('heading', { name: '로그인' })
    expect(writes(fetch)).toHaveLength(1)
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/auth/reissue'))).toBe(false)
  })
  it('aborts an old Calendar range and ignores its late response', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('endDate=2030-07-22'))
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      return Promise.resolve(
        Response.json(
          url.includes('/inventories?')
            ? {
                ...inventoryCalendar,
                startDate: '2030-07-23',
                endDate: '2030-07-23',
                inventories: [],
              }
            : room,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    const oldSignal = fetch.mock.calls[1][1].signal as AbortSignal
    selectRange('3', '2030-07-23', '2030-07-23')
    await screen.findByRole('table')
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finish(Response.json(inventoryCalendar)))
    expect(within(calendar()).queryByRole('button', { name: '2030-07-20' })).toBeNull()
    expect(within(calendar()).getByRole('button', { name: '2030-07-23' })).toBeTruthy()
    expect(writes(fetch)).toHaveLength(0)
  })
  it.each(['room', 'session'])(
    'discards late mutation after %s changes without applying old success to the new scope',
    async (scope) => {
      signIn()
      let finish!: (response: Response) => void
      const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        if (init.method === 'PUT')
          return new Promise<Response>((resolve) => {
            finish = resolve
          })
        const roomId = url.includes('/rooms/4') ? 4 : 3
        return Promise.resolve(
          Response.json(
            url.includes('/inventories?')
              ? {
                  ...inventoryCalendar,
                  roomId,
                  inventories: inventoryCalendar.inventories.map((row) => ({ ...row, roomId })),
                }
              : { ...room, roomId },
          ),
        )
      })
      vi.stubGlobal('fetch', fetch)
      open()
      await selectDate()
      prepare('4')
      fireEvent.submit(form())
      await waitFor(() => expect(writes(fetch)).toHaveLength(1))
      const signal = writes(fetch)[0][1].signal as AbortSignal
      if (scope === 'room') selectRange('4', '2030-07-20', '2030-07-22')
      else act(() => signIn())
      await screen.findByRole('table')
      expect(screen.queryByRole('form', { name: '날짜 재고 입력' })).toBeNull()
      expect(signal.aborted).toBe(true)
      await act(async () => finish(Response.json(inventory)))
      expect(
        screen.queryByText('재고 저장 응답을 받았습니다. 최신 Calendar를 다시 조회합니다.'),
      ).toBeNull()
      expect(writes(fetch)).toHaveLength(1)
    },
  )
  it.each(['/admin/rooms?accommodationId=7', '/admin/rooms/3'])(
    'links %s to inventory selection without guessed dates',
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
        name: url.includes('?') ? '스탠다드 날짜별 재고 관리' : '이 객실의 날짜별 재고 관리',
      })
      expect(link.getAttribute('href')).toBe('/admin/inventories?roomId=3')
      fireEvent.click(link)
      expect((screen.getByLabelText('재고 관리 객실 ID') as HTMLInputElement).value).toBe('3')
      expect((screen.getByLabelText('재고 조회 시작일') as HTMLInputElement).value).toBe('')
      expect((screen.getByLabelText('재고 조회 종료일') as HTMLInputElement).value).toBe('')
      expect(fetch.mock.calls.some(([target]) => target.includes('/inventories'))).toBe(false)
    },
  )
})
