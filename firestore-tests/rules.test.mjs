// Tests des règles Firestore, exécutés contre l'émulateur :
//   npm run test:rules   (à la racine du projet)
//
// Chaque cas dit qui fait quoi, et si ça doit passer ou être refusé.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc
} from 'firebase/firestore';

const rules = readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8');

const env = await initializeTestEnvironment({
  projectId: 'patro-rules-test',
  firestore: { rules, host: '127.0.0.1', port: 8089 }
});

const ADMIN = { uid: 'admin1', email: 'admin@patro.be' };
const ANIMATEUR = { uid: 'anim1', email: 'anim@patro.be' };
const ANIME = { uid: 'kid1', email: 'kid@patro.be', broId: 'bro-kid' };
const ANIME2 = { uid: 'kid2', email: 'kid2@patro.be', broId: 'bro-kid2' };
const PENDING = { uid: 'wait1', email: 'wait@patro.be' };

const token = (u) => ({ email: u.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (u) => env.authenticatedContext(u.uid, token(u)).firestore();
const anonymous = () => env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();

// Données de départ, posées sans règles.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const users = {
    [ADMIN.uid]: { role: 'admin', status: 'active', sectionId: 'garcons', broId: null },
    [ANIMATEUR.uid]: { role: 'animateur', status: 'active', sectionId: 'garcons', broId: 'bro-anim' },
    [ANIME.uid]: { role: 'anime', status: 'active', sectionId: 'garcons', broId: ANIME.broId },
    [ANIME2.uid]: { role: 'anime', status: 'active', sectionId: 'garcons', broId: ANIME2.broId },
    [PENDING.uid]: { role: null, status: 'pending', sectionId: null, broId: null }
  };
  for (const [uid, data] of Object.entries(users)) {
    const u = [ADMIN, ANIMATEUR, ANIME, ANIME2, PENDING].find((x) => x.uid === uid);
    await setDoc(doc(db, 'users', uid), { uid, email: u.email, displayName: uid, ...data });
  }
  await setDoc(doc(db, 'appState', 'current'), { seasonId: '2026-2027' });
  await setDoc(doc(db, 'seasons', '2026-2027'), { status: 'active' });

  for (const prefix of [[], ['seasons', '2026-2027']]) {
    const p = (...segs) => doc(db, ...prefix, ...segs);
    await setDoc(p('members', 'm1'), { name: 'Martin', balance: -4 });
    await setDoc(p('bros', 'bro-kid'), { name: 'Kid', totalHours: 3 });
    await setDoc(p('bros', 'bro-kid2'), { name: 'Kid2', totalHours: 1 });
    await setDoc(p('jobs', 'j1'), { broId: 'bro-kid', hours: 2, total: 20, isPaid: false });
    await setDoc(p('scheduledJobs', 'sj-anim'), { description: 'Par animateur', createdBy: ANIMATEUR.uid, brosNeeded: 2, registeredBros: [], unavailableBros: [] });
    await setDoc(p('scheduledJobs', 'sj-kid'), { description: 'Par Kid', createdBy: ANIME.uid, brosNeeded: 2, registeredBros: [], unavailableBros: [] });
    await setDoc(p('scheduledJobs', 'sj-full'), { description: 'Avec inscrits', createdBy: ANIMATEUR.uid, brosNeeded: 1, registeredBros: [{ broId: 'bro-kid2' }], unavailableBros: [] });
    await setDoc(p('financialTransactions', 'f1'), { type: 'expense', amount: 10 });
  }
});

let passed = 0;
const failures = [];
async function check(label, promise, shouldPass) {
  try {
    await (shouldPass ? assertSucceeds(promise) : assertFails(promise));
    passed += 1;
  } catch (error) {
    failures.push(`${label} — ${error.message.split('\n')[0]}`);
  }
}
const ok = (label, p) => check(label, p, true);
const ko = (label, p) => check(label, p, false);

// Les mêmes cas sur les deux arbres : racine (saison historique) et seasons/{sid}.
for (const [treeName, prefix] of [['racine', []], ['saison', ['seasons', '2026-2027']]]) {
  const ref = (db, ...segs) => doc(db, ...prefix, ...segs);
  const col = (db, name) => collection(db, ...prefix, name);
  const t = (label) => `[${treeName}] ${label}`;

  // --- lecture ---
  await ko(t('anonyme ne lit pas les boulots'), getDocs(col(anonymous(), 'jobs')));
  await ko(t('compte en attente ne lit pas les boulots'), getDocs(col(as(PENDING), 'jobs')));
  await ok(t('animé lit les boulots'), getDocs(col(as(ANIME), 'jobs')));
  await ok(t('animé lit les Bro'), getDocs(col(as(ANIME), 'bros')));
  await ok(t('animé lit les boulots programmés'), getDocs(col(as(ANIME), 'scheduledJobs')));
  await ko(t('animé ne lit pas les membres du bar'), getDocs(col(as(ANIME), 'members')));
  await ko(t('animé ne lit pas les finances'), getDocs(col(as(ANIME), 'financialTransactions')));
  await ok(t('animateur lit les membres'), getDocs(col(as(ANIMATEUR), 'members')));
  await ok(t('animateur lit les finances'), getDocs(col(as(ANIMATEUR), 'financialTransactions')));

  // --- bar / finances : animateurs seulement ---
  await ko(t('animé n\'écrit pas dans les membres'), setDoc(ref(as(ANIME), 'members', 'x'), { name: 'X', balance: 0 }));
  await ok(t('animateur écrit dans les membres'), setDoc(ref(as(ANIMATEUR), 'members', 'x'), { name: 'X', balance: 0 }));

  // --- boulots programmés ---
  await ok(t('animé propose un boulot à son nom'),
    setDoc(ref(as(ANIME), 'scheduledJobs', `new-${treeName}`), { description: 'Proposé', createdBy: ANIME.uid, brosNeeded: 1, registeredBros: [], unavailableBros: [] }));
  await ko(t('animé ne propose pas un boulot au nom d\'un autre'),
    setDoc(ref(as(ANIME), 'scheduledJobs', `fake-${treeName}`), { description: 'Faux', createdBy: ANIMATEUR.uid, brosNeeded: 1, registeredBros: [], unavailableBros: [] }));
  await ok(t('animé s\'inscrit (registeredBros)'),
    updateDoc(ref(as(ANIME), 'scheduledJobs', 'sj-anim'), { registeredBros: [{ broId: ANIME.broId }], updatedAt: 'x' }));
  await ok(t('animé répond « ne peut pas »'),
    updateDoc(ref(as(ANIME), 'scheduledJobs', 'sj-anim'), { unavailableBros: [{ broId: ANIME.broId }], registeredBros: [], updatedAt: 'x' }));
  await ko(t('animé ne modifie pas la description du boulot d\'un autre'),
    updateDoc(ref(as(ANIME), 'scheduledJobs', 'sj-anim'), { description: 'Piraté', updatedAt: 'x' }));
  await ok(t('animé modifie son propre boulot'),
    updateDoc(ref(as(ANIME), 'scheduledJobs', 'sj-kid'), { description: 'Corrigé', updatedAt: 'x' }));
  await ko(t('animé ne supprime pas le boulot vide d\'un autre'), deleteDoc(ref(as(ANIME), 'scheduledJobs', 'sj-anim')));
  await ok(t('animé supprime son propre boulot'), deleteDoc(ref(as(ANIME), 'scheduledJobs', 'sj-kid')));
  await ko(t('animé ne valide pas (suppression d\'un boulot avec inscrits)'), deleteDoc(ref(as(ANIME), 'scheduledJobs', 'sj-full')));
  await ok(t('animateur valide (suppression d\'un boulot avec inscrits)'), deleteDoc(ref(as(ANIMATEUR), 'scheduledJobs', 'sj-full')));
  await ok(t('animateur modifie le boulot de n\'importe qui'),
    updateDoc(ref(as(ANIMATEUR), 'scheduledJobs', 'sj-anim'), { description: 'Par animateur, modifié', updatedAt: 'x' }));

  // --- validation : création de boulots faits, heures des Bro ---
  await ko(t('animé ne crée pas de boulot fait (heures inventées)'),
    setDoc(ref(as(ANIME), 'jobs', `done-${treeName}`), { broId: 'bro-kid', hours: 2, total: 20, isPaid: false }));
  await ok(t('animateur crée un boulot fait'),
    setDoc(ref(as(ANIMATEUR), 'jobs', `done-${treeName}`), { broId: 'bro-kid2', hours: 2, total: 20, isPaid: false }));
  await ko(t('animé ne marque pas un boulot payé'),
    updateDoc(ref(as(ANIME), 'jobs', 'j1'), { isPaid: true, paymentMethod: 'cash', updatedAt: 'x' }));
  await ok(t('animateur marque un boulot payé'),
    updateDoc(ref(as(ANIMATEUR), 'jobs', 'j1'), { isPaid: true, paymentMethod: 'cash', updatedAt: 'x' }));
  await ko(t('animé ne supprime pas un boulot fait'), deleteDoc(ref(as(ANIME), 'jobs', 'j1')));
  await ko(t('animé ne crédite pas d\'heures à un Bro'),
    updateDoc(ref(as(ANIME), 'bros', 'bro-kid'), { totalHours: 99, updatedAt: 'x' }));
  await ok(t('animateur crédite les heures d\'un Bro'),
    updateDoc(ref(as(ANIMATEUR), 'bros', 'bro-kid2'), { totalHours: 3, updatedAt: 'x' }));
  await ok(t('animé change la photo de son propre Bro'),
    updateDoc(ref(as(ANIME), 'bros', 'bro-kid'), { photoURL: 'https://x/y.jpg', updatedAt: 'x' }));
  await ko(t('animé ne change pas la photo d\'un autre Bro'),
    updateDoc(ref(as(ANIME), 'bros', 'bro-kid2'), { photoURL: 'https://x/y.jpg', updatedAt: 'x' }));
  await ko(t('animé ne renomme pas un Bro'),
    updateDoc(ref(as(ANIME), 'bros', 'bro-kid2'), { name: 'Autre', updatedAt: 'x' }));
  await ko(t('animé ne crée pas de Bro'), setDoc(ref(as(ANIME), 'bros', 'bro-new'), { name: 'Nouveau', totalHours: 0 }));
  await ok(t('animateur crée un Bro'), setDoc(ref(as(ANIMATEUR), 'bros', `bro-new-${treeName}`), { name: 'Nouveau', totalHours: 0 }));
}

// --- sections : garçons et filles ne se voient pas, l'admin voit tout ---
const FILLE_ANIM = { uid: 'fanim1', email: 'fanim@patro.be' };
const FILLE_KID = { uid: 'fkid1', email: 'fkid@patro.be', broId: 'fbro1' };
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users', FILLE_ANIM.uid), { uid: FILLE_ANIM.uid, email: FILLE_ANIM.email, displayName: 'F', role: 'animateur', status: 'active', sectionId: 'filles', broId: null });
  await setDoc(doc(db, 'users', FILLE_KID.uid), { uid: FILLE_KID.uid, email: FILLE_KID.email, displayName: 'FK', role: 'anime', status: 'active', sectionId: 'filles', broId: 'fbro1' });
  await setDoc(doc(db, 'sections', 'filles', 'appState', 'current'), { seasonId: '2026-2027' });
  await setDoc(doc(db, 'sections', 'filles', 'seasons', '2026-2027', 'members', 'fm1'), { name: 'Léa', balance: 0 });
  await setDoc(doc(db, 'sections', 'filles', 'seasons', '2026-2027', 'scheduledJobs', 'fsj1'), { description: 'Filles', createdBy: FILLE_ANIM.uid, brosNeeded: 1, registeredBros: [], unavailableBros: [] });
});
const F = (db, ...segs) => doc(db, 'sections', 'filles', 'seasons', '2026-2027', ...segs);
const FC = (db, name) => collection(db, 'sections', 'filles', 'seasons', '2026-2027', name);

await ok('animatrice lit les membres des filles', getDocs(FC(as(FILLE_ANIM), 'members')));
await ko('animatrice ne lit pas les membres des garçons (racine)', getDocs(collection(as(FILLE_ANIM), 'members')));
await ko('animatrice ne lit pas les membres des garçons (saison)', getDocs(collection(as(FILLE_ANIM), 'seasons', '2026-2027', 'members')));
await ko('animateur garçons ne lit pas les membres des filles', getDocs(FC(as(ANIMATEUR), 'members')));
await ko('animateur garçons n\'écrit pas chez les filles', setDoc(F(as(ANIMATEUR), 'members', 'x'), { name: 'X', balance: 0 }));
await ko('animé garçons ne lit pas les boulots des filles', getDocs(FC(as(ANIME), 'scheduledJobs')));
await ok('animée filles répond à un boulot des filles', updateDoc(F(as(FILLE_KID), 'scheduledJobs', 'fsj1'), { registeredBros: [{ broId: 'fbro1' }], updatedAt: 'x' }));
await ko('animée filles ne répond pas à un boulot des garçons', updateDoc(doc(as(FILLE_KID), 'scheduledJobs', 'sj-anim'), { registeredBros: [{ broId: 'fbro1' }], updatedAt: 'x' }));
await ok('admin lit les membres des filles', getDocs(FC(as(ADMIN), 'members')));
await ok('admin écrit chez les filles', setDoc(F(as(ADMIN), 'members', 'fm2'), { name: 'Zoé', balance: 0 }));
await ok('animatrice lit la saison en cours des filles', getDoc(doc(as(FILLE_ANIM), 'sections', 'filles', 'appState', 'current')));
await ok('animatrice lit la saison en cours des garçons (pour les boulots ouverts)', getDoc(doc(as(FILLE_ANIM), 'appState', 'current')));
await ko('animatrice ne change pas la saison des filles', setDoc(doc(as(FILLE_ANIM), 'sections', 'filles', 'appState', 'current'), { seasonId: '2027-2028' }));
await ok('admin change la saison des filles', setDoc(doc(as(ADMIN), 'sections', 'filles', 'appState', 'current'), { seasonId: '2026-2027' }));
await ko('animateur garçons ne valide pas un compte dans la section filles', updateDoc(doc(as(ANIMATEUR), 'users', PENDING.uid), { status: 'active', role: 'anime', sectionId: 'filles', updatedAt: 'x' }));
await ko('animatrice ne modifie pas un compte des garçons', updateDoc(doc(as(FILLE_ANIM), 'users', ANIME.uid), { status: 'disabled', updatedAt: 'x' }));

// --- boulots ouverts à l'autre section ---
import { query, where, addDoc } from 'firebase/firestore';
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'seasons', '2026-2027', 'scheduledJobs', 'open1'), { description: 'Ouvert', createdBy: ANIMATEUR.uid, openToOtherSection: true, brosNeeded: 3, registeredBros: [], unavailableBros: [] });
  await setDoc(doc(db, 'seasons', '2026-2027', 'scheduledJobs', 'closed1'), { description: 'Fermé', createdBy: ANIMATEUR.uid, openToOtherSection: false, brosNeeded: 3, registeredBros: [], unavailableBros: [] });
  await setDoc(doc(db, 'sections', 'filles', 'seasons', '2026-2027', 'bros', 'fbro1'), { name: 'Léa', totalHours: 2 });
});
const G = (db, ...segs) => doc(db, 'seasons', '2026-2027', ...segs);
await ok('animée filles lit les boulots ouverts des garçons (requête filtrée)',
  getDocs(query(collection(as(FILLE_KID), 'seasons', '2026-2027', 'scheduledJobs'), where('openToOtherSection', '==', true))));
await ko('animée filles ne lit pas tous les boulots des garçons', getDocs(collection(as(FILLE_KID), 'seasons', '2026-2027', 'scheduledJobs')));
await ko('animée filles ne lit pas un boulot fermé des garçons', getDoc(G(as(FILLE_KID), 'scheduledJobs', 'closed1')));
await ok('animée filles lit la saison en cours des garçons', getDoc(doc(as(FILLE_KID), 'appState', 'current')));
await ok('animée filles s\'inscrit sur un boulot ouvert des garçons',
  updateDoc(G(as(FILLE_KID), 'scheduledJobs', 'open1'), { registeredBros: [{ broId: 'fbro1', sectionId: 'filles', name: 'Léa' }], updatedAt: 'x' }));
await ko('animée filles ne modifie pas la description d\'un boulot ouvert',
  updateDoc(G(as(FILLE_KID), 'scheduledJobs', 'open1'), { description: 'Piraté', updatedAt: 'x' }));
await ko('animée filles ne s\'inscrit pas sur un boulot fermé',
  updateDoc(G(as(FILLE_KID), 'scheduledJobs', 'closed1'), { registeredBros: [{ broId: 'fbro1' }], updatedAt: 'x' }));
await ok('animateur garçons crée le boulot fait d\'une fille chez les filles, signé garçons',
  addDoc(FC(as(ANIMATEUR), 'jobs'), { broId: 'fbro1', hours: 2, total: 20, isPaid: false, crossSectionFrom: 'garcons' }));
await ko('animateur garçons ne crée pas de boulot fait chez les filles sans signature',
  addDoc(FC(as(ANIMATEUR), 'jobs'), { broId: 'fbro1', hours: 2, total: 20, isPaid: false }));
await ko('animateur garçons ne signe pas « filles » pour écrire chez les filles',
  addDoc(FC(as(ANIMATEUR), 'jobs'), { broId: 'fbro1', hours: 2, total: 20, isPaid: false, crossSectionFrom: 'filles' }));
await ko('animé garçons ne crée pas de boulot fait chez les filles',
  addDoc(FC(as(ANIME), 'jobs'), { broId: 'fbro1', hours: 2, total: 20, isPaid: false, crossSectionFrom: 'garcons' }));
await ok('animateur garçons crédite les heures d\'une fille',
  updateDoc(F(as(ANIMATEUR), 'bros', 'fbro1'), { totalHours: 4, updatedAt: 'x' }));
await ko('animateur garçons ne renomme pas une fille',
  updateDoc(F(as(ANIMATEUR), 'bros', 'fbro1'), { name: 'X', updatedAt: 'x' }));
await ko('animateur garçons ne marque pas payé chez les filles',
  updateDoc(F(as(ANIMATEUR), 'jobs', 'j1'), { isPaid: true, updatedAt: 'x' }));

// --- comptes ---
const newUser = (u, extra) => setDoc(doc(as(u), 'users', u.uid), {
  uid: u.uid, email: u.email, displayName: 'X', photoURL: null,
  status: 'pending', role: null, sectionId: null, broId: null, ...extra
});
const NEW = { uid: 'new1', email: 'new@patro.be' };
await ok('nouveau compte : création en attente', newUser(NEW));
await ko('nouveau compte : ne se crée pas animateur', newUser({ uid: 'new2', email: 'new2@patro.be' }, { status: 'active', role: 'animateur' }));
await ko('nouveau compte : ne se crée pas admin', newUser({ uid: 'new3', email: 'new3@patro.be' }, { status: 'active', role: 'admin' }));
const BOOT = { uid: 'boot1', email: 'rscokart@gmail.com' };
await ok('premier admin : se crée admin', newUser(BOOT, { status: 'active', role: 'admin', sectionId: 'garcons' }));
await ko('usurpation : email du premier admin sans être vérifié',
  setDoc(doc(env.authenticatedContext('boot2', { email: 'rscokart@gmail.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore(), 'users', 'boot2'),
    { uid: 'boot2', email: 'rscokart@gmail.com', displayName: 'X', photoURL: null, status: 'active', role: 'admin', sectionId: 'garcons', broId: null }));
await ko('usurpation : email déclaré différent du jeton',
  setDoc(doc(as({ uid: 'lie1', email: 'lie@patro.be' }), 'users', 'lie1'),
    { uid: 'lie1', email: 'rscokart@gmail.com', displayName: 'X', photoURL: null, status: 'pending', role: null, sectionId: null, broId: null }));

await ok('compte en attente lit sa fiche', getDoc(doc(as(PENDING), 'users', PENDING.uid)));
await ko('compte en attente ne lit pas les autres fiches', getDoc(doc(as(PENDING), 'users', ANIME.uid)));
await ok('animé lit les autres fiches (qui a accès)', getDoc(doc(as(ANIME), 'users', ANIME2.uid)));
await ko('animé ne modifie pas la fiche d\'un autre', updateDoc(doc(as(ANIME), 'users', ANIME2.uid), { broId: 'bro-kid', updatedAt: 'x' }));
await ok('animateur lit toutes les fiches', getDocs(collection(as(ANIMATEUR), 'users')));

await ok('animé relie son compte à son Bro', updateDoc(doc(as(ANIME), 'users', ANIME.uid), { broId: 'bro-kid', updatedAt: 'x' }));
await ko('animé ne se donne pas le rôle animateur', updateDoc(doc(as(ANIME), 'users', ANIME.uid), { role: 'animateur' }));
await ko('compte en attente ne s\'active pas', updateDoc(doc(as(PENDING), 'users', PENDING.uid), { status: 'active' }));
await ok('animateur valide un compte', updateDoc(doc(as(ANIMATEUR), 'users', PENDING.uid), { status: 'active', role: 'anime', sectionId: 'garcons', updatedAt: 'x', updatedBy: 'anim' }));
await ko('animateur ne nomme pas un admin', updateDoc(doc(as(ANIMATEUR), 'users', ANIME.uid), { role: 'admin' }));
await ko('animateur ne touche pas à un admin', updateDoc(doc(as(ANIMATEUR), 'users', ADMIN.uid), { status: 'disabled' }));
await ok('admin nomme un admin', updateDoc(doc(as(ADMIN), 'users', ANIME2.uid), { role: 'admin', updatedAt: 'x' }));
await ko('animateur ne supprime pas un compte', deleteDoc(doc(as(ANIMATEUR), 'users', NEW.uid)));
await ok('admin supprime un compte', deleteDoc(doc(as(ADMIN), 'users', NEW.uid)));

// --- global ---
await ok('animé lit la saison en cours', getDoc(doc(as(ANIME), 'appState', 'current')));
await ko('animateur ne change pas la saison', setDoc(doc(as(ANIMATEUR), 'appState', 'current'), { seasonId: '2027-2028' }));
await ok('admin change la saison', setDoc(doc(as(ADMIN), 'appState', 'current'), { seasonId: '2026-2027' }));
await ko('animateur ne crée pas de saison', setDoc(doc(as(ANIMATEUR), 'seasons', '2027-2028'), { status: 'creating' }));
await ok('admin crée une saison', setDoc(doc(as(ADMIN), 'seasons', '2027-2028'), { status: 'creating' }));
await ok('animé enregistre son jeton de notification', setDoc(doc(as(ANIME), 'fcmTokens', 'tok1'), { token: 'tok1' }));
await ko('animé ne lit pas les jetons', getDocs(collection(as(ANIME), 'fcmTokens')));
await ko('anonyme n\'enregistre pas de jeton', setDoc(doc(anonymous(), 'fcmTokens', 'tok2'), { token: 'tok2' }));

await env.cleanup();

console.log(`\n${passed} cas réussis, ${failures.length} en échec.`);
if (failures.length) {
  console.log('\nÉCHECS :');
  failures.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
