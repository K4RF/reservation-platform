import { ApiError } from '../../api/errors'

// A transport/response/5xx failure can happen after commit. Never infer rollback or replay.
export function isUncertainReservationFailure(error: unknown): boolean {
  return !(error instanceof ApiError) || error.kind !== 'http' || (error.status ?? 500) >= 500
}

export function reservationErrorDetails(error: unknown): string {
  if (!(error instanceof ApiError) || error.kind !== 'http') return ''
  return `${error.code ? ` [${error.code}]` : ''} ${error.message}${error.fieldErrors.map((field) => ` ${field.field}: ${field.message}`).join('')}`
}

export function reservationCancellationFailure(error: unknown): string {
  const uncertain = isUncertainReservationFailure(error)
  const message = uncertain
    ? '취소 결과를 확인할 수 없습니다. 서버에서 이미 취소됐을 수 있으므로 다시 제출하지 마세요. 예약 상세를 다시 조회해 상태와 저장 결과를 확인해 주세요.'
    : {
        bad_request: '요청 및 취소 정책 조건을 확인해 주세요.',
        unauthorized: '다시 로그인한 뒤 예약 상세를 확인해 주세요.',
        forbidden: '본인 예약만 취소할 수 있습니다.',
        not_found: '예약 또는 날짜별 재고 정보를 찾을 수 없습니다.',
        conflict:
          '이미 취소된 예약, 취소 마감 또는 재고 충돌로 요청이 거절됐습니다. 예약 상세를 다시 확인해 주세요.',
        other: '서버가 취소 요청을 거절했습니다.',
        server_error: '',
      }[(error as ApiError).category ?? 'other']
  return message + reservationErrorDetails(error)
}
