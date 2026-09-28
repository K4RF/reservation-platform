import { Route, Routes } from 'react-router'
import { RootLayout } from '../layouts/RootLayout'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { routePaths } from './routePaths'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={routePaths.home} element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
