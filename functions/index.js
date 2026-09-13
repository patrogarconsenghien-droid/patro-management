// API v1 explicite : depuis firebase-functions 6, l'import racine renvoie la v2.
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const APP_URL = "https://patro-management.vercel.app";
const DEFAULT_SECTION = "garcons";

// Codes d'erreur qui désignent un jeton mort (app désinstallée, notifications
// révoquées...). Seuls ceux-là entraînent la suppression du jeton : une erreur
// due au message lui-même ne doit jamais effacer les jetons valides.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const sectionPrefix = (sectionId) =>
  sectionId === DEFAULT_SECTION ? "" : `sections/${sectionId}/`;

/**
 * Saison en cours d'une section, telle que la connaît l'app. Sert à ne pas
 * notifier les Bro quand on corrige un vieux boulot dans une saison archivée.
 */
async function getActiveSeasonId(sectionId) {
  const snap = await admin.firestore().doc(`${sectionPrefix(sectionId)}appState/current`).get();
  return snap.exists ? snap.data().seasonId : null;
}

function formatDateFr(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Brussels",
  });
}

/**
 * Jetons des appareils à prévenir pour une section : ceux des comptes de la
 * section (et des admins), plus, pour les garçons, les jetons enregistrés
 * avant les comptes, qui n'ont pas d'identifiant.
 */
async function tokensForSection(sectionId) {
  const db = admin.firestore();
  const [tokensSnap, usersSnap] = await Promise.all([
    db.collection("fcmTokens").get(),
    db.collection("users").where("status", "==", "active").get(),
  ]);

  const allowedUids = new Set();
  usersSnap.forEach((doc) => {
    const user = doc.data();
    if (user.role === "admin" || user.sectionId === sectionId) allowedUids.add(doc.id);
  });

  return tokensSnap.docs
    .map((doc) => doc.data())
    .filter((data) => data.token)
    .filter((data) => (data.uid ? allowedUids.has(data.uid) : sectionId === DEFAULT_SECTION))
    .map((data) => data.token);
}

async function notifyNewJob(newJob, jobId, sectionId) {
  try {
    const tokens = await tokensForSection(sectionId);

    if (tokens.length === 0) {
      console.log(`Aucun appareil à prévenir pour la section ${sectionId}.`);
      return;
    }

    const date = formatDateFr(newJob.date);
    const description = String(newJob.description || "Nouveau boulot");

    // Message « data » uniquement : c'est le service worker qui affiche la
    // notification. Avec un bloc « notification », le SDK en affichait une et
    // le service worker une seconde, d'où des doublons.
    // Toutes les valeurs de « data » doivent être des chaînes.
    const data = {
      type: "new_job",
      jobId: String(jobId),
      sectionId: String(sectionId),
      title: "Nouveau boulot disponible",
      body: date ? `${description} · ${date}` : description,
      link: `${APP_URL}/#boulots-scheduled`,
    };

    const messages = tokens.map((token) => ({
      token,
      data,
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
      android: { priority: "high" },
    }));

    // sendEach accepte 500 messages par appel.
    let sent = 0;
    const deadTokens = [];
    for (let i = 0; i < messages.length; i += 500) {
      const batch = messages.slice(i, i + 500);
      const response = await admin.messaging().sendEach(batch);
      sent += response.successCount;
      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error && result.error.code;
          console.warn(`Échec d'envoi (${code}) vers l'appareil ${i + index}`);
          if (DEAD_TOKEN_CODES.has(code)) deadTokens.push(batch[index].token);
        }
      });
    }

    await Promise.all(
      deadTokens.map((token) => admin.firestore().collection("fcmTokens").doc(token).delete())
    );

    console.log(
      `Boulot ${jobId} (${sectionId}) : ${sent}/${tokens.length} notifications envoyées, ` +
      `${deadTokens.length} jeton(s) mort(s) supprimé(s).`
    );
  } catch (error) {
    console.error("Erreur lors de l'envoi des notifications :", error);
  }
}

// On ne notifie que si le boulot est créé dans la saison en cours de sa
// section : corriger un boulot dans une saison archivée ne doit pas réveiller
// tous les Bro.
async function notifyIfActiveSeason(snap, context, sectionId) {
  const activeSeasonId = await getActiveSeasonId(sectionId);

  if (activeSeasonId && context.params.seasonId !== activeSeasonId) {
    console.log(
      `Boulot créé dans la saison ${context.params.seasonId} (${sectionId}), ` +
      `saison en cours ${activeSeasonId} : pas de notification.`
    );
    return;
  }

  return notifyNewJob(snap.data(), context.params.jobId, sectionId);
}

// Garçons : saison historique, restée aux collections racines.
exports.sendJobNotifications = functions
  .region("europe-west1")
  .firestore
  .document("scheduledJobs/{jobId}")
  .onCreate((snap, context) => notifyNewJob(snap.data(), context.params.jobId, DEFAULT_SECTION));

// Garçons : saisons suivantes.
exports.sendJobNotificationsSeason = functions
  .region("europe-west1")
  .firestore
  .document("seasons/{seasonId}/scheduledJobs/{jobId}")
  .onCreate((snap, context) => notifyIfActiveSeason(snap, context, DEFAULT_SECTION));

// Autres sections (filles).
exports.sendJobNotificationsSection = functions
  .region("europe-west1")
  .firestore
  .document("sections/{sectionId}/seasons/{seasonId}/scheduledJobs/{jobId}")
  .onCreate((snap, context) => notifyIfActiveSeason(snap, context, context.params.sectionId));
