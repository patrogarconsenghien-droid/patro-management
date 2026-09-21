// Tests du rappel de boulot sur l'émulateur Firestore (pnpm test:functions).
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const reminder = require("../lib/jobReminder");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Ces tests écrivent dans Firestore : ils ne tournent que sur l'émulateur.");
}
if (getApps().length === 0) initializeApp({ projectId: "patro-rules-test" });
const db = getFirestore();

const NOW = 1_800_000_000_000;
const APP = { appUrl: "https://app.test" };
const G = "seasons/2026-2027/";
const F = "sections/filles/seasons/2026-2027/";
const as = (uid) => ({ uid, token: {} });

const rejects = (promise, reason) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof reminder.ReminderError, `erreur inattendue : ${error}`);
    assert.equal(error.reason, reason);
    return true;
  });

async function wipe(path) {
  const snap = await db.collection(path).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function reset() {
  for (const path of ["users", "mail", `${G}scheduledJobs`, `${G}bros`, `${F}scheduledJobs`, `${F}bros`]) await wipe(path);

  const users = {
    anim: { role: "animateur", status: "active", sectionId: "garcons", displayName: "Max Animateur", email: "max@patro.be" },
    fanim: { role: "animateur", status: "active", sectionId: "filles", displayName: "Zoé", email: "zoe@patro.be" },
    kid: { role: "anime", status: "active", sectionId: "garcons", email: "kid@patro.be", broId: "tom" },
    tom1: { role: "anime", status: "active", sectionId: "garcons", email: "Tom@Patro.be", broId: "tom" },
    tom2: { role: "anime", status: "active", sectionId: "garcons", email: "tom.bis@patro.be", broId: "tom" },
    leo1: { role: "anime", status: "active", sectionId: "garcons", email: "leo@patro.be", broId: "leo" },
    sam1: { role: "anime", status: "active", sectionId: "garcons", email: "sam@patro.be", broId: "sam" },
    ben1: { role: "anime", status: "active", sectionId: "garcons", email: "ben@patro.be", broId: "ben" },
    old1: { role: "anime", status: "disabled", sectionId: "garcons", email: "old@patro.be", broId: "noa" },
    lea1: { role: "anime", status: "active", sectionId: "filles", email: "lea@patro.be", broId: "lea" },
  };
  delete users.kid; // tom a déjà deux comptes, c'est le cas qu'on veut tester
  for (const [uid, data] of Object.entries(users)) await db.doc(`users/${uid}`).set(data);

  // tom et noa n'ont pas répondu ; leo est inscrit ; sam a dit non ; ben est
  // pris ailleurs le même jour ; ugo n'a aucun compte relié.
  for (const id of ["tom", "leo", "sam", "ben", "noa", "ugo"]) await db.doc(`${G}bros/${id}`).set({ name: id });
  await db.doc(`${F}bros/lea`).set({ name: "lea" });

  await db.doc(`${G}scheduledJobs/j1`).set({
    description: "Tondre <la> pelouse", date: "2026-10-03", timeStart: "09:00", location: "Rue Haute 3",
    estimatedHours: 3, brosNeeded: 3,
    registeredBros: [{ broId: "leo" }], unavailableBros: [{ broId: "sam" }],
  });
  await db.doc(`${G}scheduledJobs/j2`).set({
    description: "Autre", date: "2026-10-03", brosNeeded: 1, registeredBros: [{ broId: "ben" }], unavailableBros: [],
  });
  await db.doc(`${G}scheduledJobs/full`).set({
    description: "Complet", date: "2026-10-04", brosNeeded: 1, registeredBros: [{ broId: "leo" }], unavailableBros: [],
  });
  await db.doc(`${F}scheduledJobs/open`).set({
    description: "Ouvert", date: "2026-10-05", brosNeeded: 4, openToOtherSection: true, registeredBros: [], unavailableBros: [],
  });
  await db.doc(`${F}scheduledJobs/closed`).set({
    description: "Fermé", date: "2026-10-05", brosNeeded: 4, registeredBros: [], unavailableBros: [],
  });
}

const j1 = { jobPath: `${G}scheduledJobs/j1`, brosPath: `${G}bros` };

test("seuls les chemins de l'app sont acceptés", () => {
  assert.equal(reminder.parsePath("scheduledJobs/abc", reminder.JOB_PATHS).sectionId, "garcons");
  assert.equal(reminder.parsePath(`${F}scheduledJobs/abc`, reminder.JOB_PATHS).sectionId, "filles");
  for (const bad of ["users/x", "paymentSettings/garcons", "scheduledJobs/a/b", "sections/autre/seasons/s/scheduledJobs/x", "../users/x", "", null]) {
    assert.throws(() => reminder.parsePath(bad, reminder.JOB_PATHS), (e) => e.reason === "bad-path", String(bad));
  }
});

test("réservé aux animateurs de la section", async () => {
  await reset();
  await rejects(reminder.prepareReminder(db, null, j1, APP), "signed-out");
  await rejects(reminder.prepareReminder(db, as("tom1"), j1, APP), "not-manager");
  await rejects(reminder.prepareReminder(db, as("fanim"), j1, APP), "not-manager");
  await rejects(reminder.prepareReminder(db, as("inconnu"), j1, APP), "not-manager");
});

test("relance ceux qui n'ont pas répondu, et seulement eux", async () => {
  await reset();
  const result = await reminder.prepareReminder(db, as("anim"), j1, { ...APP, nowMs: NOW });

  // tom (deux comptes) ; noa n'a qu'un compte désactivé, ugo aucun compte.
  assert.deepEqual([...result.uids].sort(), ["tom1", "tom2"]);
  assert.deepEqual(result.counts, { people: 3, emailed: 2, unreachable: 2 });

  const mails = (await db.collection("mail").get()).docs.map((d) => d.data());
  assert.deepEqual(mails.map((m) => m.to[0]).sort(), ["tom.bis@patro.be", "tom@patro.be"]);
  const mail = mails[0];
  assert.match(mail.message.subject, /^Rappel : Tondre <la> pelouse · samedi 3 octobre$/);
  assert.match(mail.message.text, /Max Animateur te relance/);
  assert.match(mail.message.text, /Quand : samedi 3 octobre à 09:00/);
  assert.match(mail.message.text, /Il manque encore 2 personnes\./);
  assert.match(mail.message.text, /https:\/\/app\.test\/#boulots-scheduled/);
  // La description vient d'un utilisateur : échappée dans le HTML.
  assert.match(mail.message.html, /Tondre &lt;la&gt; pelouse/);
  assert.equal(mail.source.type, "job_reminder");

  const job = (await db.doc(j1.jobPath).get()).data();
  assert.equal(job.reminderCount, 1);
  assert.ok(job.lastReminderAt.garcons);
});

test("pas plus d'un rappel par heure", async () => {
  await reset();
  await reminder.prepareReminder(db, as("anim"), j1, APP);
  await rejects(reminder.prepareReminder(db, as("anim"), j1, APP), "too-soon");
  assert.equal((await db.collection("mail").get()).size, 2);

  await reminder.prepareReminder(db, as("anim"), j1, { ...APP, nowMs: Date.now() + 61 * 60 * 1000 });
  assert.equal((await db.doc(j1.jobPath).get()).data().reminderCount, 2);
});

test("équipe complète ou tout le monde a répondu : rien n'est envoyé", async () => {
  await reset();
  await rejects(reminder.prepareReminder(db, as("anim"), { ...j1, jobPath: `${G}scheduledJobs/full` }, APP), "full");
  await rejects(reminder.prepareReminder(db, as("anim"), { ...j1, jobPath: `${G}scheduledJobs/absent` }, APP), "no-job");

  await db.doc(j1.jobPath).update({
    unavailableBros: ["sam", "tom", "noa", "ugo"].map((broId) => ({ broId })),
  });
  await rejects(reminder.prepareReminder(db, as("anim"), j1, APP), "nobody");
  assert.equal((await db.collection("mail").get()).size, 0);
});

test("boulot de l'autre section : seulement s'il est ouvert, et on relance les siens", async () => {
  await reset();
  await rejects(
    reminder.prepareReminder(db, as("anim"), { jobPath: `${F}scheduledJobs/closed`, brosPath: `${G}bros` }, APP),
    "not-open"
  );
  const result = await reminder.prepareReminder(db, as("anim"), { jobPath: `${F}scheduledJobs/open`, brosPath: `${G}bros` }, APP);
  assert.equal(result.sectionId, "garcons");
  assert.ok(result.uids.includes("leo1") && !result.uids.includes("lea1"));

  // Les animatrices relancent les leurs de leur côté, sans attendre une heure.
  const girls = await reminder.prepareReminder(db, as("fanim"), { jobPath: `${F}scheduledJobs/open`, brosPath: `${F}bros` }, APP);
  assert.deepEqual(girls.uids, ["lea1"]);
});
