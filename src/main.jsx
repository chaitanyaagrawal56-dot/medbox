import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
// existing imports and ReactDOM code remain…

// Add this import:
import { registerSW } from 'virtual:pwa-register'

// Call it after render:
registerSW({
  onNeedRefresh() {
    // New version available. You can show your own toast instead:
    if (confirm('A new version is available. Update now?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline.')
  }
})

