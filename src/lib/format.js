export const formatCurrency = (amount) => {
  const value = Number(amount);
  if (isNaN(value)) return "0.00 €"; // sécurité si undefined, null, ou NaN
  return `${value.toFixed(2)} €`;
};

export const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR');

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
