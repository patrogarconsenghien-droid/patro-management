// Validation des IBAN côté app, pour guider la saisie. Le serveur refait le
// même contrôle (functions/lib/iban.js) : c'est lui qui fait foi.

/** « be68 5390 0754 7034 » → « BE68539007547034 ». */
export const normalizeIban = (input) => String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Contrôle modulo 97 de la norme ISO 13616, calculé par morceaux. */
const mod97 = (iban) => {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder;
};

/** IBAN belge valide : BE + 14 chiffres, clé de contrôle correcte. */
export const isValidBelgianIban = (input) => {
  const iban = normalizeIban(input);
  return /^BE\d{14}$/.test(iban) && mod97(iban) === 1;
};

/** « BE68539007547034 » → « BE68 5390 0754 7034 ». */
export const formatIban = (input) => normalizeIban(input).replace(/(.{4})/g, '$1 ').trim();

/** Les 4 derniers chiffres, pour reconnaître un compte d'un coup d'œil. */
export const lastFour = (input) => normalizeIban(input).slice(-4);
