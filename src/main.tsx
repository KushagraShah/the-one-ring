import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './auth'
import { App } from './app/App'
import { AppDialogProvider } from './AppDialog'
import './style.css'

createRoot(document.getElementById('root')!).render(<React.StrictMode><AppDialogProvider><AuthGate>{(identity, signOut) => <App key={identity.id} identity={identity} signOut={signOut}/>}</AuthGate></AppDialogProvider></React.StrictMode>)
