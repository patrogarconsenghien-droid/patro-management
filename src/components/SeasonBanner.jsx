import React from 'react';
import { History } from 'lucide-react';
import { seasonLabel } from '../lib/seasons';

/**
 * Bandeau affiché dès qu'on consulte une saison qui n'est pas celle en cours.
 * L'édition reste autorisée (il faut pouvoir ajouter une facture qui arrive en
 * retard), mais on ne doit jamais encaisser une tournée au bar en croyant être
 * sur la saison actuelle : il est rayé comme un ruban de chantier, et reste
 * collé sous l'en-tête.
 */
const SeasonBanner = ({ seasonId, onBackToActive }) => (
  <div className="season-archive mx-3 mb-2 flex items-center gap-3 rounded-2xl px-3 py-2 ring-[1.5px] ring-orange-500">
    <History size={18} className="flex-none text-orange-600" />
    <div className="min-w-0 flex-1">
      <p className="font-display font-bold text-sm leading-tight truncate">{seasonLabel(seasonId)}</p>
      <p className="text-xs text-gray-600 truncate">Archive · pas la saison en cours</p>
    </div>
    <button
      onClick={onBackToActive}
      className="flex-none px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold active:scale-95 transition-transform"
    >
      Revenir
    </button>
  </div>
);

export default SeasonBanner;
