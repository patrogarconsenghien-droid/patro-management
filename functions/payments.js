// Fonctions appelables du socle de sécurité des paiements. La logique vit
// dans lib/paymentSecurity.js ; ici, seulement le branchement sur Cloud
// Functions et la notification des animateurs.
const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const security = require("./lib/paymentSecurity");
const { sendToUids } = require("./lib/push");

const REGION = "europe-west1";
const APP_URL = "https://patro-management.vercel.app";

/** Traduit une erreur métier en erreur d'appel, sans rien laisser fuiter d'autre. */
const callable = (handler) =>
  functions.region(REGION).https.onCall(async (data, context) => {
    try {
      return await handler(getFirestore(), context.auth, data || {});
    } catch (error) {
      if (error instanceof security.SecurityError) {
        throw new functions.https.HttpsError(error.code, error.message, { reason: error.reason });
      }
      console.error("Erreur inattendue (paiements) :", error);
      throw new functions.https.HttpsError("internal", "Erreur interne.");
    }
  });

/** Prévient les animateurs et admins d'une section, sur tous leurs appareils. */
async function notifyManagers(sectionId, title, body) {
  const usersSnap = await getFirestore().collection("users").where("status", "==", "active").get();
  const managers = usersSnap.docs
    .filter((doc) => {
      const user = doc.data();
      return user.role === "admin" || (user.role === "animateur" && user.sectionId === sectionId);
    })
    .map((doc) => doc.id);

  return sendToUids(managers, {
    type: "payment_account_changed",
    sectionId,
    title,
    body,
    link: `${APP_URL}/#settings`,
  });
}

exports.paymentSecurityStatus = callable((db, auth) => security.getStatus(db, auth));

exports.paymentTotpEnroll = callable((db, auth, data) => security.startEnrollment(db, auth, data));

exports.paymentTotpConfirm = callable((db, auth, data) => security.confirmEnrollment(db, auth, data));

exports.setPaymentAccount = callable(async (db, auth, data) => {
  const result = await security.setPaymentAccount(db, auth, data);

  // Tous les animateurs de la section l'apprennent : un changement qu'ils
  // n'attendaient pas doit se voir tout de suite.
  if (result.changed) {
    try {
      await notifyManagers(
        result.sectionId,
        result.first ? "Compte de paiement enregistré" : "Compte de paiement modifié",
        `Section ${result.sectionLabel} : les paiements arrivent sur le compte finissant par ${result.lastFour}.`
      );
    } catch (error) {
      console.error("Notification du changement de compte impossible :", error);
    }
  }
  return result;
});
