const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Saison en cours, telle que la connaît l'app. Sert à ne pas notifier les Bro
 * quand on corrige un vieux boulot dans une saison archivée.
 */
async function getActiveSeasonId() {
  const snap = await admin.firestore().doc('appState/current').get();
  return snap.exists ? snap.data().seasonId : null;
}

async function notifyNewJob(newJob, jobId) {
  {
    try {
      console.log("🆕 Nouveau boulot créé !");

      // Récupérer tous les tokens FCM
      const tokensSnapshot = await admin.firestore().collection('fcmTokens').get();
      
      if (tokensSnapshot.empty) {
        console.log("❌ Aucun token FCM trouvé");
        return;
      }

      const tokens = [];
      tokensSnapshot.forEach(doc => {
        tokens.push(doc.data().token);
      });
      
      console.log(`📱 ${tokens.length} appareils vont recevoir la notification`);

      // Créer le message
      const message = {
        notification: {
          title: "🔧 Nouveau boulot disponible !",
          body: `${newJob.description} - ${formatDateFr(newJob.date)}`,
        },
        data: {
          jobId: jobId,
          type: 'new_job',
          description: newJob.description,
          date: newJob.date
        }
      };

      // Envoyer à tous les tokens
      const promises = tokens.map(token => {
        return admin.messaging().send({
          ...message,
          token: token
        }).catch(error => {
          console.error(`Erreur envoi vers ${token}:`, error);
          // Supprimer le token invalide
          if (error.code === 'messaging/registration-token-not-registered') {
            return admin.firestore().collection('fcmTokens').doc(token).delete();
          }
        });
      });

      await Promise.all(promises);
      console.log(`✅ Notifications envoyées !`);
      
    } catch (error) {
      console.error("❌ Erreur:", error);
    }
  }
}

// Boulots de la saison historique, restée aux collections racines.
exports.sendJobNotifications = functions
  .region('europe-west1') // Plus proche de la Belgique
  .firestore
  .document('scheduledJobs/{jobId}')
  .onCreate((snap, context) => notifyNewJob(snap.data(), context.params.jobId));

// Boulots des saisons suivantes. On ne notifie que si le boulot est créé dans
// la saison en cours : corriger un boulot dans une saison archivée ne doit pas
// réveiller tous les Bro.
exports.sendJobNotificationsSeason = functions
  .region('europe-west1')
  .firestore
  .document('seasons/{seasonId}/scheduledJobs/{jobId}')
  .onCreate(async (snap, context) => {
    const activeSeasonId = await getActiveSeasonId();

    if (activeSeasonId && context.params.seasonId !== activeSeasonId) {
      console.log(
        `⏭️ Boulot créé dans la saison ${context.params.seasonId}, ` +
        `saison en cours ${activeSeasonId} : pas de notification.`
      );
      return;
    }

    return notifyNewJob(snap.data(), context.params.jobId);
  });

function formatDateFr(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  });
}