import { AdminPageHeading } from '../../components/admin/AdminPageHeading'
import { AdminBreadcrumb } from '../../components/admin/AdminContext'
import { AdminPanels } from '../../components/admin/AdminPanels'
import { useCallback, useState } from 'react'
import { MediaManager } from '../../components/admin/MediaManager'
import { Link, useNavigate, useParams } from 'react-router'
import { getAccommodation } from '../../api/accommodation'
import { changeAccommodationStatus, saveAccommodation } from '../../api/adminAccommodation'
import { AccommodationForm } from '../../components/admin/AccommodationForm'
import { AccommodationPolicyForm } from '../../components/admin/AccommodationPolicyForm'
import { CatalogStatusForm } from '../../components/admin/CatalogStatusForm'
import { readPositiveId } from '../../components/admin/roomValidation'
import { AdminMutationFeedback } from '../../components/admin/AdminMutationFeedback'
import { adminErrorMessage, useAdminMutation } from '../../components/admin/useAdminMutation'
import type { AdminMutation } from '../../components/admin/useAdminMutation'
import {
  amenityLabels,
  toAccommodationCard,
} from '../../components/accommodation/accommodationView'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { getSessionVersion } from '../../state/accessToken'
import { useAuth } from '../../state/useAuth'
import { useDetailQuery } from '../useDetailQuery'
import { adminRoomListPath } from './adminRoomQuery'

export function AdminAccommodationEditorPage({ create = false }: { create?: boolean }) {
  const { accommodationId } = useParams()
  useAuth()
  const id = create ? null : readPositiveId(accommodationId)
  if (!create && id === null)
    return (
      <>
        <h2>숙소 관리</h2>
        <ErrorState message="올바르지 않은 숙소 ID입니다." />
        <Link to="/admin/accommodations">관리 목록으로</Link>
      </>
    )
  return <AccommodationEditor key={`${id}-${getSessionVersion()}`} id={id} />
}
function AccommodationEditor({ id }: { id: number | null }) {
  const mutation = useAdminMutation()
  const [mediaBlocked, setMediaBlocked] = useState(false)
  const navigate = useNavigate()
  return (
    <section aria-label="숙소 관리 편집">
      <AdminBreadcrumb
        items={[
          { label: '관리 목록으로', to: '/admin/accommodations' },
          { label: id === null ? '새 숙소' : `숙소 #${id}` },
        ]}
      />
      <AdminPageHeading
        title={id === null ? '숙소 생성' : `숙소 관리 #${id}`}
        context="카탈로그 · 숙소"
      />
      <AdminMutationFeedback mutation={mutation} reviewControls={!mediaBlocked} />
      {id === null ? (
        <AccommodationForm
          disabled={mutation.disabled}
          onSave={(body) => {
            void mutation.run(
              (signal) => saveAccommodation(null, body, signal),
              (result) => {
                navigate(`/admin/accommodations/${result.accommodationId}`, { replace: true })
              },
              '숙소를 생성했습니다.',
            )
          }}
        />
      ) : (
        <AccommodationDetail
          id={id}
          mutation={mutation}
          mediaBlocked={mediaBlocked}
          setMediaBlocked={setMediaBlocked}
        />
      )}
    </section>
  )
}
function AccommodationDetail({
  id,
  mutation,
  mediaBlocked,
  setMediaBlocked,
}: {
  id: number
  mutation: AdminMutation
  mediaBlocked: boolean
  setMediaBlocked: (value: boolean) => void
}) {
  const load = useCallback((signal: AbortSignal) => getAccommodation(id, signal), [id])
  const { state, retry } = useDetailQuery(load)
  const data = state.status === 'success' ? state.data : undefined
  const disabled = mutation.disabled || mediaBlocked
  return (
    <>
      {data && (
        <section className="admin-record-bar" aria-label="선택한 숙소">
          <div>
            <strong>{data.name}</strong>{' '}
            <span className="admin-status-badge" data-status={data.status}>
              {toAccommodationCard(data).status}
            </span>
          </div>
          <div className="action-group">
            <Link className="nav-link" to={adminRoomListPath(id)}>
              이 숙소의 객실 관리
            </Link>
            <button disabled={mutation.pending || mediaBlocked} onClick={retry}>
              숙소 상세 새로 조회
            </button>
          </div>
        </section>
      )}
      {state.status === 'loading' && <LoadingState message="관리 숙소 상세를 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      <AdminPanels
        locked={disabled || !data}
        panels={[
          {
            id: 'overview',
            label: '숙소 요약',
            content: data && (
              <section className="admin-read-panel" aria-label="현재 숙소 정보">
                <p className="admin-panel-label">읽기 전용 · 직전 서버 조회</p>
                <h3>{data.name}</h3>
                <p>{data.description}</p>
                <dl className="admin-facts">
                  {(
                    [
                      'country',
                      'city',
                      'region',
                      'address',
                      'checkInTime',
                      'checkOutTime',
                      'timeZone',
                    ] as const
                  ).map((field, index) => (
                    <div key={field}>
                      <dt>
                        {
                          [
                            '국가',
                            '도시',
                            '지역',
                            '상세 주소',
                            '체크인 시간',
                            '체크아웃 시간',
                            '시간대',
                          ][index]
                        }
                      </dt>
                      <dd>{data[field] ?? '미등록'}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>편의시설</dt>
                    <dd>
                      {data.amenities.map((value) => amenityLabels[value]).join(', ') || '없음'}
                    </dd>
                  </div>
                </dl>
              </section>
            ),
          },
          {
            id: 'edit',
            label: '정보 편집',
            content: data && (
              <AccommodationForm
                initial={data}
                disabled={disabled}
                onSave={(body) => {
                  void mutation.run(
                    (signal) => saveAccommodation(id, body, signal),
                    retry,
                    '숙소 정보를 저장했습니다. 최신 상세를 다시 조회합니다.',
                  )
                }}
              />
            ),
          },
          {
            id: 'status',
            label: '운영 상태',
            content: data && (
              <CatalogStatusForm
                resource="accommodation"
                currentStatus={data.status}
                disabled={disabled}
                onSave={(status) => {
                  void mutation.run(
                    (signal) => changeAccommodationStatus(id, status, signal),
                    retry,
                    '운영 상태를 저장했습니다. 최신 상세를 다시 조회합니다.',
                  )
                }}
              />
            ),
          },
          {
            id: 'booking',
            label: '예약 정책 편집',
            shortLabel: '예약 정책',
            content: data && (
              <AccommodationPolicyForm
                id={id}
                kind="booking"
                mutation={{ ...mutation, disabled }}
              />
            ),
          },
          {
            id: 'cancellation',
            label: '취소 정책 편집',
            shortLabel: '취소 정책',
            content: data && (
              <AccommodationPolicyForm
                id={id}
                kind="cancellation"
                mutation={{ ...mutation, disabled }}
              />
            ),
          },
          {
            id: 'photos',
            label: '사진 관리',
            content: (
              <MediaManager
                owner={{ type: 'ACCOMMODATION', id }}
                verified={state.status === 'success'}
                mutation={mutation}
                setBlocked={setMediaBlocked}
              />
            ),
          },
        ]}
      />
    </>
  )
}
