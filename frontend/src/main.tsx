import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster richColors position="top-center" duration={4000} />
    </ErrorBoundary>
  </StrictMode>,
)
