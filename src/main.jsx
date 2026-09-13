import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './auth/AuthGate.jsx'
import './index.css'

// L'app n'est montée qu'une fois la personne connectée avec un compte validé.
ReactDOM.createRoot(document.getElementById('root')).render(
    <AuthGate>
        <App />
    </AuthGate>
)
