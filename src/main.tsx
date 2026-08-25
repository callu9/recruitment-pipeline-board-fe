import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { worker } from './mocks/browser'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

void worker.start({ onUnhandledRequest: 'bypass' }).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})
