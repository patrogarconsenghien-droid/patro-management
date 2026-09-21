# Patro Management

Application web (PWA) de gestion pour une section de patro : stock et produits,
boulots, voyages, tonneau surprise, notifications push.

Stack : React 19 + Vite 7 + Tailwind CSS, Firebase (Firestore, Cloud Messaging,
Hosting, Cloud Functions).

## Démarrer

```bash
pnpm install
pnpm dev
```

L'app tourne sur http://localhost:5173.

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Serveur de développement Vite |
| `pnpm build` | Build de production dans `dist/` |
| `pnpm preview` | Sert le build de production en local |
| `pnpm deploy` | Build puis déploiement du site sur Firebase Hosting |
| `pnpm deploy:functions` | Déploiement des Cloud Functions uniquement |
| `pnpm deploy:rules` | Déploiement des règles Firestore uniquement |
| `pnpm test:rules` | Tests des règles Firestore sur l'émulateur (Java requis) |
| `pnpm test:functions` | Tests des Cloud Functions : codes TOTP, IBAN, sécurité des paiements |

Le déploiement suppose la Firebase CLI installée et connectée
(`npm i -g firebase-tools` puis `firebase login`). Le projet ciblé est
`patro-management-2024` (voir `.firebaserc`).

## Structure

```
index.html            Point d'entrée HTML (métadonnées PWA)
public/               Fichiers copiés tels quels : manifest, icônes, service worker FCM
src/
  main.jsx            Montage React
  App.jsx             Écran principal + état global de l'app
  Home.jsx            Écran d'accueil
  Boulots.jsx         Gestion des boulots
  Settings.jsx        Paramètres
  TripManager.jsx     Gestion des voyages
  components/         Composants partagés (Header, Modal, TonneauSurprise)
  hooks/              useFirestoreData (lecture/écriture Firestore)
  lib/                Utilitaires purs (format, stock)
  firebase.js         Initialisation Firebase + clé VAPID
  useNotifications.js Permissions et token Firebase Cloud Messaging
functions/            Cloud Functions (notification à la création d'un boulot)
```

## Notes

- La config Firebase côté web est publique par nature (elle part dans le bundle).
  La protection des données repose sur les **règles Firestore**, à maintenir à jour
  dans la console Firebase.
- `public/firebase-messaging-sw.js` duplique la config Firebase : un service
  worker ne peut pas importer les modules de l'app. Si la config change, il faut
  la mettre à jour aux deux endroits.
- `dist/` et `node_modules/` ne sont pas versionnés : ils sont régénérés par
  `pnpm install` et `pnpm build`.

## Paiements : compte de réception

Chaque section a son compte bancaire, dans `paymentSettings/{section}`. Ce
document est la cible de tous les QR de paiement : il est verrouillé.

- Les règles Firestore refusent toute écriture depuis l'app, même de l'admin.
- Seule la fonction `setPaymentAccount` l'écrit. Elle exige un admin, une
  connexion Google de moins de 5 minutes, et un code de l'app
  d'authentification de l'admin (TOTP, RFC 6238). Un code ne sert qu'une fois ;
  5 codes faux verrouillent 15 minutes.
- Seuls les IBAN belges valides sont acceptés.
- Chaque geste laisse une ligne dans `auditLog`, en ajout seul, lisible par
  l'admin. Les animateurs de la section reçoivent une notification à chaque
  changement, et l'ancien compte reste affiché 30 jours à côté du nouveau.

L'écran est dans Réglages → Compte de paiement. La logique est dans
`functions/lib/paymentSecurity.js`, testée par `pnpm test:functions`.

**Téléphone de l'admin perdu.** Le secret de l'app d'authentification est dans
`paymentSecurity/{uid}`, illisible depuis l'app. Pour repartir de zéro, le
propriétaire du projet supprime ce document dans la console Firebase ; l'admin
relie ensuite une nouvelle app depuis l'écran. Tant que ce n'est pas fait, le
compte de paiement en place continue de fonctionner, il ne peut simplement
plus être changé.

## Rappels de boulots

Sur un boulot programmé incomplet, un animateur voit « À relancer » et un
bouton « Envoyer un rappel ». La fonction `sendJobReminder` recalcule côté
serveur qui n'a pas répondu (ni inscrit, ni « ne peut pas », ni déjà pris ce
jour-là), puis envoie une notification et un mail aux comptes reliés à ces
membres. Un rappel par heure et par section au plus. La logique est dans
`functions/lib/jobReminder.js`.

**Mails.** La fonction ne parle à aucun serveur de messagerie : elle dépose
un document par destinataire dans la collection `mail`. C'est l'extension
Firebase « Trigger Email from Firestore » qui les envoie. À installer une fois
depuis la console Firebase → Extensions :

- collection des mails : `mail` ;
- région : `europe-west1` ;
- adresse d'expédition et serveur SMTP : par exemple Gmail, avec un mot de
  passe d'application (compte Google → Sécurité → Validation en deux étapes →
  Mots de passe des applications). L'extension range ce mot de passe dans
  Secret Manager ; il n'est jamais dans le dépôt.

Tant que l'extension n'est pas installée, les notifications partent et les
mails restent en attente dans `mail`, sans erreur. Les règles Firestore
interdisent à l'app d'écrire dans `mail` : personne ne peut envoyer un mail
au nom du patro depuis un navigateur.

## Paiements : demandes et QR

Boulots → « Paiements par QR » (animateurs). On coche un ou plusieurs boulots
faits d'un même client, ou on choisit un membre du bar et un montant : le
serveur crée une demande de paiement.

- **Communication structurée belge**, unique par demande : `AA S NNNNNNN` plus
  la clé modulo 97. `AA` est l'année, `S` la section (1 Brothers, 2 Grandes),
  `N` un compteur. Code dans `functions/lib/ogm.js`.
- **QR de virement SEPA** (EPC069-12 version 2), selon le guide Febelfin : la
  communication va dans la remittance structurée, au format
  `+++123/1234/12345+++`. Code dans `functions/lib/epcQr.js`. Le contenu du QR
  vient toujours du serveur, à partir de `paymentSettings` ; l'app ne fait que
  le dessiner.
- **Lien public** `https://patro-management.vercel.app/payer/<jeton>`, ouvert
  sans compte. Le jeton fait 128 bits. La page ne montre que le montant, le
  détail des boulots, le compte et la communication ; elle passe d'elle-même à
  « reçu ». `vercel.json` renvoie `/payer/*` vers l'app.
- **Une demande ne change plus** une fois créée. Pour corriger, on l'annule et
  on en crée une autre. Les règles Firestore interdisent toute écriture sur
  `paymentRequests` depuis l'app.
- **Paiement reçu** : en attendant le rapprochement bancaire automatique, un
  animateur marque « j'ai vu le virement », ce qui laisse une ligne dans
  `auditLog`. Boulots : payés par virement, le surplus devient un pourboire,
  noté sur le boulot et encodé en rentrée. Compte bar : tout le montant reçu
  est crédité. `settleRequest` servira tel quel au rapprochement automatique.
