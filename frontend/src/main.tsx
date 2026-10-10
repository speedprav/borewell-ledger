import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Load runtime config before rendering
async function bootstrap() {
  try {
    const resp = await fetch('/config.json')
    if (resp.ok) {
      const config = await resp.json()
      window.__APP_CONFIG__ = config
    }
  } catch {
    window.__APP_CONFIG__ = { apiUrl: '/api', version: 'dev' }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()

// Extend window type
declare global {
  interface Window {
    __APP_CONFIG__: { apiUrl: string; version: string }
  }
}
