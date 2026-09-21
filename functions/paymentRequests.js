// Fonctions appelables des paiements par QR. La logique est dans lib/.
const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const requests = require("./lib/paymentRequests");
const memberCodes = require("./lib/memberCodes");
const publicPage = require("./lib/publicPage");

const callable = (handler) =>
  functions.region("europe-west1").https.onCall(async (data, context) => {
    try {
      return await handler(getFirestore(), context.auth, data || {});
    } catch (error) {
      if (error instanceof requests.PaymentError) {
        throw new functions.https.HttpsError(error.code, error.message, { reason: error.reason });
      }
      console.error("Erreur inattendue (paiements par QR) :", error);
      throw new functions.https.HttpsError("internal", "Erreur interne.");
    }
  });

// Boulots : une demande, un montant fixé, une communication unique.
exports.createJobsPaymentRequest = callable((db, auth, data) => requests.createJobsRequest(db, auth, data));

exports.cancelPaymentRequest = callable((db, auth, data) => requests.cancelRequest(db, auth, data));

exports.markPaymentReceived = callable((db, auth, data) => requests.markReceived(db, auth, data));

// Bar : le code permanent d'un membre, pour recharger du montant qu'il veut.
exports.getMemberPaymentCode = callable((db, auth, data) => memberCodes.getMemberCode(db, auth, data));

// Page publique : appelée sans connexion, par la personne qui a reçu le lien.
exports.getPaymentPage = callable((db, _auth, data) => publicPage.getPublicPage(db, data));
