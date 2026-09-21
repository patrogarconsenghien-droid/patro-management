import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './auth/AuthGate.jsx'
import PayPage from './PayPage.jsx'
import { payTokenFromPath } from './lib/payLink'
import './index.css'

// Un lien de paiement s'ouvre sans compte : le client n'a que son jeton.
const payToken = payTokenFromPath(window.location.pathname)

// Le reste de l'app n'est monté qu'une fois la personne connectée avec un
// compte validé.
ReactDOM.createRoot(document.getElementById('root')).render(
    payToken
        ? <PayPage token={payToken} />
        : (
            <AuthGate>
                <App />
            </AuthGate>
        )
)
