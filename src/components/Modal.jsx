import React from 'react';
import { X } from 'lucide-react';

/**
 * Fenêtre modale : feuille qui monte du bas sur téléphone, carte centrée sur
 * grand écran. Le fond ne ferme pas la fenêtre, pour ne pas perdre une saisie
 * sur un geste involontaire — comme avant.
 */
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="relative bg-white w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-xl animate-sheet"
      >
        <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden="true" />

        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 flex-shrink-0">
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 flex-none grid place-items-center rounded-full bg-gray-100 active:scale-90 transition-transform"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
