export function LoadingState({ message = '불러오는 중입니다.' }: { message?: string }) {
  return <p role="status">{message}</p>
}
