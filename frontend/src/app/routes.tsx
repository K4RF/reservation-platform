import { Route, Routes } from 'react-router'
import { RootLayout } from '../layouts/RootLayout'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SignUpPage } from '../pages/SignUpPage'
import { routePaths } from './routePaths'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={routePaths.home} element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path={routePaths.login} element={<LoginPage />} />
        <Route path={routePaths.signup} element={<SignUpPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
