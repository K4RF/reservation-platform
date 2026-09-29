import { BrowserRouter } from 'react-router'
import { AppRoutes } from './app/routes'
import { AuthProvider } from './state/AuthProvider'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
