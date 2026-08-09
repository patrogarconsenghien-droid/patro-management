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
