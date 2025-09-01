const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Fonction v1 (plus stable) qui se déclenche quand un boulot est créé
exports.sendJobNotifications = functions
  .region('europe-west1') // Plus proche de la Belgique
  .firestore
  .document('scheduledJobs/{jobId}')
  .onCreate(async (snap, context) => {
    try {
      console.log("🆕 Nouveau boulot créé !");
      
      const newJob = snap.data();
      const jobId = context.params.jobId;
      
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
  });

function formatDateFr(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  });
}