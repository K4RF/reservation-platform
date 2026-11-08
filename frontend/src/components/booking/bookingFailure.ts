import { ApiError } from '../../api/errors'

export function bookingFailure(error: unknown): {
  message: string
  recovery: 'edit' | 'recheck' | 'verify'
} {
  // A lock failure can happen during release, after the reservation committed.
  if (!(error instanceof ApiError) || error.kind !== 'http' || (error.status ?? 500) >= 500)
    return {
      message:
        '예약 생성 여부를 확인할 수 없습니다. 자동 재전송하지 않습니다. 다시 예약하기 전에 서버의 내 예약 기록을 확인하세요.',
      recovery: 'verify',
    }
  if (error.status === 401)
    return {
      message: '로그인이 만료되었습니다. 다시 로그인하고 예약 기록을 확인하세요.',
      recovery: 'verify',
    }
  if (error.status === 403)
    return { message: '예약 권한이 없습니다. 계정과 접근 권한을 확인하세요.', recovery: 'verify' }
  const detail = error.fieldErrors.map((field) => `${field.field}: ${field.message}`).join(' / ')
  const recheck = error.status === 404 || error.status === 409
  return {
    message: `${error.message}${detail ? ` (${detail})` : ''}${recheck ? ' 가용 객실을 다시 조회한 뒤 선택하세요. 객실 선택으로 돌아가면 투숙객 입력은 지워집니다.' : ''}`,
    recovery: recheck ? 'recheck' : error.status === 400 ? 'edit' : 'verify',
  }
}
