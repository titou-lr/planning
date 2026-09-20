import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@jarvis/design-system'
import './styles/work.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
