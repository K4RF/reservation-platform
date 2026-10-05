import { useEffect, useState } from 'react'
import { ApiError } from '../api/errors'

type QueryState<T> =
  { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; notFound: boolean }

// Caller supplies a stable callback. Responses belong only to that callback/retry.
export function useDetailQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    load: typeof load
    attempt: number
    state: QueryState<T>
  }>()
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setResult({ load, attempt, state: { status: 'success', data } })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            load,
            attempt,
            state: {
              status: 'error',
              notFound: error instanceof ApiError && error.category === 'not_found',
            },
          })
      },
    )
    return () => controller.abort()
  }, [load, attempt])
  const state: QueryState<T> =
    result?.load === load && result.attempt === attempt ? result.state : { status: 'loading' }
  return { state, retry: () => setAttempt((value) => value + 1) }
}
