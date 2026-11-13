import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './i18n'
import './index.css'
import { initTheme } from './lib/theme'
import App from './App'
import { Toaster } from './components/ui/sonner'

// One quick retry instead of the default three with growing delays (about 7 s),
// so a stopped backend shows its error state fast.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
