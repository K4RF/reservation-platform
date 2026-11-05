import { AdminPageHeading } from '../../components/admin/AdminPageHeading'
import {
  AdminBreadcrumb,
  AdminDirectId,
  AdminRoomTarget,
} from '../../components/admin/AdminContext'
import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getRoom } from '../../api/room'
import {
  createRoomInventory,
  getRoomInventoryCalendar,
  updateRoomInventory,
} from '../../api/adminInventory'
import type { RoomInventoryCalendarResponse } from '../../api/adminInventory'
import { ApiError } from '../../api/errors'
import { InventoryForm } from '../../components/admin/InventoryForm'
import { inventoryCalendarDates } from '../../components/admin/inventoryValidation'
import { AdminMutationFeedback } from '../../components/admin/AdminMutationFeedback'
import { adminErrorMessage, useAdminMutation } from '../../components/admin/useAdminMutation'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAuth } from '../../state/useAuth'
import { getSessionVersion } from '../../state/accessToken'
import { useDetailQuery } from '../useDetailQuery'
import { readAdminInventoryQuery } from './adminInventoryQuery'
import { adminDailyPricePath } from './adminDailyPriceQuery'

export function AdminInventoryPage() {
  const [params, setParams] = useSearchParams()
  useAuth()
  const query = readAdminInventoryQuery(params)
  return (
    <section aria-labelledby="admin-inventories-heading">
      <AdminBreadcrumb
        items={[
          { label: '객실 관리에서 선택', to: '/admin/rooms' },
          ...(query?.roomId ? [{ label: `객실 #${query.roomId}` }] : []),
          { label: '재고' },
        ]}
      />
      <AdminPageHeading
        id="admin-inventories-heading"
        title="재고 관리"
        context="날짜 범위 조회 · 단일 날짜 입력"
      />
      <form
        key={`${params.get('roomId')}-${params.get('startDate')}-${params.get('endDate')}`}
        className="admin-form admin-query-form"
        aria-label="재고 조회 대상 선택"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget),
            next = new URLSearchParams()
          for (const key of ['roomId', 'startDate', 'endDate']) {
            const value = String(data.get(key) ?? '').trim()
            if (value) next.set(key, value)
          }
          setParams(next)
        }}
      >
        <AdminDirectId selected={!!query?.roomId}>
          <div className="form-field">
            <label htmlFor="inventory-room-id">재고 관리 객실 ID</label>
            <input
              id="inventory-room-id"
              name="roomId"
              inputMode="numeric"
              required={!query?.roomId}
              defaultValue={params.get('roomId') ?? ''}
            />
          </div>
        </AdminDirectId>
        {(['startDate', 'endDate'] as const).map((key) => (
          <div className="form-field" key={key}>
            <label htmlFor={`inventory-${key}`}>
              {key === 'startDate' ? '재고 조회 시작일' : '재고 조회 종료일'}
            </label>
            <input
              id={`inventory-${key}`}
              name={key}
              type="date"
              required
              min="0001-01-01"
              max="9999-12-31"
              defaultValue={params.get(key) ?? ''}
            />
          </div>
        ))}
        <button type="submit">재고 Calendar 조회</button>
      </form>
      {!query ? (
        <ErrorState message="객실 ID 또는 날짜 범위를 확인해 주세요. 시작일 ≤ 종료일, 최대 366일이어야 합니다." />
      ) : query.roomId === null || !query.startDate || !query.endDate ? (
        <p>객실 ID와 날짜 범위를 선택해 주세요. 아직 재고를 조회하지 않았습니다.</p>
      ) : (
        <InventoryManager
          key={`${query.roomId}-${query.startDate}-${query.endDate}-${getSessionVersion()}`}
          roomId={query.roomId}
          startDate={query.startDate}
          endDate={query.endDate}
        />
      )}
    </section>
  )
}

function InventoryManager({
  roomId,
  startDate,
  endDate,
}: {
  roomId: number
  startDate: string
  endDate: string
}) {
  const mutation = useAdminMutation()
  const [selectedDate, setSelectedDate] = useState('')
  const editHeading = useRef<HTMLHeadingElement>(null)
  const selectedDateButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (selectedDate) editHeading.current?.focus()
  }, [selectedDate])
  const [writeCalendar, setWriteCalendar] = useState<RoomInventoryCalendarResponse>()
  const load = useCallback(
    async (signal: AbortSignal) => {
      const room = await getRoom(roomId, signal)
      const calendar = await getRoomInventoryCalendar(roomId, startDate, endDate, signal)
      return { room, calendar }
    },
    [roomId, startDate, endDate],
  )
  const { state, retry } = useDetailQuery(load)
  const failed = mutation.error !== undefined
  const freshRead = state.status === 'success' && state.data.calendar !== writeCalendar
  return (
    <>
      <AdminMutationFeedback
        mutation={mutation}
        reviewControls={false}
        reviewLink={{ to: `/admin/rooms/${roomId}`, label: '객실 관리 대상 확인' }}
        reviewMessage="아래 Calendar를 새로 조회하고 재고 수량과 판매 상태를 확인해 주세요."
      />
      <button disabled={mutation.pending} onClick={retry}>
        재고 Calendar 새로 조회
      </button>
      {failed && (
        <p role="alert">
          {mutation.error instanceof ApiError && mutation.error.code === 'INVENTORY_011'
            ? '동시 수정 충돌(INVENTORY_011)이 발생했습니다. '
            : ''}
          최신 Calendar 조회와 사용자 재확인 전에는 새 재고 요청을 보낼 수 없습니다. 수량을
          브라우저에서 보정하거나 요청을 자동 재전송하지 않습니다.
        </p>
      )}
      {state.status === 'loading' && (
        <LoadingState message="객실과 재고 Calendar를 불러오고 있습니다." />
      )}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <AdminRoomTarget
            room={state.data.room}
            label="재고 관리 대상 객실"
            linkLabel="객실 관리 상세"
          >
            <Link className="nav-link" to={adminDailyPricePath(roomId, selectedDate || undefined)}>
              이 객실 가격
            </Link>
          </AdminRoomTarget>
          {state.data.room.status === 'INACTIVE' && (
            <p role="status">
              INACTIVE 객실은 재고 조회만 가능합니다. 생성·수정은 서버에서도 거절됩니다.
            </p>
          )}
          <div className="admin-inventory-work">
            <section aria-label="재고 조회">
              <InventoryCalendar
                calendar={state.data.calendar}
                selectedDate={selectedDate}
                selectedButton={selectedDateButton}
                onSelect={(date) => {
                  if (date === selectedDate) editHeading.current?.focus()
                  else setSelectedDate(date)
                }}
                disabled={mutation.pending}
              />
            </section>
            <section className="admin-inventory-edit" aria-label="재고 편집">
              {selectedDate && (
                <div className="admin-list-toolbar">
                  <h3 ref={editHeading} tabIndex={-1}>
                    {selectedDate} 편집
                  </h3>
                  <button
                    type="button"
                    disabled={mutation.pending}
                    onClick={() => selectedDateButton.current?.focus()}
                  >
                    선택한 날짜로 돌아가기
                  </button>
                </div>
              )}
              {failed && (
                <InventoryRecovery
                  key={freshRead ? 'fresh' : 'stale'}
                  allowed={freshRead}
                  onReview={mutation.resetAfterReview}
                />
              )}
              {selectedDate ? (
                <InventoryForm
                  key={`${selectedDate}-${state.data.calendar.inventories.find((row) => row.inventoryDate === selectedDate)?.inventoryId ?? 'new'}-${failed}`}
                  roomId={roomId}
                  date={selectedDate}
                  inventory={state.data.calendar.inventories.find(
                    (row) => row.inventoryDate === selectedDate,
                  )}
                  disabled={mutation.disabled || failed || state.data.room.status !== 'ACTIVE'}
                  onSave={(totalQuantity, saleStatus) => {
                    if (mutation.disabled || failed || state.data.room.status !== 'ACTIVE') return
                    const existing = state.data.calendar.inventories.some(
                      (row) => row.inventoryDate === selectedDate,
                    )
                    setWriteCalendar(state.data.calendar)
                    void mutation.run(
                      (signal) =>
                        existing
                          ? updateRoomInventory(
                              roomId,
                              selectedDate,
                              { totalQuantity, saleStatus },
                              signal,
                            )
                          : createRoomInventory(
                              roomId,
                              { inventoryDate: selectedDate, totalQuantity },
                              signal,
                            ),
                      retry,
                      '재고 저장 응답을 받았습니다. 최신 Calendar를 다시 조회합니다.',
                    )
                  }}
                />
              ) : (
                <p>Calendar에서 날짜를 선택하면 단일 날짜 재고를 생성하거나 수정할 수 있습니다.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}

function InventoryRecovery({ allowed, onReview }: { allowed: boolean; onReview: () => void }) {
  const [reviewed, setReviewed] = useState(false)
  return (
    <section className="admin-recovery-panel" aria-label="재고 저장 결과 재확인">
      <p>
        {allowed
          ? '새 Calendar를 조회했습니다. 변경된 수량과 상태를 확인하세요.'
          : '먼저 재고 Calendar 새로 조회 버튼으로 최신 데이터를 받아야 합니다.'}
      </p>
      <label className="admin-check">
        <input
          type="checkbox"
          disabled={!allowed}
          checked={reviewed}
          onChange={(event) => setReviewed(event.target.checked)}
        />
        최신 Calendar의 재고 수량과 판매 상태를 확인했습니다.
      </label>
      <button disabled={!allowed || !reviewed} onClick={onReview}>
        확인 후 새 재고 요청 준비
      </button>
    </section>
  )
}

function InventoryCalendar({
  calendar,
  selectedDate,
  selectedButton,
  onSelect,
  disabled,
}: {
  calendar: RoomInventoryCalendarResponse
  selectedDate: string
  selectedButton: Ref<HTMLButtonElement>
  onSelect: (date: string) => void
  disabled: boolean
}) {
  const rows = new Map(calendar.inventories.map((row) => [row.inventoryDate, row]))
  return (
    <>
      <p id="inventory-calendar-help" className="admin-calendar-help">
        날짜 버튼을 선택해 입력합니다. 좁은 화면에서는 표를 가로로 스크롤하세요. 예약·가용 수량은
        읽기 전용이며, 미생성은 0이나 CLOSED를 뜻하지 않습니다.
      </p>
      <div
        className="inventory-calendar"
        tabIndex={0}
        role="region"
        aria-label="날짜별 재고 Calendar"
        aria-describedby="inventory-calendar-help"
      >
        <table className="booking-price-table">
          <caption>
            {calendar.startDate} ~ {calendar.endDate} (양 끝 날짜 포함)
          </caption>
          <thead>
            <tr>
              <th scope="col">날짜 선택</th>
              <th scope="col">총수량</th>
              <th scope="col">
                예약 수량 <span className="admin-column-note">읽기 전용</span>
              </th>
              <th scope="col">
                가용 수량 <span className="admin-column-note">읽기 전용</span>
              </th>
              <th scope="col">판매 상태</th>
            </tr>
          </thead>
          <tbody>
            {inventoryCalendarDates(calendar.startDate, calendar.endDate)!.map((date) => {
              const row = rows.get(date)
              return (
                <tr
                  key={date}
                  className={selectedDate === date ? 'inventory-date-selected' : undefined}
                >
                  <th scope="row">
                    <button
                      ref={selectedDate === date ? selectedButton : undefined}
                      disabled={disabled}
                      aria-pressed={selectedDate === date}
                      onClick={() => onSelect(date)}
                    >
                      {date}
                    </button>
                  </th>
                  {row ? (
                    <>
                      <td>{row.totalQuantity}</td>
                      <td>{row.reservedQuantity}</td>
                      <td>{row.availableQuantity}</td>
                      <td>
                        <span className="admin-status-badge" data-status={row.saleStatus}>
                          {row.saleStatus}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className="inventory-uncreated" colSpan={4}>
                      미생성 (수량·상태 미정)
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
