// Fonctions appelables des demandes de paiement. La logique est dans
// lib/paymentRequests.js.
const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const requests = require("./lib/paymentRequests");

const callable = (handler) =>
  functions.region("europe-west1").https.onCall(async (data, context) => {
    try {
      return await handler(getFirestore(), context.auth, data || {});
    } catch (error) {
      if (error instanceof requests.PaymentError) {
        throw new functions.https.HttpsError(error.code, error.message, { reason: error.reason });
      }
      console.error("Erreur inattendue (demandes de paiement) :", error);
      throw new functions.https.HttpsError("internal", "Erreur interne.");
    }
  });

exports.createJobsPaymentRequest = callable((db, auth, data) => requests.createJobsRequest(db, auth, data));

exports.createBarPaymentRequest = callable((db, auth, data) => requests.createBarRequest(db, auth, data));

exports.cancelPaymentRequest = callable((db, auth, data) => requests.cancelRequest(db, auth, data));

exports.markPaymentReceived = callable((db, auth, data) => requests.markReceived(db, auth, data));

// Page publique : appelée sans connexion, par le client qui a reçu le lien.
// Seul le jeton, de 128 bits, donne accès à une demande.
exports.getPaymentPage = callable((db, _auth, data) => requests.getPublicPage(db, data));
