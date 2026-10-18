import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/routes'
import { AuthProvider } from '../../state/AuthProvider'
import { setTokenPair } from '../../state/accessToken'
import { accessTokenWithExpiry } from '../../test/jwt'
import { accommodation, accommodationPage } from '../../test/accommodation'
import {
  accommodationWrite,
  bookingPolicy,
  cancellationPolicy,
} from '../../test/adminAccommodation'
import { validateAccommodation } from '../../components/admin/accommodationValidation'
import { readAdminAccommodationQuery } from './adminAccommodationQuery'

function signIn(role = 'ADMIN') {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'refresh',
  )
}
function Location() {
  const location = useLocation(),
    navigate = useNavigate()
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button onClick={() => navigate(-1)}>뒤로</button>
    </>
  )
}
function open(path = '/admin/accommodations') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <Location />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function fillAccommodation() {
  for (const [label, value] of [
    ['숙소 이름', '서울 호텔'],
    ['숙소 설명', '편안한 숙소'],
    ['국가', '대한민국'],
    ['도시', '서울특별시'],
    ['지역', '강남구'],
    ['상세 주소', '테헤란로 1'],
    ['숙소 시간대', 'Asia/Seoul'],
    ['체크인 시간', '15:00:00'],
    ['체크아웃 시간', '11:00:00'],
  ])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
  fireEvent.click(screen.getByLabelText('주차'))
  fireEvent.click(screen.getByLabelText('수영장'))
}
function policyForm(kind: '예약' | '취소') {
  return screen.getByRole('form', { name: `${kind} 정책 입력` })
}
function fillPolicy(kind: '예약' | '취소', operation = 'POST') {
  const form = within(policyForm(kind))
  fireEvent.change(form.getByLabelText(`${kind} 정책 작업`), { target: { value: operation } })
  const fields =
    kind === '예약'
      ? [
          ['최소 숙박일', '1'],
          ['최대 숙박일', '14'],
          ['최소 사전 예약일', '0'],
          ['최대 사전 예약일', '365'],
        ]
      : [
          ['무료 취소 기준일', '7'],
          ['취소 마감 기준일', '1'],
          ['구간 1 시작일', '1'],
          ['구간 1 수수료율 (%)', '50'],
        ]
  for (const [label, value] of fields)
    fireEvent.change(form.getByLabelText(label), { target: { value } })
  fireEvent.click(form.getByLabelText(`${kind} 정책 생성/수정 작업과 전체 입력값을 확인했습니다.`))
}
const jsonError = (status: number) =>
  Response.json(
    {
      status,
      code: `ERROR_${status}`,
      message: '서버에서 거절했습니다',
      errors: [{ field: 'name', message: '숙소 이름 검증 오류' }],
    },
    { status },
  )

describe('Accommodation Admin list and URL conditions', () => {
  it('loads all statuses without public ACTIVE/availability defaults and keeps the active menu', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(accommodationPage({ content: [{ ...accommodation, status: 'INACTIVE' }] })),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    expect(screen.getByText('관리 숙소 목록을 불러오고 있습니다.')).toBeTruthy()
    await screen.findByRole('link', { name: '서울 호텔 (ID 7)' })
    expect(screen.getByText(/운영 중지 ·/)).toBeTruthy()
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const params = new URL(url, 'http://localhost').searchParams
    for (const field of ['status', 'available', 'checkInDate', 'guestCount'])
      expect(params.has(field)).toBe(false)
    expect(params.get('page')).toBe('0')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(
      within(screen.getByRole('navigation', { name: '관리 메뉴' }))
        .getByRole('link', { name: '숙소 관리' })
        .getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.queryByRole('button', { name: /삭제/ })).toBeNull()
  })
  it('applies exact city/region, status, sort and size, resets page and preserves conditions across paging/history', async () => {
    signIn()
    const fetch = vi.fn((url: string) => {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
      return Promise.resolve(
        Response.json(accommodationPage({ page, first: page === 0, last: false, totalPages: 4 })),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations?page=2')
    await screen.findByText('총 1개 숙소')
    for (const [label, value] of [
      ['숙소명 검색', '호텔'],
      ['도시 (정확한 이름)', '서울특별시'],
      ['지역 (정확한 이름)', '강남구'],
      ['운영 상태 필터', 'INACTIVE'],
      ['정렬 필드', 'NAME'],
      ['정렬 방향', 'DESC'],
      ['페이지 크기', '10'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.submit(screen.getByRole('form', { name: '숙소 관리 검색' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await screen.findByText('1 / 4 페이지')
    const query = new URL(fetch.mock.calls[1][0], 'http://localhost').searchParams
    expect(Object.fromEntries(query)).toEqual({
      name: '호텔',
      city: '서울특별시',
      region: '강남구',
      status: 'INACTIVE',
      page: '0',
      size: '10',
      sortBy: 'NAME',
      direction: 'DESC',
    })
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByText('2 / 4 페이지')
    expect(screen.getByTestId('location').textContent).toContain('status=INACTIVE')
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    await screen.findByText('1 / 4 페이지')
    expect((screen.getByLabelText('운영 상태 필터') as HTMLSelectElement).value).toBe('INACTIVE')
  })
  it.each([
    'page=-1',
    'page=2147483648',
    'size=101',
    'size=0',
    'status=OTHER',
    'sortBy=PRICE',
    'page=0&page=1',
    'direction=OTHER',
  ])('rejects invalid management URL %s before fetching', (query) => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open(`/admin/accommodations?${query}`)
    expect(screen.getByRole('alert').textContent).toContain('검색 조건이 올바르지')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses loading, empty, error and explicit read retry states', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonError(500))
      .mockResolvedValueOnce(
        Response.json(accommodationPage({ content: [], totalElements: 0, totalPages: 0 })),
      )
    vi.stubGlobal('fetch', fetch)
    open()
    expect((await screen.findByRole('alert')).textContent).toContain('ERROR_500')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('검색 조건에 맞는 숙소가 없습니다.')
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('ignores public stay conditions even if manually appended to the admin URL', () => {
    expect(
      readAdminAccommodationQuery(new URLSearchParams('checkInDate=2030-01-01&available=true')),
    ).not.toHaveProperty('available')
  })
})

describe('Accommodation create and update', () => {
  it('creates with actual fields once and navigates to freshly loaded detail; list remount fetches again', async () => {
    signIn()
    let resolve!: (response: Response) => void
    const fetch = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'POST')
        return new Promise<Response>((done) => {
          resolve = done
        })
      return Promise.resolve(
        Response.json(url.endsWith('/7') ? accommodation : accommodationPage()),
      )
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/new')
    fillAccommodation()
    const form = screen.getByRole('form', { name: '숙소 생성' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual(accommodationWrite)
    expect(
      (screen.getByLabelText('숙소 이름') as HTMLInputElement).disabled ||
        screen.getByLabelText('숙소 이름').closest('fieldset')?.disabled,
    ).toBe(true)
    await act(async () => resolve(Response.json(accommodation, { status: 201 })))
    await screen.findByRole('form', { name: '숙소 정보 수정' })
    expect(screen.getByTestId('location').textContent).toBe('/admin/accommodations/7')
    expect(fetch.mock.calls[1][0]).toMatch(/\/accommodations\/7$/)
    fireEvent.click(screen.getByRole('link', { name: '관리 목록으로' }))
    await screen.findByRole('link', { name: '서울 호텔 (ID 7)' })
    expect(fetch.mock.calls[2][0]).toMatch(/\/accommodations\?/)
  })
  it('rejects missing fields, invalid zone and equal operating times without writes', () => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/new')
    fireEvent.submit(screen.getByRole('form', { name: '숙소 생성' }))
    expect(screen.getByRole('alert').textContent).toContain('필수 입력')
    expect(fetch).not.toHaveBeenCalled()
    expect(
      validateAccommodation({
        ...accommodationWrite,
        checkInTime: '11:00',
        checkOutTime: '11:00:00',
        timeZone: 'Not/AZone',
      }),
    ).toHaveLength(2)
    expect(validateAccommodation({ ...accommodationWrite, checkInTime: '25:00' })).toHaveLength(1)
  })
  it('leaves legacy null fields blank and requires confirmed replacement values', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        ...accommodation,
        country: null,
        city: null,
        region: null,
        checkInTime: null,
        checkOutTime: null,
      }),
    )
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/7')
    await screen.findByRole('form', { name: '숙소 정보 수정' })
    for (const label of ['국가', '도시', '지역', '체크인 시간', '체크아웃 시간'])
      expect((screen.getByLabelText(label, { exact: true }) as HTMLInputElement).value).toBe('')
    fireEvent.submit(screen.getByRole('form', { name: '숙소 정보 수정' }))
    expect(screen.getByRole('alert').textContent).toContain('필수 입력')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('saves a full update and reloads detail rather than reusing the old projection', async () => {
    signIn()
    let row = accommodation
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      if (init.method === 'PUT') row = { ...row, ...JSON.parse(init.body as string) }
      return Promise.resolve(Response.json(row))
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/7')
    await screen.findByRole('form', { name: '숙소 정보 수정' })
    fireEvent.change(screen.getByLabelText('숙소 이름'), { target: { value: '변경 호텔' } })
    fireEvent.submit(screen.getByRole('form', { name: '숙소 정보 수정' }))
    await screen.findByRole('heading', { name: '변경 호텔', level: 3 })
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'PUT', 'GET'])
    expect((screen.getByLabelText('숙소 이름') as HTMLInputElement).value).toBe('변경 호텔')
  })
  it('requires status acknowledgement, sends PATCH only and reflects the refreshed state', async () => {
    signIn()
    let row = accommodation
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') row = { ...row, status: 'INACTIVE' }
      return Promise.resolve(Response.json(row))
    })
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/7')
    const form = await screen.findByRole('form', { name: '숙소 운영 상태 변경' })
    fireEvent.submit(form)
    expect(fetch).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByLabelText('운영 상태 변경을 확인했습니다.'))
    fireEvent.submit(form)
    await screen.findByText('운영 중지', { exact: true })
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'PATCH', 'GET'])
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ status: 'INACTIVE' }))
  })
  it.each(['bad', '0', '9007199254740992'])('rejects invalid detail ID %s locally', (id) => {
    signIn()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    open(`/admin/accommodations/${id}`)
    expect(screen.getByRole('alert').textContent).toContain('숙소 ID')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('shows missing detail without mounting write forms', async () => {
    signIn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonError(404)))
    open('/admin/accommodations/7')
    expect((await screen.findByRole('alert')).textContent).toContain('존재하지 않습니다')
    expect(screen.queryByRole('form')).toBeNull()
  })
})

describe('Accommodation policy forms with no read endpoint', () => {
  it.each(['POST', 'PUT'])(
    'requires explicit %s and all booking fields, shows the success response without policy GET',
    async (operation) => {
      signIn()
      const response = { ...bookingPolicy, bookingPolicyId: 5, accommodationId: 7 }
      const fetch = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            Response.json(url.endsWith('/booking-policy') ? response : accommodation),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open('/admin/accommodations/7')
      await screen.findByRole('form', { name: '예약 정책 입력' })
      fireEvent.submit(policyForm('예약'))
      expect(fetch).toHaveBeenCalledOnce()
      fillPolicy('예약', operation)
      fireEvent.submit(policyForm('예약'))
      await screen.findByRole('region', { name: '예약 정책 성공 응답' })
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch.mock.calls[1][1].method).toBe(operation)
      expect(JSON.parse(fetch.mock.calls[1][1].body as string)).toEqual(bookingPolicy)
      expect(screen.getByText(/현재 정책 재조회 결과가 아닙니다/)).toBeTruthy()
      expect(
        (
          screen.getByLabelText(
            '예약 정책 생성/수정 작업과 전체 입력값을 확인했습니다.',
          ) as HTMLInputElement
        ).checked,
      ).toBe(false)
    },
  )
  it.each(['POST', 'PUT'])(
    'supports cancellation %s with tier add/remove, sorted DTO, response and validation',
    async (operation) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            Response.json(
              url.endsWith('/cancellation-policy')
                ? { ...cancellationPolicy, cancellationPolicyId: 6, accommodationId: 7 }
                : accommodation,
            ),
          ),
        )
      vi.stubGlobal('fetch', fetch)
      open('/admin/accommodations/7')
      await screen.findByRole('form', { name: '취소 정책 입력' })
      fillPolicy('취소', operation)
      fireEvent.click(screen.getByRole('button', { name: '수수료 구간 추가' }))
      fireEvent.change(screen.getByLabelText('구간 2 시작일'), { target: { value: '1' } })
      fireEvent.change(screen.getByLabelText('구간 2 수수료율 (%)'), { target: { value: '30' } })
      fireEvent.click(
        screen.getByLabelText('취소 정책 생성/수정 작업과 전체 입력값을 확인했습니다.'),
      )
      fireEvent.submit(policyForm('취소'))
      expect(screen.getByRole('alert').textContent).toContain('중복 없는')
      expect(fetch).toHaveBeenCalledOnce()
      fireEvent.change(screen.getByLabelText('구간 2 시작일'), { target: { value: '3' } })
      fireEvent.click(
        screen.getByLabelText('취소 정책 생성/수정 작업과 전체 입력값을 확인했습니다.'),
      )
      fireEvent.submit(policyForm('취소'))
      await screen.findByRole('region', { name: '취소 정책 성공 응답' })
      expect(JSON.parse(fetch.mock.calls[1][1].body as string)).toEqual(cancellationPolicy)
      expect(fetch.mock.calls[1][1].method).toBe(operation)
      expect(screen.getByText('3일 이상: 30%')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '구간 2 제거' }))
      expect(screen.queryByLabelText('구간 2 시작일')).toBeNull()
    },
  )
  it.each([404, 409])('does not switch policy operation automatically after %s', async (status) => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/booking-policy') ? jsonError(status) : Response.json(accommodation),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/7')
    await screen.findByRole('form', { name: '예약 정책 입력' })
    fillPolicy('예약', status === 404 ? 'PUT' : 'POST')
    fireEvent.submit(policyForm('예약'))
    await screen.findByRole('alert')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((screen.getByLabelText('예약 정책 작업') as HTMLSelectElement).value).toBe(
      status === 404 ? 'PUT' : 'POST',
    )
    expect(screen.queryByRole('region', { name: '예약 정책 성공 응답' })).toBeNull()
  })
  it('rejects blank and inverted booking ranges even after explicit acknowledgement', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(Response.json(accommodation))
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/7')
    await screen.findByRole('form', { name: '예약 정책 입력' })
    fillPolicy('예약')
    fireEvent.change(screen.getByLabelText('최소 사전 예약일'), { target: { value: '' } })
    expect(
      (
        screen.getByLabelText(
          '예약 정책 생성/수정 작업과 전체 입력값을 확인했습니다.',
        ) as HTMLInputElement
      ).checked,
    ).toBe(false)
    fireEvent.click(screen.getByLabelText('예약 정책 생성/수정 작업과 전체 입력값을 확인했습니다.'))
    fireEvent.submit(policyForm('예약'))
    expect(screen.getByRole('alert').textContent).toContain('최소 ≤ 최대')
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('Admin write failures, auth and lifetime safety', () => {
  it.each([400, 403, 404, 409])(
    'retains HTTP %s details with no automatic writes or operation switch',
    async (status) => {
      signIn()
      const fetch = vi.fn().mockResolvedValue(jsonError(status))
      vi.stubGlobal('fetch', fetch)
      open('/admin/accommodations/new')
      fillAccommodation()
      fireEvent.submit(screen.getByRole('form', { name: '숙소 생성' }))
      expect((await screen.findByRole('alert')).textContent).toContain(`ERROR_${status}`)
      expect(screen.getByRole('list', { name: '서버 입력 오류' }).textContent).toContain(
        'name: 숙소 이름 검증 오류',
      )
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each(['network', '500', 'malformed'])(
    'locks ambiguous %s writes until explicit outcome review',
    async (failure) => {
      signIn()
      const fetch = vi
        .fn()
        .mockImplementation(() =>
          failure === 'network'
            ? Promise.reject(new TypeError('offline'))
            : Promise.resolve(failure === '500' ? jsonError(500) : Response.json({})),
        )
      vi.stubGlobal('fetch', fetch)
      open('/admin/accommodations/new')
      fillAccommodation()
      const form = screen.getByRole('form', { name: '숙소 생성' })
      fireEvent.submit(form)
      await screen.findByRole('region', { name: '불명확한 저장 결과 확인' })
      fireEvent.submit(form)
      expect(fetch).toHaveBeenCalledOnce()
      const unlock = screen.getByRole('button', { name: '확인 후 입력 잠금 해제' })
      expect((unlock as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(screen.getByLabelText('저장 결과를 별도로 확인했으며 새 요청을 준비합니다.'))
      fireEvent.click(unlock)
      expect(fetch).toHaveBeenCalledOnce()
      expect(screen.queryByRole('region', { name: '불명확한 저장 결과 확인' })).toBeNull()
    },
  )
  it('locks all writes while one policy write is pending and ignores late success after unmount', async () => {
    signIn()
    let resolve!: (response: Response) => void
    const fetch = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/booking-policy')
        ? new Promise<Response>((done) => {
            resolve = done
          })
        : Promise.resolve(Response.json(accommodation)),
    )
    vi.stubGlobal('fetch', fetch)
    const view = open('/admin/accommodations/7')
    await screen.findByRole('form', { name: '예약 정책 입력' })
    fillPolicy('예약')
    fireEvent.submit(policyForm('예약'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    fireEvent.submit(screen.getByRole('form', { name: '숙소 정보 수정' }))
    fireEvent.submit(policyForm('예약'))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(
      (screen.getByLabelText('숙소 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(true)
    view.unmount()
    const signal = fetch.mock.calls[1][1]?.signal // Fetch implementation deliberately ignores abort to exercise stale-result guard.
    expect(signal?.aborted).toBe(true)
    await act(async () =>
      resolve(Response.json({ ...bookingPolicy, bookingPolicyId: 5, accommodationId: 7 })),
    )
    expect(screen.queryByRole('region', { name: '예약 정책 성공 응답' })).toBeNull()
  })
  it('never replays POST or refreshes after write 401; shared auth routes to login', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(jsonError(401))
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/new')
    fillAccommodation()
    fireEvent.submit(screen.getByRole('form', { name: '숙소 생성' }))
    await screen.findByRole('heading', { name: '로그인' })
    expect(fetch).toHaveBeenCalledOnce()
    expect(screen.queryByRole('form', { name: '숙소 생성' })).toBeNull()
  })
  it('discards an old create response after another ADMIN login instead of navigating the new session', async () => {
    signIn()
    let resolve!: (response: Response) => void
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/new')
    fillAccommodation()
    fireEvent.submit(screen.getByRole('form', { name: '숙소 생성' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    act(() => signIn())
    expect((screen.getByLabelText('숙소 이름') as HTMLInputElement).value).toBe('')
    await act(async () => resolve(Response.json(accommodation)))
    expect(screen.getByTestId('location').textContent).toBe('/admin/accommodations/new')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('keeps an uncertain policy write locked even after a fresh catalog GET until explicit review', async () => {
    signIn()
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        url.endsWith('/booking-policy')
          ? Promise.reject(new TypeError('offline'))
          : Promise.resolve(Response.json(accommodation)),
      )
    vi.stubGlobal('fetch', fetch)
    open('/admin/accommodations/7')
    await screen.findByRole('form', { name: '예약 정책 입력' })
    fillPolicy('예약')
    fireEvent.submit(policyForm('예약'))
    await screen.findByRole('region', { name: '불명확한 저장 결과 확인' })
    fireEvent.click(screen.getByRole('button', { name: '숙소 상세 새로 조회' }))
    await screen.findByRole('form', { name: '예약 정책 입력' })
    expect(
      (screen.getByLabelText('숙소 이름').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(true)
    fireEvent.submit(screen.getByRole('form', { name: '숙소 정보 수정' }))
    expect(fetch.mock.calls.map(([url]) => new URL(url, 'http://localhost').pathname)).toEqual([
      '/api/v1/accommodations/7',
      '/api/v1/accommodations/7/booking-policy',
      '/api/v1/accommodations/7',
    ])
    expect(screen.queryByRole('region', { name: '예약 정책 성공 응답' })).toBeNull()
  })
  it.each(['/admin/accommodations/new', '/admin/accommodations/7'])(
    'blocks non-admin direct %s before any read/write',
    (path) => {
      signIn('USER')
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      open(path)
      expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
      expect(fetch).not.toHaveBeenCalled()
    },
  )
})
