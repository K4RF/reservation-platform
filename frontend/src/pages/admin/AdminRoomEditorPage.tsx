import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { getAccommodation } from '../../api/accommodation'
import { getRoom } from '../../api/room'
import type { RoomResponse } from '../../api/room'
import { saveRoom, changeRoomStatus } from '../../api/adminRoom'
import { ApiError } from '../../api/errors'
import { RoomCard } from '../../components/room/RoomCard'
import { RoomForm } from '../../components/admin/RoomForm'
import { readPositiveId } from '../../components/admin/roomValidation'
import { AdminMutationFeedback } from '../../components/admin/AdminMutationFeedback'
import { adminErrorMessage, useAdminMutation } from '../../components/admin/useAdminMutation'
import type { AdminMutation } from '../../components/admin/useAdminMutation'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { getSessionVersion } from '../../state/accessToken'
import { useAuth } from '../../state/useAuth'
import { useDetailQuery } from '../useDetailQuery'
import { adminRoomListPath } from './adminRoomQuery'
import { adminDailyPricePath } from './adminDailyPriceQuery'

export function AdminRoomEditorPage({ create = false }: { create?: boolean }) {
  const { roomId } = useParams(),
    [params] = useSearchParams()
  useAuth()
  const id = create ? null : readPositiveId(roomId)
  const accommodationId = readPositiveId(params.get('accommodationId'))
  if (
    (!create && id === null) ||
    params.getAll('accommodationId').length > 1 ||
    ((create || params.has('accommodationId')) && accommodationId === null)
  ) {
    return (
      <>
        <h2>객실 관리</h2>
        <ErrorState message="객실 ID 또는 숙소 ID가 올바르지 않습니다. 생성에는 숙소 선택이 필요합니다." />
        <Link to="/admin/rooms">관리할 숙소 선택</Link>
      </>
    )
  }
  return (
    <RoomEditor
      key={`${id}-${accommodationId}-${getSessionVersion()}`}
      id={id}
      expectedAccommodationId={accommodationId}
    />
  )
}
function RoomEditor({
  id,
  expectedAccommodationId,
}: {
  id: number | null
  expectedAccommodationId: number | null
}) {
  const mutation = useAdminMutation(),
    navigate = useNavigate()
  const load = useCallback(
    async (signal: AbortSignal) => {
      const room = id === null ? undefined : await getRoom(id, signal)
      if (
        room &&
        expectedAccommodationId !== null &&
        room.accommodationId !== expectedAccommodationId
      )
        throw new ApiError(
          '선택한 숙소에 속한 객실이 아닙니다. 객실과 숙소 관계를 확인해 주세요.',
          { kind: 'unexpected_response' },
        )
      const accommodation = await getAccommodation(
        room?.accommodationId ?? expectedAccommodationId!,
        signal,
      )
      return { room, accommodation }
    },
    [id, expectedAccommodationId],
  )
  const { state, retry } = useDetailQuery(load)
  const accommodationId =
    state.status === 'success' ? state.data.accommodation.accommodationId : expectedAccommodationId
  const listPath = accommodationId === null ? '/admin/rooms' : adminRoomListPath(accommodationId)
  return (
    <section aria-label="객실 관리 편집">
      <h2>{id === null ? '객실 생성' : `객실 관리 #${id}`}</h2>
      <Link to={listPath}>객실 관리 목록으로</Link>
      <p>
        저장 요청은 자동 재전송하지 않습니다. 화면 이동·요청 중단은 서버 Rollback을 의미하지
        않습니다.
      </p>
      <AdminMutationFeedback
        mutation={mutation}
        reviewLink={{ to: listPath, label: '객실 목록에서 결과 확인' }}
        reviewMessage="객실 목록·상세를 새로 조회해 저장 결과를 확인하세요. 확인 전 재제출하지 마세요."
      />
      <button disabled={mutation.pending} onClick={retry}>
        {id === null ? '대상 숙소 새로 조회' : '객실 상세 새로 조회'}
      </button>
      {state.status === 'loading' && <LoadingState message="관리 객실 정보를 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <p>
            대상 숙소: {state.data.accommodation.name} (ID{' '}
            {state.data.accommodation.accommodationId}) · {state.data.accommodation.status}
          </p>
          <Link to={`/admin/accommodations/${state.data.accommodation.accommodationId}`}>
            대상 숙소 상세
          </Link>
          {state.data.room && (
            <section aria-label="현재 객실 정보">
              <RoomCard room={state.data.room} />
              <Link to={adminDailyPricePath(state.data.room.roomId)}>
                이 객실의 날짜별 가격 관리
              </Link>
            </section>
          )}
          <RoomForm
            initial={state.data.room}
            disabled={mutation.disabled}
            onSave={(body) => {
              const ownerId = state.data.accommodation.accommodationId
              void mutation.run(
                (signal) => saveRoom(ownerId, id, body, signal),
                (result) => {
                  if (id === null)
                    navigate(`/admin/rooms/${result.roomId}?accommodationId=${ownerId}`, {
                      replace: true,
                    })
                  else retry()
                },
                id === null
                  ? '객실을 생성했습니다.'
                  : '객실 정보를 저장했습니다. 최신 상세를 다시 조회합니다.',
              )
            }}
          />
          {state.data.room && (
            <RoomStatusForm room={state.data.room} mutation={mutation} onSuccess={retry} />
          )}
        </>
      )}
    </section>
  )
}
function RoomStatusForm({
  room,
  mutation,
  onSuccess,
}: {
  room: RoomResponse
  mutation: AdminMutation
  onSuccess: () => void
}) {
  const [status, setStatus] = useState<RoomResponse['status']>(
    room.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
  )
  const [confirmed, setConfirmed] = useState(false)
  return (
    <form
      className="admin-form"
      aria-label="객실 운영 상태 변경"
      onSubmit={(event) => {
        event.preventDefault()
        if (!confirmed || mutation.disabled) return
        setConfirmed(false)
        void mutation.run(
          (signal) => changeRoomStatus(room.accommodationId, room.roomId, status, signal),
          onSuccess,
          '객실 운영 상태를 저장했습니다. 최신 상세를 다시 조회합니다.',
        )
      }}
    >
      <fieldset disabled={mutation.disabled}>
        <legend>객실 운영 상태 변경</legend>
        <p>운영 중지는 삭제가 아니며 기존 예약 이력과 재고를 임의로 제거하지 않습니다.</p>
        <div className="form-field">
          <label htmlFor="admin-room-status">변경할 객실 상태</label>
          <select
            id="admin-room-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RoomResponse['status'])
              setConfirmed(false)
            }}
          >
            <option value="ACTIVE">운영 중 (ACTIVE)</option>
            <option value="INACTIVE">운영 중지 (INACTIVE)</option>
          </select>
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          객실 상태 변경을 확인했습니다.
        </label>
        <button type="submit" disabled={!confirmed}>
          객실 상태 저장
        </button>
      </fieldset>
    </form>
  )
}
