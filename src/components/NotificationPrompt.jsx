import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { isIos, isStandalone } from '../useNotifications';

const DISMISS_KEY = 'patro-notif-prompt-dismissed';

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Invite à activer les notifications, visible par tout le monde (elle était
 * cachée derrière le mot de passe des réglages). Explique aussi les deux cas
 * où le bouton ne suffit pas : l'iPhone, qui n'envoie des notifications qu'à
 * une app ajoutée à l'écran d'accueil, et les notifications déjà bloquées.
 */
export default function NotificationPrompt({ isSupported, permission, requestPermission }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  const needsInstall = isIos() && !isStandalone();

  if (dismissed || permission === 'granted') return null;
  if (!isSupported && !needsInstall) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Stockage indisponible : l'invite réapparaîtra à la prochaine ouverture.
    }
  };

  const activate = async () => {
    setBusy(true);
    const result = await requestPermission();
    setBusy(false);
    if (result === 'denied') {
      alert("Les notifications ont été refusées. Tu peux les réautoriser dans les réglages du site de ton navigateur.");
    }
  };

  let text;
  let action = null;

  if (needsInstall) {
    text = "Sur iPhone, les notifications ne marchent que dans l'app installée : touche Partager, puis « Sur l'écran d'accueil », et ouvre l'app depuis son icône.";
  } else if (permission === 'denied') {
    text = "Les notifications sont bloquées sur cet appareil. Autorise-les dans les réglages du site de ton navigateur, puis recharge la page.";
  } else {
    text = "Sois prévenu dès qu'un nouveau boulot est programmé.";
    action = (
      <button
        onClick={activate}
        disabled={busy}
        className="mt-3 w-full px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-60 active:scale-95 transition-transform"
      >
        {busy ? 'Activation…' : 'Activer les notifications'}
      </button>
    );
  }

  return (
    <div className="relative bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-4">
      <button
        onClick={dismiss}
        aria-label="Masquer"
        className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:bg-gray-100"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="flex-none w-9 h-9 rounded-xl grid place-items-center bg-blue-100 text-blue-600">
          <Bell size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-sm">Nouveaux boulots</p>
          <p className="text-sm text-gray-600 mt-0.5">{text}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
