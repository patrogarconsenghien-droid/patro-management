// Envoi de notifications aux appareils de comptes précis.
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Jeton mort (app désinstallée, notifications révoquées) : on le supprime.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Envoie un message « data » à tous les appareils des comptes donnés. C'est le
 * service worker qui affiche la notification ; toutes les valeurs doivent être
 * des chaînes. Renvoie le nombre d'appareils atteints.
 */
async function sendToUids(uids, data) {
  const wanted = new Set(uids);
  if (wanted.size === 0) return 0;

  const db = getFirestore();
  const tokensSnap = await db.collection("fcmTokens").get();
  const tokens = tokensSnap.docs
    .map((doc) => doc.data())
    .filter((entry) => entry.token && entry.uid && wanted.has(entry.uid))
    .map((entry) => entry.token);
  if (tokens.length === 0) return 0;

  let sent = 0;
  const dead = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await getMessaging().sendEach(batch.map((token) => ({
      token,
      data,
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
      android: { priority: "high" },
    })));
    sent += response.successCount;
    response.responses.forEach((result, index) => {
      if (!result.success && DEAD_TOKEN_CODES.has(result.error && result.error.code)) dead.push(batch[index]);
    });
  }
  await Promise.all(dead.map((token) => db.collection("fcmTokens").doc(token).delete()));
  return sent;
}

module.exports = { sendToUids };
