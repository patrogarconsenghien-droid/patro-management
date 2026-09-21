// Communication structurée belge (OGM-VCS) : 12 chiffres, dont les 2 derniers
// sont le reste de la division des 10 premiers par 97 (97 quand le reste vaut
// 0). Toutes les banques belges la valident à la saisie : une faute de frappe
// est refusée avant même que le virement parte.
//
// Les 10 premiers chiffres encodent l'année, la section et un compteur :
//   AA S NNNNNNN   →   26 1 0000042
// On retrouve ainsi une demande à partir de sa seule communication.

const SECTION_DIGIT = { garcons: 1, filles: 2 };

const checkDigits = (base10) => {
  const remainder = Number(BigInt(base10) % 97n);
  return String(remainder === 0 ? 97 : remainder).padStart(2, "0");
};

/** Les 12 chiffres d'une communication, pour une section et un numéro d'ordre. */
function buildCommunication({ sectionId, year, sequence }) {
  const section = SECTION_DIGIT[sectionId];
  if (!section) throw new Error(`Section inconnue : ${sectionId}`);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9_999_999) {
    throw new Error(`Numéro d'ordre hors limites : ${sequence}`);
  }
  const base = `${String(year % 100).padStart(2, "0")}${section}${String(sequence).padStart(7, "0")}`;
  return base + checkDigits(base);
}

/**
 * Identifiant permanent d'un membre du bar : 9 S NNNNNNNN + clé. Le 9 de tête
 * le distingue des demandes de paiement, qui commencent par l'année.
 */
function buildMemberCode({ sectionId, sequence }) {
  const section = SECTION_DIGIT[sectionId];
  if (!section) throw new Error(`Section inconnue : ${sectionId}`);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99_999_999) {
    throw new Error(`Numéro d'ordre hors limites : ${sequence}`);
  }
  const base = `9${section}${String(sequence).padStart(8, "0")}`;
  return base + checkDigits(base);
}

const isMemberCode = (digits) => isValidCommunication(digits) && digits[0] === "9";

/** « 261000004257 » → « +++261/0000/04257+++ ». */
const formatCommunication = (digits) =>
  `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7, 12)}+++`;

const isValidCommunication = (digits) =>
  /^\d{12}$/.test(digits) && digits.slice(10) === checkDigits(digits.slice(0, 10));

/**
 * Cherche une communication valide dans un texte libre de relevé bancaire :
 * « +++261/0000/04257+++ », « 261/0000/04257 », « 261000004257 »…
 * Renvoie les 12 chiffres, ou null.
 */
function findCommunication(text) {
  const candidates = String(text || "").match(/\d[\d\s/+.-]{10,24}\d/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    for (let i = 0; i + 12 <= digits.length; i++) {
      const slice = digits.slice(i, i + 12);
      if (isValidCommunication(slice)) return slice;
    }
  }
  return null;
}

module.exports = { buildMemberCode, isMemberCode, buildCommunication, formatCommunication, isValidCommunication, findCommunication, SECTION_DIGIT };
