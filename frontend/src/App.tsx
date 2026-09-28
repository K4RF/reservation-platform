import { BrowserRouter } from 'react-router'
import { AppRoutes } from './app/routes'

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
