import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { initTheme } from './lib/theme'
import App from './App.tsx'
import { AuthGate } from './components/auth/AuthGate'

// Before the first render, so the app never flashes the wrong theme.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthGate>
        <App />
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
)
