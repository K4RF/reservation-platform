import { ApiError } from '../../api/errors'

export function reservationChangeFailure(error: unknown) {
  // A transport/response/5xx failure can occur after commit. Never infer rollback or replay.
  const uncertain =
    !(error instanceof ApiError) || error.kind !== 'http' || (error.status ?? 500) >= 500
  if (uncertain)
    return {
      uncertain: true,
      message:
        '변경 결과를 확인할 수 없습니다. 서버에서 이미 변경됐을 수 있으므로 다시 제출하지 마세요. 예약 상세를 다시 조회해 저장된 날짜와 금액을 확인해 주세요.',
    }
  const message = {
    bad_request: '날짜 및 예약 정책 조건을 확인해 주세요.',
    unauthorized: '로그인이 필요합니다. 다시 로그인한 뒤 예약 상세를 확인해 주세요.',
    forbidden: '본인 예약만 변경할 수 있습니다. 변경 권한을 확인해 주세요.',
    not_found: '예약·객실 또는 날짜별 재고 정보를 찾을 수 없습니다.',
    conflict:
      '재고·예약 상태 또는 예약 정책 충돌로 변경하지 못했습니다. 조건과 예약 상세를 다시 확인해 주세요.',
    other: '서버가 변경 요청을 거절했습니다. 조건을 확인해 주세요.',
    server_error: '',
  }[error.category ?? 'other']
  return {
    uncertain: false,
    message: `${message}${error.code ? ` [${error.code}] ${error.message}` : ''}${error.fieldErrors.map((field) => ` ${field.field}: ${field.message}`).join('')}`,
  }
}
