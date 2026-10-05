import { Route, Routes } from 'react-router'
import { RootLayout } from '../layouts/RootLayout'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { OAuth2CallbackPage } from '../pages/OAuth2CallbackPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SignUpPage } from '../pages/SignUpPage'
import { routePaths } from './routePaths'
import { ProtectedRoute } from '../layouts/ProtectedRoute'
import { ProtectedAreaPage } from '../pages/ProtectedAreaPage'
import { AccommodationSearchPage } from '../pages/AccommodationSearchPage'
import { AccommodationDetailPage } from '../pages/AccommodationDetailPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={routePaths.home} element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path={routePaths.login} element={<LoginPage />} />
        <Route path={routePaths.oauth2Callback} element={<OAuth2CallbackPage />} />
        <Route path={routePaths.signup} element={<SignUpPage />} />
        <Route element={<ProtectedRoute roles={['USER', 'ADMIN']} />}>
          <Route path={routePaths.accommodations}>
            <Route index element={<AccommodationSearchPage />} />
            <Route path=":accommodationId" element={<AccommodationDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path={routePaths.reservations}>
            <Route index element={<ProtectedAreaPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path={routePaths.admin}>
            <Route index element={<ProtectedAreaPage admin />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
