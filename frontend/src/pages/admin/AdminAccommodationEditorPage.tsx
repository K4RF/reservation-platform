import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getAccommodation } from '../../api/accommodation'
import type { AccommodationResponse, AccommodationStatus } from '../../api/accommodation'
import { changeAccommodationStatus, saveAccommodation } from '../../api/adminAccommodation'
import { AccommodationForm } from '../../components/admin/AccommodationForm'
import { AccommodationPolicyForm } from '../../components/admin/AccommodationPolicyForm'
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

export function AdminAccommodationEditorPage({ create = false }: { create?: boolean }) {
  const { accommodationId } = useParams()
  useAuth()
  const id = create ? null : Number(accommodationId)
  if (
    !create &&
    (!accommodationId ||
      !/^\d+$/.test(accommodationId) ||
      !Number.isSafeInteger(id) ||
      Number(id) < 1)
  )
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
  const navigate = useNavigate()
  return (
    <section aria-label="숙소 관리 편집">
      <h2>{id === null ? '숙소 생성' : `숙소 관리 #${id}`}</h2>
      <Link to="/admin/accommodations">관리 목록으로</Link>
      <p>저장 요청은 자동 재전송하지 않습니다. 서버가 권한·유효성·저장 결과를 최종 판단합니다.</p>
      <AdminMutationFeedback mutation={mutation} />
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
        <AccommodationDetail id={id} mutation={mutation} />
      )}
    </section>
  )
}
function AccommodationDetail({ id, mutation }: { id: number; mutation: AdminMutation }) {
  const load = useCallback((signal: AbortSignal) => getAccommodation(id, signal), [id])
  const { state, retry } = useDetailQuery(load)
  return (
    <>
      <button disabled={mutation.pending} onClick={retry}>
        숙소 상세 새로 조회
      </button>
      {state.status === 'loading' && <LoadingState message="관리 숙소 상세를 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <section aria-label="현재 숙소 정보">
            <h3>{state.data.name}</h3>
            <p>{state.data.description}</p>
            <p>{toAccommodationCard(state.data).status}</p>
            <dl>
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
                  <dd>{state.data[field] ?? '미등록'}</dd>
                </div>
              ))}
              <dt>편의시설</dt>
              <dd>
                {state.data.amenities.map((value) => amenityLabels[value]).join(', ') || '없음'}
              </dd>
            </dl>
          </section>
          <AccommodationForm
            initial={state.data}
            disabled={mutation.disabled}
            onSave={(body) => {
              void mutation.run(
                (signal) => saveAccommodation(id, body, signal),
                retry,
                '숙소 정보를 저장했습니다. 최신 상세를 다시 조회합니다.',
              )
            }}
          />
          <StatusForm row={state.data} mutation={mutation} onSuccess={retry} />
          <AccommodationPolicyForm id={id} kind="booking" mutation={mutation} />
          <AccommodationPolicyForm id={id} kind="cancellation" mutation={mutation} />
        </>
      )}
    </>
  )
}
function StatusForm({
  row,
  mutation,
  onSuccess,
}: {
  row: AccommodationResponse
  mutation: AdminMutation
  onSuccess: () => void
}) {
  const [status, setStatus] = useState<AccommodationStatus>(
    row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
  )
  const [confirmed, setConfirmed] = useState(false)
  return (
    <form
      className="admin-form"
      aria-label="숙소 운영 상태 변경"
      onSubmit={(event) => {
        event.preventDefault()
        if (!confirmed || mutation.disabled) return
        setConfirmed(false)
        void mutation.run(
          (signal) => changeAccommodationStatus(row.accommodationId, status, signal),
          onSuccess,
          '운영 상태를 저장했습니다. 최신 상세를 다시 조회합니다.',
        )
      }}
    >
      <fieldset disabled={mutation.disabled}>
        <legend>운영 상태 변경</legend>
        <p>삭제 대신 운영 상태만 변경합니다. 기존 예약을 삭제하지 않습니다.</p>
        <div className="form-field">
          <label htmlFor="accommodation-status">변경할 운영 상태</label>
          <select
            id="accommodation-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AccommodationStatus)
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
          운영 상태 변경을 확인했습니다.
        </label>
        <button type="submit" disabled={!confirmed}>
          운영 상태 저장
        </button>
      </fieldset>
    </form>
  )
}
