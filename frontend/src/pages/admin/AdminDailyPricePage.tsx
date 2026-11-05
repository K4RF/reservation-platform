import { AdminPageHeading } from '../../components/admin/AdminPageHeading'
import {
  AdminBreadcrumb,
  AdminDirectId,
  AdminRoomTarget,
} from '../../components/admin/AdminContext'
import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getRoom } from '../../api/room'
import { getEffectiveRoomPrice } from '../../api/bookingPrice'
import { createRoomDailyPrice, updateRoomDailyPrice } from '../../api/adminDailyPrice'
import { DailyPriceForm } from '../../components/admin/DailyPriceForm'
import { AdminMutationFeedback } from '../../components/admin/AdminMutationFeedback'
import { adminErrorMessage, useAdminMutation } from '../../components/admin/useAdminMutation'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'
import { useAuth } from '../../state/useAuth'
import { getSessionVersion } from '../../state/accessToken'
import { useDetailQuery } from '../useDetailQuery'
import { readAdminDailyPriceQuery } from './adminDailyPriceQuery'

export function AdminDailyPricePage() {
  const [params, setParams] = useSearchParams()
  useAuth()
  const query = readAdminDailyPriceQuery(params)
  return (
    <section aria-labelledby="admin-prices-heading">
      <AdminBreadcrumb
        items={[
          { label: '객실 관리에서 선택', to: '/admin/rooms' },
          ...(query?.roomId ? [{ label: `객실 #${query.roomId}` }] : []),
          { label: '가격' },
        ]}
      />
      <AdminPageHeading
        id="admin-prices-heading"
        title="가격 관리"
        context="단일 객실 · 단일 숙박일"
      />
      <form
        key={`${params.get('roomId')}-${params.get('stayDate')}`}
        className="admin-form admin-query-form"
        aria-label="가격 조회 대상 선택"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget),
            next = new URLSearchParams()
          const roomId = String(data.get('roomId') ?? '').trim(),
            stayDate = String(data.get('stayDate') ?? '')
          if (roomId) next.set('roomId', roomId)
          if (stayDate) next.set('stayDate', stayDate)
          setParams(next)
        }}
      >
        <AdminDirectId selected={!!query?.roomId}>
          <div className="form-field">
            <label htmlFor="price-room-id">가격 관리 객실 ID</label>
            <input
              id="price-room-id"
              name="roomId"
              inputMode="numeric"
              required={!query?.roomId}
              defaultValue={params.get('roomId') ?? ''}
            />
          </div>
        </AdminDirectId>
        <div className="form-field">
          <label htmlFor="price-stay-date">가격 관리 숙박 날짜</label>
          <input
            id="price-stay-date"
            name="stayDate"
            type="date"
            required
            min="0001-01-01"
            max="9999-12-31"
            defaultValue={params.get('stayDate') ?? ''}
          />
        </div>
        <button type="submit">적용 가격 조회</button>
      </form>
      {!query ? (
        <ErrorState message="객실 ID 또는 숙박 날짜가 올바르지 않습니다." />
      ) : query.roomId === null || !query.stayDate ? (
        <p>객실 ID와 숙박 날짜를 선택해 주세요. 아직 가격을 조회하지 않았습니다.</p>
      ) : (
        <DailyPriceManager
          key={`${query.roomId}-${query.stayDate}-${getSessionVersion()}`}
          roomId={query.roomId}
          stayDate={query.stayDate}
        />
      )}
    </section>
  )
}
function DailyPriceManager({ roomId, stayDate }: { roomId: number; stayDate: string }) {
  const mutation = useAdminMutation()
  const load = useCallback(
    async (signal: AbortSignal) => {
      const room = await getRoom(roomId, signal)
      const price = await getEffectiveRoomPrice(roomId, stayDate, signal)
      return { room, price }
    },
    [roomId, stayDate],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <>
      <AdminMutationFeedback
        mutation={mutation}
        reviewLink={{ to: `/admin/rooms/${roomId}`, label: '객실 상세에서 관리 대상 확인' }}
        reviewMessage="같은 객실·숙박 날짜의 적용 가격을 아래 새로 조회 버튼으로 확인하세요. 결과 확인 전 재제출하지 마세요."
      />
      <button disabled={mutation.pending} onClick={retry}>
        적용 가격 새로 조회
      </button>
      {state.status === 'loading' && (
        <LoadingState message="객실과 적용 가격을 불러오고 있습니다." />
      )}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <AdminRoomTarget
            room={state.data.room}
            label="가격 관리 대상 객실"
            linkLabel="객실 기본 가격 관리"
          >
            <Link
              className="nav-link"
              to={`/admin/inventories?roomId=${roomId}&startDate=${stayDate}&endDate=${stayDate}`}
            >
              같은 날짜 재고
            </Link>
          </AdminRoomTarget>
          <div className="admin-task-grid">
            <section className="admin-read-panel" aria-label="현재 적용 가격">
              <p className="admin-panel-label">읽기 전용 · 직전 서버 조회</p>
              <h3>서버 적용 가격</h3>
              <dl className="admin-key-values">
                <dt>숙박 날짜</dt>
                <dd>{state.data.price.stayDate}</dd>
                <dt>적용 1박 금액</dt>
                <dd className="admin-money">
                  {formatMinorUnits(toMinorUnits(state.data.price.nightlyPrice))}
                </dd>
                <dt>출처</dt>
                <dd>
                  <span className="admin-status-badge" data-status={state.data.price.source}>
                    {state.data.price.source}
                  </span>
                </dd>
                <dt>날짜별 가격 ID</dt>
                <dd>{state.data.price.roomDailyPriceId ?? '없음 (기본 가격 적용)'}</dd>
              </dl>
              {state.data.price.source === 'DEFAULT' ? (
                <p>날짜별 가격이 없어 객실 기본 가격을 적용합니다.</p>
              ) : (
                <p>이 날짜에 저장된 Override 가격입니다. 기본 가격과 별개입니다.</p>
              )}
            </section>
            <details className="admin-disclosure admin-price-edit">
              <summary>날짜별 가격 편집</summary>
              <p>새 가격은 이미 저장된 예약 금액을 바꾸지 않습니다.</p>
              <DailyPriceForm
                price={state.data.price}
                disabled={mutation.disabled}
                onSave={(nightlyPrice) => {
                  void mutation.run(
                    (signal) =>
                      state.data.price.source === 'DEFAULT'
                        ? createRoomDailyPrice(roomId, { stayDate, nightlyPrice }, signal)
                        : updateRoomDailyPrice(roomId, stayDate, { nightlyPrice }, signal),
                    retry,
                    '날짜별 가격 저장 응답을 받았습니다. 최신 적용 가격을 다시 조회합니다.',
                  )
                }}
              />
            </details>
          </div>
        </>
      )}
    </>
  )
}
