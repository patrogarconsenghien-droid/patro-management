import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signInWithGoogle, signOutUser } from '../firebase';
import { AccountContext } from './account';
import { useAccountState } from './useAccountState';

// Erreurs de connexion traduites. `null` : pas de message (la personne a
// simplement fermé la fenêtre Google).
const AUTH_ERRORS = {
  'auth/operation-not-allowed':
    "La connexion Google n'est pas encore activée pour l'app. Un admin doit l'activer dans Firebase.",
  'auth/unauthorized-domain':
    "Cette adresse n'est pas autorisée pour la connexion. Un admin doit l'ajouter dans Firebase.",
  'auth/network-request-failed':
    'Pas de connexion internet. Réessaie dès que le réseau revient.',
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/user-cancelled': null
};

const messageFor = (error) => {
  if (!error) return null;
  if (error.code in AUTH_ERRORS) return AUTH_ERRORS[error.code];
  return `Connexion impossible (${error.code || error.message}).`;
};

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/** Écran plein, centré, aux couleurs de l'app. */
const Screen = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div className="w-full max-w-sm">{children}</div>
  </div>
);

const Brand = ({ subtitle }) => (
  <div className="mb-8">
    <p className="text-sm text-gray-600">Gestion Patro</p>
    <h1 className="font-display text-4xl font-extrabold tracking-tight leading-tight mt-1">{subtitle}</h1>
  </div>
);

const SignOutButton = () => (
  <button
    onClick={signOutUser}
    className="w-full mt-3 p-3 rounded-2xl bg-white ring-1 ring-gray-200 text-gray-700 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
  >
    <LogOut size={18} />
    Se déconnecter
  </button>
);

/**
 * Point d'entrée de l'app : rien n'est affiché (ni chargé depuis Firestore)
 * tant que la personne n'est pas connectée avec un compte validé.
 */
export default function AuthGate({ children }) {
  const { status, user, profile, error } = useAccountState();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(null);

  const signIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setSignInError(caught);
    } finally {
      setSigningIn(false);
    }
  };

  if (status === 'loading') {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-4 text-gray-600" role="status">
          <span className="w-8 h-8 rounded-full border-[3px] border-gray-900 border-t-transparent animate-spin" />
          <span className="text-sm">Ouverture de l'app…</span>
        </div>
      </Screen>
    );
  }

  if (status === 'signed-out') {
    const message = messageFor(signInError || error);
    return (
      <Screen>
        <Brand subtitle="Connexion" />
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-5">
          <p className="text-sm text-gray-700">
            Réservé aux animés et animateurs du patro. Connecte-toi avec ton compte Google :
            un animateur validera ton accès.
          </p>
          <button
            onClick={signIn}
            disabled={signingIn}
            className="w-full mt-5 p-3.5 rounded-2xl bg-gray-900 text-gray-50 font-semibold flex items-center justify-center gap-3 disabled:opacity-60 active:scale-95 transition-transform"
          >
            <span className="w-7 h-7 rounded-full bg-white grid place-items-center">
              <GoogleMark />
            </span>
            {signingIn ? 'Connexion…' : 'Continuer avec Google'}
          </button>
          {message && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 rounded-xl p-3" role="alert">{message}</p>
          )}
        </div>
      </Screen>
    );
  }

  if (status === 'pending') {
    return (
      <Screen>
        <Brand subtitle="Compte en attente" />
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-5 space-y-3">
          <p className="text-sm text-gray-700">
            Ton compte <strong>{profile?.email || user?.email}</strong> est créé. Un animateur doit
            maintenant le valider et le relier à ton nom.
          </p>
          <p className="text-sm text-gray-500">
            Pas besoin de rester sur cet écran : l'app s'ouvrira d'elle-même dès que c'est fait.
          </p>
        </div>
        <SignOutButton />
      </Screen>
    );
  }

  if (status === 'rejected') {
    return (
      <Screen>
        <Brand subtitle="Accès non autorisé" />
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-5">
          <p className="text-sm text-gray-700">
            Le compte <strong>{profile?.email}</strong> n'est pas autorisé à utiliser cette app,
            réservée aux animés et animateurs du patro. Si tu penses que c'est une erreur,
            parles-en à un animateur.
          </p>
        </div>
        <SignOutButton />
      </Screen>
    );
  }

  if (status === 'disabled') {
    return (
      <Screen>
        <Brand subtitle="Compte désactivé" />
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-5">
          <p className="text-sm text-gray-700">
            Le compte <strong>{profile?.email}</strong> n'a plus accès à l'app. Parles-en à un animateur
            si c'est une erreur.
          </p>
        </div>
        <SignOutButton />
      </Screen>
    );
  }

  return (
    <AccountContext.Provider value={{ user, profile, signOut: signOutUser }}>
      {children}
    </AccountContext.Provider>
  );
}
