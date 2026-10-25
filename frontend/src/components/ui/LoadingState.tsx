export function LoadingState({ message = '불러오는 중입니다.' }: { message?: string }) {
  return (
    <p className="ui-state ui-loading" role="status" aria-atomic="true">
      {message}
    </p>
  )
}
