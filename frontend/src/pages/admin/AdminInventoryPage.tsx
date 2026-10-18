import { useCallback, useState } from 'react'
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
import { RoomCard } from '../../components/room/RoomCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAuth } from '../../state/useAuth'
import { getSessionVersion } from '../../state/accessToken'
import { useDetailQuery } from '../useDetailQuery'
import { readAdminInventoryQuery } from './adminInventoryQuery'

export function AdminInventoryPage() {
  const [params, setParams] = useSearchParams()
  useAuth()
  const query = readAdminInventoryQuery(params)
  return (
    <section aria-labelledby="admin-inventories-heading">
      <h2 id="admin-inventories-heading">재고 관리</h2>
      <p>
        객실의 날짜별 총수량과 OPEN/CLOSED 판매 상태를 관리합니다. 예약·가용 수량은 서버 조회 값이며
        수정하지 않습니다.
      </p>
      <p>
        시작일과 종료일을 모두 포함합니다. 최대 366일은 화면 표시 보호용 제한이며 Backend 예약
        정책이 아닙니다. 일괄 설정·삭제는 제공하지 않습니다.
      </p>
      <Link to="/admin/rooms">객실 관리에서 선택</Link>
      <form
        key={`${params.get('roomId')}-${params.get('startDate')}-${params.get('endDate')}`}
        className="admin-form"
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
        <div className="form-field">
          <label htmlFor="inventory-room-id">재고 관리 객실 ID</label>
          <input
            id="inventory-room-id"
            name="roomId"
            inputMode="numeric"
            required
            defaultValue={params.get('roomId') ?? ''}
          />
        </div>
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
      <p>
        저장 중 대상 변경·화면 이동·요청 중단은 서버 Rollback을 의미하지 않습니다. 새 요청 전에 저장
        결과를 확인하세요.
      </p>
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
          <section aria-label="재고 관리 대상 객실">
            <RoomCard room={state.data.room} />
            <p>
              객실 ID {roomId} · 숙소 ID {state.data.room.accommodationId}
            </p>
            <Link to={`/admin/rooms/${roomId}?accommodationId=${state.data.room.accommodationId}`}>
              객실 관리 상세
            </Link>
            {state.data.room.status === 'INACTIVE' && (
              <p role="status">
                INACTIVE 객실은 재고 조회만 가능합니다. 생성·수정은 서버에서도 거절됩니다.
              </p>
            )}
          </section>
          <InventoryCalendar
            calendar={state.data.calendar}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            disabled={mutation.pending}
          />
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
        </>
      )}
    </>
  )
}

function InventoryRecovery({ allowed, onReview }: { allowed: boolean; onReview: () => void }) {
  const [reviewed, setReviewed] = useState(false)
  return (
    <section aria-label="재고 저장 결과 재확인">
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
  onSelect,
  disabled,
}: {
  calendar: RoomInventoryCalendarResponse
  selectedDate: string
  onSelect: (date: string) => void
  disabled: boolean
}) {
  const rows = new Map(calendar.inventories.map((row) => [row.inventoryDate, row]))
  return (
    <div
      className="inventory-calendar"
      tabIndex={0}
      role="region"
      aria-label="날짜별 재고 Calendar"
    >
      <table className="booking-price-table">
        <caption>
          {calendar.startDate} ~ {calendar.endDate} (양 끝 날짜 포함)
        </caption>
        <thead>
          <tr>
            <th scope="col">날짜 선택</th>
            <th scope="col">총수량</th>
            <th scope="col">예약 수량</th>
            <th scope="col">가용 수량</th>
            <th scope="col">판매 상태</th>
          </tr>
        </thead>
        <tbody>
          {inventoryCalendarDates(calendar.startDate, calendar.endDate)!.map((date) => {
            const row = rows.get(date)
            return (
              <tr key={date}>
                <th scope="row">
                  <button
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
                    <td>{row.saleStatus}</td>
                  </>
                ) : (
                  <td colSpan={4}>미생성 (수량·상태 미정)</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
