export const formatCurrency = (amount) => {
  const value = Number(amount);
  if (isNaN(value)) return "0.00 €"; // sécurité si undefined, null, ou NaN
  return `${value.toFixed(2)} €`;
};

export const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR');

/**
 * Les heures s'additionnent en flottants (0.25, 0.5, ...) : sans arrondi on
 * affiche « 1077.9993299999999 h ».
 */
export const roundHours = (value) => Math.round((value || 0) * 100) / 100;

/**
 * Solde d'ouverture d'un membre pour la saison en cours.
 *
 * L'app recalcule le solde affiché à partir des commandes de la saison
 * (rechargements moins dépenses). L'historique n'étant pas repris d'une saison
 * à l'autre, un solde reporté à la clôture serait invisible sans ce point de
 * départ. Absent sur les membres d'une saison qui n'a pas été ouverte par une
 * clôture : le solde repart alors de zéro, comme avant.
 */
export const openingBalanceOf = (member) => Number(member?.openingBalance) || 0;

/** "3 commandes", "1 commande" — le pluriel français s'applique dès 2. */
export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count >= 2 ? pluralForm : singular}`;

export const formatDateTime = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
