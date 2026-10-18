import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/errors'
import { getSessionVersion } from '../../state/accessToken'

export function adminErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '요청 결과를 확인할 수 없습니다.'
  const guidance =
    error.status === 401
      ? '다시 로그인해 주세요.'
      : error.status === 403
        ? '서버가 관리자 권한을 거절했습니다.'
        : error.status === 404
          ? '요청한 숙소·객실·가격 또는 정책이 존재하지 않습니다.'
          : error.status === 409
            ? '이미 존재하거나 현재 상태와 충돌합니다. 선택한 작업을 확인해 주세요.'
            : ''
  return `${error.message}${error.code ? ` (${error.code})` : ''} ${guidance}`.trim()
}

// One shared gate for all writes on the current management page.
export function useAdminMutation() {
  const [state, setState] = useState<{
    pending: boolean
    uncertain: boolean
    error?: unknown
    success?: string
  }>({ pending: false, uncertain: false })
  const gate = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])

  async function run<T>(
    action: (signal: AbortSignal) => Promise<T>,
    onSuccess: (data: T) => void,
    message: string,
  ) {
    if (gate.current || !lifetime.current || lifetime.current.signal.aborted) return
    gate.current = true
    const signal = lifetime.current.signal
    const version = getSessionVersion()
    const current = () => !signal.aborted && version === getSessionVersion()
    setState({ pending: true, uncertain: false })
    try {
      const data = await action(signal)
      if (!current()) return
      setState({ pending: false, uncertain: false, success: message })
      gate.current = false
      onSuccess(data)
    } catch (error) {
      if (!current()) return
      const uncertain =
        !(error instanceof ApiError) ||
        error.kind !== 'http' ||
        error.status === undefined ||
        error.status >= 500
      gate.current = uncertain
      setState({ pending: false, uncertain, error })
    }
  }
  function resetAfterReview() {
    if (state.pending) return
    gate.current = false
    setState({ pending: false, uncertain: false })
  }
  return { ...state, disabled: state.pending || state.uncertain, run, resetAfterReview }
}
export type AdminMutation = ReturnType<typeof useAdminMutation>
