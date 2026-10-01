import { Navigate, Outlet, useLocation } from 'react-router'
import { routePaths } from '../app/routePaths'
import { LoadingState } from '../components/ui/LoadingState'
import { useAuth } from '../state/useAuth'
import type { UserRole } from '../state/accessToken'
import { ForbiddenPage } from '../pages/ForbiddenPage'

export function ProtectedRoute({ roles }: { roles?: readonly UserRole[] }) {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <LoadingState message="인증 상태를 확인하고 있습니다." />
  if (state.status !== 'authenticated') {
    return (
      <Navigate
        to={routePaths.login}
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    )
  }
  if (roles && (state.role === null || !roles.includes(state.role))) return <ForbiddenPage />
  return <Outlet />
}
