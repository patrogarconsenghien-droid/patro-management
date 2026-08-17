import React from 'react';
import { History } from 'lucide-react';
import { seasonLabel } from '../lib/seasons';

/**
 * Bandeau permanent affiché dès qu'on consulte une saison qui n'est pas celle
 * en cours. L'édition reste autorisée (il faut pouvoir ajouter une facture qui
 * arrive en retard), mais on ne doit jamais encaisser une tournée au bar en
 * croyant être sur la saison actuelle.
 */
const SeasonBanner = ({ seasonId, onBackToActive }) => (
  <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-40 shadow-md">
    <div className="flex items-center space-x-2 min-w-0">
      <History size={18} className="flex-shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{seasonLabel(seasonId)}</p>
        <p className="text-orange-100 text-xs truncate">
          Saison archivée — tu n'es pas sur la saison en cours
        </p>
      </div>
    </div>
    <button
      onClick={onBackToActive}
      className="ml-3 flex-shrink-0 px-3 py-1.5 bg-white text-orange-600 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
    >
      Revenir
    </button>
  </div>
);

export default SeasonBanner;
