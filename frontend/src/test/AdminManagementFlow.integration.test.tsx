import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { clearAccessToken, getRoleHint } from '../state/accessToken'
import { adminManagementApi } from './adminManagementApi'
import { accommodationWrite, bookingPolicy } from './adminAccommodation'
import { inventory } from './inventory'
import { reservationDetail } from './reservation'
import { expectUiSemantics } from './uiSemantics'

function History() {
  const navigate = useNavigate(),
    location = useLocation()
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button onClick={() => navigate('/reservations/43')}>타인 예약 직접 접근</button>
    </>
  )
}
function open(path = '/admin') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <History />
      </MemoryRouter>
    </AuthProvider>,
  )
}
async function login(heading = '관리 홈') {
  expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
  await screen.findByRole('heading', { name: heading })
}
function menu(label: string) {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: '관리 메뉴' })).getByRole('link', {
      name: label,
    }),
  )
}
const form = (name: string) => screen.getByRole('form', { name })
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
const writes = (api: ReturnType<typeof adminManagementApi>) =>
  api.fetch.mock.calls.filter(
    ([url, init]) => init.method !== 'GET' && !url.endsWith('/auth/login'),
  )
async function openInventory() {
  menu('객실 관리')
  change('관리할 숙소 ID', '7')
  fireEvent.submit(form('관리 숙소 선택'))
  fireEvent.click(await screen.findByRole('link', { name: '스탠다드 날짜별 재고 관리' }))
  change('재고 조회 시작일', '2030-07-20')
  change('재고 조회 종료일', '2030-07-22')
  fireEvent.submit(form('재고 조회 대상 선택'))
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: '2030-07-20' }))
}
function inventorySubmit(total: string) {
  change('설정할 총수량', total)
  fireEvent.click(
    screen.getByLabelText('객실·날짜·총수량·판매 상태와 생성/수정 작업을 확인했습니다.'),
  )
  fireEvent.submit(form('날짜 재고 입력'))
}

describe('Admin Management connected flow (HTTP mocks, not Backend authorization proof)', () => {
  it('connects email login → catalog create/update/status/policies → parent room → price → inventory without reservation mutation', async () => {
    const api = adminManagementApi()
    open()
    await login()
    expectUiSemantics()
    const nav = screen.getByRole('navigation', { name: '관리 메뉴' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['관리 홈', '숙소 관리', '객실 관리', '가격 관리', '재고 관리'])
    menu('숙소 관리')
    await screen.findByText('검색 조건에 맞는 숙소가 없습니다.')
    fireEvent.click(screen.getByRole('link', { name: '새 숙소 생성' }))
    for (const [label, key] of [
      ['숙소 이름', 'name'],
      ['숙소 설명', 'description'],
      ['국가', 'country'],
      ['도시', 'city'],
      ['지역', 'region'],
      ['상세 주소', 'address'],
      ['숙소 시간대', 'timeZone'],
      ['체크인 시간', 'checkInTime'],
      ['체크아웃 시간', 'checkOutTime'],
    ] as const)
      change(label, accommodationWrite[key])
    fireEvent.submit(form('숙소 생성'))
    await screen.findByRole('heading', { name: '숙소 관리 #7' })
    await screen.findByRole('form', { name: '숙소 정보 수정' })
    expectUiSemantics()
    change('숙소 이름', '관리 호텔')
    fireEvent.submit(form('숙소 정보 수정'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 숙소 정보' })).getByRole('heading')
          .textContent,
      ).toBe('관리 호텔'),
    )
    // Policy forms deliberately require explicit POST/PUT; no current-policy GET exists.
    for (const operation of ['POST', 'PUT']) {
      const policy = within(form('예약 정책 입력'))
      fireEvent.change(policy.getByLabelText('예약 정책 작업'), { target: { value: operation } })
      for (const [label, key] of [
        ['최소 숙박일', 'minStayNights'],
        ['최대 숙박일', 'maxStayNights'],
        ['최소 사전 예약일', 'minAdvanceBookingDays'],
        ['최대 사전 예약일', 'maxAdvanceBookingDays'],
      ] as const)
        fireEvent.change(policy.getByLabelText(label), {
          target: { value: String(bookingPolicy[key]) },
        })
      fireEvent.click(
        policy.getByLabelText('예약 정책 생성/수정 작업과 전체 입력값을 확인했습니다.'),
      )
      fireEvent.submit(form('예약 정책 입력'))
      await screen.findByRole('region', { name: '예약 정책 성공 응답' })
    }
    for (const operation of ['POST', 'PUT']) {
      const policy = within(form('취소 정책 입력'))
      fireEvent.change(policy.getByLabelText('취소 정책 작업'), { target: { value: operation } })
      for (const [label, value] of [
        ['무료 취소 기준일', '7'],
        ['취소 마감 기준일', '1'],
        ['구간 1 시작일', '1'],
        ['구간 1 수수료율 (%)', '50'],
      ])
        fireEvent.change(policy.getByLabelText(label), { target: { value } })
      fireEvent.click(
        policy.getByLabelText('취소 정책 생성/수정 작업과 전체 입력값을 확인했습니다.'),
      )
      fireEvent.submit(form('취소 정책 입력'))
      await screen.findByRole('region', { name: '취소 정책 성공 응답' })
    }
    fireEvent.click(screen.getByLabelText('운영 상태 변경을 확인했습니다.'))
    fireEvent.submit(form('숙소 운영 상태 변경'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 숙소 정보' })).getByText('운영 중지'),
      ).toBeTruthy(),
    )
    menu('숙소 관리')
    await screen.findByRole('link', { name: '관리 호텔 (ID 7)' })
    const defaultQuery = new URL(
      api.fetch.mock.calls.find(([url]) => /\/accommodations\?/.test(url))![0],
      'http://localhost',
    ).searchParams
    expect(defaultQuery.has('status')).toBe(false)
    change('운영 상태 필터', 'INACTIVE')
    fireEvent.submit(form('숙소 관리 검색'))
    fireEvent.click(await screen.findByRole('link', { name: '관리 호텔 (ID 7)' }))
    await screen.findByRole('form', { name: '숙소 운영 상태 변경' })
    fireEvent.click(screen.getByLabelText('운영 상태 변경을 확인했습니다.'))
    fireEvent.submit(form('숙소 운영 상태 변경'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 숙소 정보' })).getByText('운영 중'),
      ).toBeTruthy(),
    )
    fireEvent.click(await screen.findByRole('link', { name: '이 숙소의 객실 관리' }))
    await screen.findByText('검색 조건에 맞는 객실이 없습니다.')
    fireEvent.click(screen.getByRole('link', { name: '새 객실 생성' }))
    await screen.findByRole('form', { name: '객실 생성' })
    change('객실 이름', '스탠다드')
    change('전체 수용 인원', '2')
    change('기본 1박 가격', '100')
    fireEvent.submit(form('객실 생성'))
    await screen.findByRole('form', { name: '객실 정보 수정' })
    expectUiSemantics()
    expect(screen.getByTestId('location').textContent).toBe('/admin/rooms/3?accommodationId=7')
    change('기본 1박 가격', '120')
    fireEvent.submit(form('객실 정보 수정'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 객실 정보' })).getByText(
          '기본 1박 가격: 120',
        ),
      ).toBeTruthy(),
    )
    await screen.findByRole('form', { name: '객실 운영 상태 변경' })
    fireEvent.click(screen.getByLabelText('객실 상태 변경을 확인했습니다.'))
    fireEvent.submit(form('객실 운영 상태 변경'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 객실 정보' })).getByText('운영 중지'),
      ).toBeTruthy(),
    )
    fireEvent.click(await screen.findByRole('link', { name: '객실 관리 목록으로' }))
    await screen.findByRole('link', { name: '스탠다드 조회·편집 (ID 3)' })
    change('객실 상태 필터', 'INACTIVE')
    fireEvent.submit(form('객실 관리 검색'))
    fireEvent.click(await screen.findByRole('link', { name: '스탠다드 조회·편집 (ID 3)' }))
    await screen.findByRole('form', { name: '객실 운영 상태 변경' })
    fireEvent.click(screen.getByLabelText('객실 상태 변경을 확인했습니다.'))
    fireEvent.submit(form('객실 운영 상태 변경'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 객실 정보' })).getByText('운영 중'),
      ).toBeTruthy(),
    )
    fireEvent.click(await screen.findByRole('link', { name: '이 객실의 날짜별 가격 관리' }))
    change('가격 관리 숙박 날짜', '2030-07-20')
    fireEvent.submit(form('가격 조회 대상 선택'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 적용 가격' })).getByText('DEFAULT'),
      ).toBeTruthy(),
    )
    change('설정할 날짜별 1박 가격', '0')
    fireEvent.click(screen.getByLabelText('객실·숙박 날짜·가격과 생성/수정 작업을 확인했습니다.'))
    fireEvent.submit(form('날짜별 가격 입력'))
    expect(screen.getByRole('alert').textContent).toContain('0보다 크고')
    expect(api.state.price).toBeNull()
    change('설정할 날짜별 1박 가격', '150.25')
    fireEvent.click(screen.getByLabelText('객실·숙박 날짜·가격과 생성/수정 작업을 확인했습니다.'))
    fireEvent.submit(form('날짜별 가격 입력'))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: '현재 적용 가격' })).getByText('DAILY'),
      ).toBeTruthy(),
    )
    change('설정할 날짜별 1박 가격', '160.50')
    fireEvent.click(screen.getByLabelText('객실·숙박 날짜·가격과 생성/수정 작업을 확인했습니다.'))
    fireEvent.submit(form('날짜별 가격 입력'))
    await screen.findByText('160.50', { selector: 'dd' })
    await openInventory()
    expect(screen.getAllByText('미생성 (수량·상태 미정)')).toHaveLength(3)
    inventorySubmit('3')
    await screen.findByRole('button', { name: '날짜 재고 저장' })
    change('판매 상태', 'CLOSED')
    inventorySubmit('2')
    await screen.findByRole('cell', { name: 'CLOSED' })
    expectUiSemantics()
    expect(api.state.inventories[0]).toMatchObject({
      totalQuantity: 2,
      reservedQuantity: 0,
      availableQuantity: 2,
      saleStatus: 'CLOSED',
    })
    expect(api.state.room?.nightlyPrice).toBe(120)
    expect(api.state.price?.nightlyPrice).toBe(160.5)
    expect(api.state.reservation).toEqual(reservationDetail)
    expect(
      writes(api).map(
        ([url, init]) => `${init.method} ${new URL(url, 'http://localhost').pathname}`,
      ),
    ).toEqual([
      'POST /api/v1/accommodations',
      'PUT /api/v1/accommodations/7',
      'POST /api/v1/accommodations/7/booking-policy',
      'PUT /api/v1/accommodations/7/booking-policy',
      'POST /api/v1/accommodations/7/cancellation-policy',
      'PUT /api/v1/accommodations/7/cancellation-policy',
      'PATCH /api/v1/accommodations/7/status',
      'PATCH /api/v1/accommodations/7/status',
      'POST /api/v1/accommodations/7/rooms',
      'PUT /api/v1/rooms/3',
      'PATCH /api/v1/rooms/3/status',
      'PATCH /api/v1/rooms/3/status',
      'POST /api/v1/rooms/3/prices',
      'PUT /api/v1/rooms/3/prices/2030-07-20',
      'POST /api/v1/rooms/3/inventories',
      'PUT /api/v1/rooms/3/inventories/2030-07-20',
    ])
    expect(api.unexpected).toEqual([])
    expect(screen.queryByRole('button', { name: /삭제|예약 취소|예약 일정 변경/ })).toBeNull()
  })

  it.each(['INVENTORY_006', 'INVENTORY_011'])(
    'keeps occupied stock and reservation snapshots intact through %s recovery',
    async (code) => {
      const api = adminManagementApi(true)
      api.state.inventories = [
        { ...inventory, totalQuantity: 3, reservedQuantity: 1, availableQuantity: 2 },
      ]
      open()
      await login()
      await openInventory()
      // A concurrent reservation is represented only by the next server read, never by browser repair.
      api.state.inventories = [
        { ...inventory, totalQuantity: 3, reservedQuantity: 2, availableQuantity: 1 },
      ]
      api.failWrites({ status: 409, code })
      inventorySubmit('1')
      await screen.findByRole('region', { name: '재고 저장 결과 재확인' })
      fireEvent.submit(form('날짜 재고 입력'))
      expect(writes(api)).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: '재고 Calendar 새로 조회' }))
      await screen.findByRole('table')
      expect(
        (screen.getByLabelText('설정할 총수량').closest('fieldset') as HTMLFieldSetElement)
          .disabled,
      ).toBe(true)
      fireEvent.click(
        screen.getByLabelText('최신 Calendar의 재고 수량과 판매 상태를 확인했습니다.'),
      )
      fireEvent.click(screen.getByRole('button', { name: '확인 후 새 재고 요청 준비' }))
      api.failWrites(undefined)
      change('판매 상태', 'CLOSED')
      inventorySubmit('3')
      await screen.findByRole('cell', { name: 'CLOSED' })
      expect(api.state.inventories[0]).toMatchObject({
        reservedQuantity: 2,
        availableQuantity: 1,
        saleStatus: 'CLOSED',
      })
      expect(api.state.reservation).toEqual(reservationDetail)
      expect(writes(api)).toHaveLength(2)
      expect(api.unexpected).toEqual([])
    },
  )

  it('keeps ADMIN owner history/detail separate from management and never exposes actions after foreign-reservation 403', async () => {
    const api = adminManagementApi(true)
    open()
    await login()
    await openInventory()
    fireEvent.click(screen.getByRole('link', { name: '내 예약으로 이동' }))
    fireEvent.click(await screen.findByRole('link', { name: '예약 42 상세 보기' }))
    await screen.findByText('guest@example.com')
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(screen.getByRole('button', { name: '예약 일정 변경 준비' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '타인 예약 직접 접근' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('본인 예약만 조회할 수 있습니다.')
    expect(screen.queryByText('guest@example.com')).toBeNull()
    expect(screen.queryByRole('button', { name: '예약 일정 변경 준비' })).toBeNull()
    expect(screen.queryByRole('button', { name: '취소 정책 및 수수료 확인' })).toBeNull()
    expect(getRoleHint()).toBe('ADMIN')
    expect(writes(api)).toHaveLength(0)
    expect(api.fetch.mock.calls.some(([url]) => url.includes('/admin/'))).toBe(false)
    expect(api.unexpected).toEqual([])
  })

  it.each([401, 403, 'network'] as const)(
    'does not replay inventory writes after %s while navigating authenticated management',
    async (failure) => {
      const api = adminManagementApi(true)
      open()
      await login()
      await openInventory()
      api.failWrites(
        failure === 'network'
          ? 'network'
          : { status: failure, code: failure === 401 ? 'AUTH_001' : 'AUTH_002' },
      )
      inventorySubmit('2')
      if (failure === 401) {
        await screen.findByRole('heading', { name: '로그인' })
        expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
      } else {
        await screen.findByRole('region', {
          name: failure === 'network' ? '불명확한 저장 결과 확인' : '재고 저장 결과 재확인',
        })
        fireEvent.submit(form('날짜 재고 입력'))
        expect(getRoleHint()).toBe('ADMIN')
        if (failure === 403)
          expect(
            screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('AUTH_002')),
          ).toBe(true)
      }
      expect(writes(api)).toHaveLength(1)
      expect(api.fetch.mock.calls.some(([url]) => url.endsWith('/auth/reissue'))).toBe(false)
      expect(api.unexpected).toEqual([])
    },
  )

  it('requires email login again after full reload loses memory tokens and restores the selected range without fabricating ADMIN', async () => {
    const api = adminManagementApi(true)
    const first = open()
    await login()
    await openInventory()
    const deepPath = screen.getByTestId('location').textContent!
    first.unmount()
    act(() => clearAccessToken())
    const before = api.fetch.mock.calls.length
    open(deepPath)
    expect(screen.queryByRole('table')).toBeNull()
    expect(api.fetch).toHaveBeenCalledTimes(before)
    await login('재고 관리')
    await screen.findByRole('table')
    expect(screen.getByTestId('location').textContent).toBe(deepPath)
    expect(screen.queryByRole('form', { name: '날짜 재고 입력' })).toBeNull()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(writes(api)).toHaveLength(0)
    expect(api.unexpected).toEqual([])
  })
})
