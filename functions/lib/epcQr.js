// Contenu d'un QR de virement SEPA (EPC069-12), lu par les apps bancaires
// belges : Belfius, KBC, ING, BNP Paribas Fortis, Argenta…
//
// Règles Febelfin pour la Belgique (« QR-code on invoice ») : version 2, BIC
// facultatif, et la communication structurée belge va dans le champ de
// remittance STRUCTURÉE, au format +++123/1234/12345+++.
const { normalizeIban } = require("./iban");
const { formatCommunication } = require("./ogm");

const MAX_PAYLOAD_BYTES = 331;
const MAX_NAME_LENGTH = 70;
// Un QR EPC va de 0,01 à 999 999 999,99 €.
const MAX_AMOUNT_CENTS = 99_999_999_999;

/** 1250 → « EUR12.50 ». Jamais de calcul en virgule flottante sur de l'argent. */
function formatAmount(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    throw new Error(`Montant invalide : ${amountCents}`);
  }
  return `EUR${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`;
}

/** Les 11 lignes du QR. Un retour à la ligne dans un champ casserait le format. */
function buildEpcPayload({ holderName, iban, amountCents, communication }) {
  const name = String(holderName || "").replace(/[\r\n]+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  if (!name) throw new Error("Nom du bénéficiaire manquant");

  const payload = [
    "BCD", // étiquette du service
    "002", // version 2 : BIC facultatif
    "1", // UTF-8
    "SCT", // virement SEPA
    "", // BIC
    name,
    normalizeIban(iban),
    formatAmount(amountCents),
    "", // motif
    formatCommunication(communication), // remittance structurée
    "", // remittance libre : jamais les deux à la fois
  ].join("\n");

  if (Buffer.byteLength(payload, "utf8") > MAX_PAYLOAD_BYTES) throw new Error("Contenu du QR trop long");
  return payload;
}

module.exports = { buildEpcPayload, formatAmount };
