import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PrivyAppProvider } from './providers/PrivyAppProvider'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyAppProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyAppProvider>
  </StrictMode>,
)
