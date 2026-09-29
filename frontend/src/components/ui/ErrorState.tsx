interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = '문제가 발생했습니다.', onRetry }: ErrorStateProps) {
  return (
    <div role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
