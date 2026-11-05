import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/errors'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { adminErrorMessage } from './useAdminMutation'
import type { AdminMutation } from './useAdminMutation'

export function AdminMutationFeedback({
  mutation,
  reviewLink,
  reviewMessage,
  reviewControls = true,
}: {
  mutation: AdminMutation
  reviewLink?: { to: string; label: string }
  reviewMessage?: string
  reviewControls?: boolean
}) {
  const [reviewed, setReviewed] = useState(false)
  const feedback = useRef<HTMLDivElement>(null)
  const { error, success } = mutation
  const hasResult = error !== undefined || !!success
  useEffect(() => {
    if (error !== undefined || success) feedback.current?.focus()
  }, [error, success])
  return (
    <div
      className="admin-mutation-feedback"
      ref={feedback}
      tabIndex={hasResult ? -1 : undefined}
      role={hasResult ? 'group' : undefined}
      aria-label={hasResult ? '관리 저장 결과' : undefined}
    >
      {mutation.pending && <LoadingState message="저장 중입니다. 중복 요청을 보내지 마세요." />}
      {mutation.success && (
        <p className="admin-save-success" role="status">
          {mutation.success}
        </p>
      )}
      {mutation.error !== undefined && (
        <>
          <ErrorState message={adminErrorMessage(mutation.error)} />
          {mutation.error instanceof ApiError && mutation.error.fieldErrors.length > 0 && (
            <ul aria-label="서버 입력 오류">
              {mutation.error.fieldErrors.map((error, index) => (
                <li key={index}>
                  {error.field}: {error.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {mutation.uncertain && (
        <section className="admin-recovery-panel" aria-label="불명확한 저장 결과 확인">
          <p role="alert">
            저장이 이미 반영되었을 수 있어 다시 저장할 수 없습니다.{' '}
            {reviewMessage ??
              '숙소는 목록·상세를 재조회하고, 조회 API가 없는 정책은 서버 기록 등으로 결과를 확인하세요.'}{' '}
            화면을 떠나거나 요청을 중단해도 서버의 저장이 취소되는 것은 아닙니다.
          </p>
          <Link to={reviewLink?.to ?? '/admin/accommodations'}>
            {reviewLink?.label ?? '숙소 목록에서 결과 확인'}
          </Link>
          {reviewControls && (
            <>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                저장 결과를 별도로 확인했으며 새 요청을 준비합니다.
              </label>
              <button
                type="button"
                disabled={!reviewed}
                onClick={() => {
                  setReviewed(false)
                  mutation.resetAfterReview()
                }}
              >
                확인 후 입력 잠금 해제
              </button>
            </>
          )}
        </section>
      )}
    </div>
  )
}
