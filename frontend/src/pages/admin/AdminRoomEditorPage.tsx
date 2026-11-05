import { AdminPageHeading } from '../../components/admin/AdminPageHeading'
import { AdminBreadcrumb } from '../../components/admin/AdminContext'
import { AdminPanels } from '../../components/admin/AdminPanels'
import { useCallback, useState } from 'react'
import { MediaManager } from '../../components/admin/MediaManager'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { getAccommodation } from '../../api/accommodation'
import { getRoom } from '../../api/room'
import { saveRoom, changeRoomStatus } from '../../api/adminRoom'
import { ApiError } from '../../api/errors'
import { RoomCard } from '../../components/room/RoomCard'
import { RoomForm } from '../../components/admin/RoomForm'
import { CatalogStatusForm } from '../../components/admin/CatalogStatusForm'
import { readPositiveId } from '../../components/admin/roomValidation'
import { AdminMutationFeedback } from '../../components/admin/AdminMutationFeedback'
import { adminErrorMessage, useAdminMutation } from '../../components/admin/useAdminMutation'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { getSessionVersion } from '../../state/accessToken'
import { useAuth } from '../../state/useAuth'
import { useDetailQuery } from '../useDetailQuery'
import { adminRoomListPath } from './adminRoomQuery'
import { adminDailyPricePath } from './adminDailyPriceQuery'
import { adminInventoryPath } from './adminInventoryQuery'

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
  const [mediaBlocked, setMediaBlocked] = useState(false)
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
  const data = state.status === 'success' ? state.data : undefined
  const disabled = mutation.disabled || mediaBlocked
  const form = data && (
    <RoomForm
      initial={data.room}
      disabled={disabled}
      onSave={(body) => {
        const ownerId = data.accommodation.accommodationId
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
  )
  return (
    <section aria-label="객실 관리 편집">
      <AdminBreadcrumb
        items={[
          ...(data
            ? [
                {
                  label: '대상 숙소 상세',
                  to: `/admin/accommodations/${data.accommodation.accommodationId}`,
                },
              ]
            : []),
          { label: '객실 관리 목록으로', to: listPath },
          { label: id === null ? '새 객실' : `객실 #${id}` },
        ]}
      />
      <AdminPageHeading
        title={id === null ? '객실 생성' : `객실 관리 #${id}`}
        context="숙소별 객실 · 기본 정보 및 운영 상태"
      />
      <AdminMutationFeedback
        mutation={mutation}
        reviewControls={!mediaBlocked}
        reviewLink={{ to: listPath, label: '객실 목록에서 결과 확인' }}
        reviewMessage="객실 목록·상세를 새로 조회해 저장 결과를 확인하세요. 확인 전 재제출하지 마세요."
      />
      {state.status === 'loading' && <LoadingState message="관리 객실 정보를 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {data && (
        <section className="admin-record-bar" aria-label="선택한 객실">
          <div>
            <strong>{data.room?.name ?? '새 객실'}</strong>
            {data.room && (
              <span className="admin-status-badge" data-status={data.room.status}>
                {data.room.status === 'ACTIVE' ? '운영 중' : '운영 중지'}
              </span>
            )}
            <p>
              대상 숙소: {data.accommodation.name} (ID {data.accommodation.accommodationId}) ·{' '}
              {data.accommodation.status}
            </p>
          </div>
          <button disabled={mutation.pending || mediaBlocked} onClick={retry}>
            {id === null ? '대상 숙소 새로 조회' : '객실 상세 새로 조회'}
          </button>
        </section>
      )}
      {id === null ? (
        form
      ) : (
        <AdminPanels
          locked={disabled || !data}
          panels={[
            {
              id: 'overview',
              label: '객실 요약',
              content: data?.room && (
                <section className="admin-context-panel" aria-label="현재 객실 정보">
                  <p className="admin-panel-label">읽기 전용 · 직전 서버 조회</p>
                  <RoomCard room={data.room} />
                  <div className="action-group">
                    <Link className="nav-link" to={adminDailyPricePath(data.room.roomId)}>
                      이 객실의 날짜별 가격 관리
                    </Link>
                    <Link className="nav-link" to={adminInventoryPath(data.room.roomId)}>
                      이 객실의 날짜별 재고 관리
                    </Link>
                  </div>
                </section>
              ),
            },
            { id: 'edit', label: '정보 편집', content: form },
            {
              id: 'status',
              label: '운영 상태',
              content: data?.room && (
                <CatalogStatusForm
                  resource="room"
                  currentStatus={data.room.status}
                  disabled={disabled}
                  onSave={(status) => {
                    const room = data.room!
                    void mutation.run(
                      (signal) =>
                        changeRoomStatus(room.accommodationId, room.roomId, status, signal),
                      retry,
                      '객실 운영 상태를 저장했습니다. 최신 상세를 다시 조회합니다.',
                    )
                  }}
                />
              ),
            },
            {
              id: 'photos',
              label: '사진 관리',
              content: (
                <MediaManager
                  owner={{ type: 'ROOM', id }}
                  verified={state.status === 'success' && !!state.data.room}
                  mutation={mutation}
                  setBlocked={setMediaBlocked}
                />
              ),
            },
          ]}
        />
      )}
    </section>
  )
}
