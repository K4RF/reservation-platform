import { Route, Routes } from 'react-router'
import { RootLayout } from '../layouts/RootLayout'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { OAuth2CallbackPage } from '../pages/OAuth2CallbackPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SignUpPage } from '../pages/SignUpPage'
import { routePaths } from './routePaths'
import { ProtectedRoute } from '../layouts/ProtectedRoute'
import { AdminLayout } from '../layouts/AdminLayout'
import { AdminHomePage } from '../pages/admin/AdminHomePage'
import { AdminSectionPage } from '../pages/admin/AdminSectionPage'
import { AdminNotFoundPage } from '../pages/admin/AdminNotFoundPage'
import { AdminAccommodationListPage } from '../pages/admin/AdminAccommodationListPage'
import { AdminAccommodationEditorPage } from '../pages/admin/AdminAccommodationEditorPage'
import { adminSections } from './adminSections'
import { AccommodationSearchPage } from '../pages/AccommodationSearchPage'
import { AccommodationDetailPage } from '../pages/AccommodationDetailPage'
import { BookingCompletePage } from '../pages/BookingCompletePage'
import { MyReservationsPage } from '../pages/MyReservationsPage'
import { ReservationDetailPage } from '../pages/ReservationDetailPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={routePaths.home} element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path={routePaths.login} element={<LoginPage />} />
        <Route path={routePaths.oauth2Callback} element={<OAuth2CallbackPage />} />
        <Route path={routePaths.signup} element={<SignUpPage />} />
        <Route path={routePaths.accommodations}>
          <Route index element={<AccommodationSearchPage />} />
          <Route path=":accommodationId" element={<AccommodationDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['USER', 'ADMIN']} />}>
          <Route path={routePaths.reservations}>
            <Route index element={<MyReservationsPage />} />
            <Route path=":reservationId" element={<ReservationDetailPage />} />
            <Route path=":reservationId/complete" element={<BookingCompletePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path={routePaths.admin} element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="accommodations" element={<AdminAccommodationListPage />} />
            <Route path="accommodations/new" element={<AdminAccommodationEditorPage create />} />
            <Route
              path="accommodations/:accommodationId"
              element={<AdminAccommodationEditorPage />}
            />
            {adminSections
              .filter((section) => section.path !== 'accommodations')
              .map((section) => (
                <Route
                  key={section.path}
                  path={section.path}
                  element={<AdminSectionPage section={section} />}
                />
              ))}
            <Route path="*" element={<AdminNotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
