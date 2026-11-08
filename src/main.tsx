import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './auth'
import { App } from './app/App'
import './style.css'

createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate>{(identity, signOut) => <App key={identity.id} identity={identity} signOut={signOut}/>}</AuthGate></React.StrictMode>)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error => console.error('Offline shell registration failed:', error))
  })
}
