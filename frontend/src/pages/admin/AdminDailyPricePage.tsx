import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getRoom } from '../../api/room'
import { getEffectiveRoomPrice } from '../../api/bookingPrice'
import { createRoomDailyPrice, updateRoomDailyPrice } from '../../api/adminDailyPrice'
import { DailyPriceForm } from '../../components/admin/DailyPriceForm'
import { AdminMutationFeedback } from '../../components/admin/AdminMutationFeedback'
import { adminErrorMessage, useAdminMutation } from '../../components/admin/useAdminMutation'
import { RoomCard } from '../../components/room/RoomCard'
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
      <h2 id="admin-prices-heading">가격 관리</h2>
      <p>
        객실 하나와 숙박 날짜 하나의 적용 가격을 조회하고 날짜별 Override를 생성·수정합니다. 기간
        Calendar·일괄 설정·삭제·기본값 복원 기능은 제공하지 않습니다.
      </p>
      <p>
        기본 가격 수정은 객실 관리에서 수행합니다. 날짜별 가격 변경은 기존 예약 금액 Snapshot을
        바꾸지 않습니다. API에 통화 정보가 없어 통화 기호나 단위를 추측하지 않고 금액만 표시합니다.
      </p>
      <Link to="/admin/rooms">객실 관리에서 선택</Link>
      <form
        key={`${params.get('roomId')}-${params.get('stayDate')}`}
        className="admin-form"
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
        <div className="form-field">
          <label htmlFor="price-room-id">가격 관리 객실 ID</label>
          <input
            id="price-room-id"
            name="roomId"
            inputMode="numeric"
            required
            defaultValue={params.get('roomId') ?? ''}
          />
        </div>
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
      <p>
        저장 중 대상 변경·화면 이동·요청 중단은 서버 Rollback을 의미하지 않습니다. 새 요청 전에 저장
        결과를 확인하세요.
      </p>
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
          <section aria-label="가격 관리 대상 객실">
            <RoomCard room={state.data.room} />
            <p>
              객실 ID {roomId} · 숙소 ID {state.data.room.accommodationId}
            </p>
            <Link to={`/admin/rooms/${roomId}?accommodationId=${state.data.room.accommodationId}`}>
              객실 기본 가격 관리
            </Link>
          </section>
          <section aria-label="현재 적용 가격">
            <h3>서버 적용 가격</h3>
            <dl>
              <dt>숙박 날짜</dt>
              <dd>{state.data.price.stayDate}</dd>
              <dt>적용 1박 금액</dt>
              <dd>{formatMinorUnits(toMinorUnits(state.data.price.nightlyPrice))}</dd>
              <dt>출처</dt>
              <dd>{state.data.price.source}</dd>
              <dt>날짜별 가격 ID</dt>
              <dd>{state.data.price.roomDailyPriceId ?? '없음 (기본 가격 적용)'}</dd>
            </dl>
            {state.data.price.source === 'DEFAULT' ? (
              <p>
                이 날짜의 Override는 미등록입니다. 표시 금액은 서버가 결정한 기본 가격이며 가격
                누락이나 조회 오류가 아닙니다.
              </p>
            ) : (
              <p>이 날짜에 저장된 Override 가격입니다. 기본 가격과 별개입니다.</p>
            )}
          </section>
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
        </>
      )}
    </>
  )
}
