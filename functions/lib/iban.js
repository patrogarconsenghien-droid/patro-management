// Validation des numéros de compte. On n'accepte que des IBAN belges : le
// patro est chez Belfius, et refuser tout le reste ferme la porte à un compte
// étranger glissé à la place du vrai.

/** « be68 5390 0754 7034 » → « BE68539007547034 ». */
const normalizeIban = (input) => String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Contrôle modulo 97 de la norme ISO 13616, calculé par morceaux. */
function mod97(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder;
}

/** IBAN belge valide : BE + 14 chiffres, clé de contrôle correcte. */
function isValidBelgianIban(input) {
  const iban = normalizeIban(input);
  return /^BE\d{14}$/.test(iban) && mod97(iban) === 1;
}

/** « BE68539007547034 » → « BE68 5390 0754 7034 ». */
const formatIban = (input) => normalizeIban(input).replace(/(.{4})/g, "$1 ").trim();

/** Les 4 derniers chiffres, pour reconnaître un compte sans l'afficher en entier. */
const lastFour = (input) => normalizeIban(input).slice(-4);

module.exports = { normalizeIban, isValidBelgianIban, formatIban, lastFour };
