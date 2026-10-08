import { ApiError } from '../../api/errors'

export function bookingFailure(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof ApiError && error.status === 503 && error.code === 'INVENTORY_013')
    return { message: `${error.message} 서비스 복구 후 직접 다시 시도하세요.`, retryable: true }
  if (!(error instanceof ApiError) || error.kind !== 'http' || (error.status ?? 500) >= 500)
    return {
      message:
        '예약 생성 여부를 확인할 수 없습니다. 자동 재전송하지 않습니다. 다시 예약하기 전에 서버의 내 예약 기록을 확인하세요.',
      retryable: false,
    }
  if (error.status === 401)
    return {
      message: '로그인이 만료되었습니다. 다시 로그인하고 예약 기록을 확인하세요.',
      retryable: false,
    }
  if (error.status === 403)
    return { message: '예약 권한이 없습니다. 계정과 접근 권한을 확인하세요.', retryable: false }
  const detail = error.fieldErrors.map((field) => `${field.field}: ${field.message}`).join(' / ')
  return {
    message: `${error.message}${detail ? ` (${detail})` : ''}${error.status === 409 ? ' 가용 객실을 다시 조회하거나 조건을 변경하세요.' : ''}`,
    retryable: [400, 404, 409].includes(error.status ?? 0),
  }
}
