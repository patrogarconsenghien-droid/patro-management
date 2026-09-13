import React from 'react';
import { ArrowLeft, WifiOff } from 'lucide-react';

/**
 * En-tête commun : retour à gauche, titre centré, état de connexion à droite.
 * Collé en haut sur fond translucide, pour garder le contexte en faisant
 * défiler une longue liste. Les `children` (bandeau de saison archivée) restent
 * collés avec lui.
 */
const Header = ({ title, onBack, loading, isOnline, children }) => (
  <header className="app-header sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md">
    <div className="flex items-center gap-3 px-4 py-3">
      {onBack ? (
        <button
          onClick={onBack}
          aria-label="Retour"
          className="w-10 h-10 flex-none grid place-items-center rounded-2xl bg-white shadow-sm active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
      ) : (
        <span className="w-10 flex-none" aria-hidden="true" />
      )}

      <h1 className="flex-1 min-w-0 text-center font-display text-xl font-extrabold tracking-tight truncate">
        {title}
      </h1>

      <div className="w-10 flex-none flex items-center justify-end gap-2">
        {loading && (
          <span
            className="w-4 h-4 rounded-full border-2 border-gray-900 border-t-transparent animate-spin"
            role="status"
            aria-label="Enregistrement en cours"
          />
        )}
        {isOnline ? (
          <span
            className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-500/20"
            title="En ligne"
          />
        ) : (
          <WifiOff size={16} className="text-red-500" aria-label="Hors ligne" />
        )}
      </div>
    </div>
    {children}
  </header>
);

export default Header;
