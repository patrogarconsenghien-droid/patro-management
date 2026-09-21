// Rappel d'un boulot programmé, déclenché par un animateur : notification et
// mail à ceux qui n'ont pas répondu. La logique est dans lib/jobReminder.js.
//
// Les mails sont déposés dans la collection `mail` ; c'est l'extension
// Firebase « Trigger Email from Firestore » qui les envoie. Tant qu'elle n'est
// pas installée, les notifications partent quand même et les mails attendent.
const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const reminder = require("./lib/jobReminder");
const { sendToUids } = require("./lib/push");

const APP_URL = "https://patro-management.vercel.app";

exports.sendJobReminder = functions.region("europe-west1").https.onCall(async (data, context) => {
  try {
    const prepared = await reminder.prepareReminder(getFirestore(), context.auth, data || {}, { appUrl: APP_URL });

    let notified = 0;
    try {
      notified = await sendToUids(prepared.uids, {
        type: "job_reminder",
        jobId: String(prepared.jobId),
        sectionId: String(prepared.sectionId),
        title: prepared.message.title,
        body: prepared.message.body,
        link: prepared.message.link,
      });
    } catch (error) {
      console.error("Notifications du rappel impossibles :", error);
    }

    return { ...prepared.counts, notified };
  } catch (error) {
    if (error instanceof reminder.ReminderError) {
      throw new functions.https.HttpsError(error.code, error.message, { reason: error.reason });
    }
    console.error("Erreur inattendue (rappel) :", error);
    throw new functions.https.HttpsError("internal", "Erreur interne.");
  }
});
