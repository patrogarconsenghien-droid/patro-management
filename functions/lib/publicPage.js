// Page publique ouverte par un lien /payer/<jeton> : soit une demande de
// paiement (montant fixé), soit le code permanent d'un membre du bar (montant
// libre). Le jeton, de 128 bits, est le seul sésame.
const requests = require("./paymentRequests");
const memberCodes = require("./memberCodes");

const TOKEN = /^[A-Za-z0-9_-]{20,40}$/;

async function getPublicPage(db, { token } = {}) {
  try {
    return await requests.getPublicPage(db, { token });
  } catch (error) {
    const unknown = error instanceof requests.PaymentError && error.reason === "no-request";
    if (!unknown || !TOKEN.test(String(token || ""))) throw error;
    const page = await memberCodes.getMemberPage(db, token);
    if (!page) throw error;
    return page;
  }
}

module.exports = { getPublicPage };
