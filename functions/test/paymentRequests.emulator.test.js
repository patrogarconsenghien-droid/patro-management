// Tests des demandes de paiement sur l'émulateur Firestore (pnpm test:functions).
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const requests = require("../lib/paymentRequests");
const { isValidCommunication } = require("../lib/ogm");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Ces tests écrivent dans Firestore : ils ne tournent que sur l'émulateur.");
}
if (getApps().length === 0) initializeApp({ projectId: "patro-rules-test" });
const db = getFirestore();

const NOW = Date.UTC(2026, 9, 3, 10, 0, 0);
const G = "seasons/2026-2027/";
const F = "sections/filles/seasons/2026-2027/";
const as = (uid) => ({ uid, token: {} });
const at = { nowMs: NOW };

const rejects = (promise, reason) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof requests.PaymentError, `erreur inattendue : ${error.stack || error}`);
    assert.equal(error.reason, reason);
    return true;
  });

async function wipe(path) {
  const snap = await db.collection(path).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function reset({ account = true } = {}) {
  for (const path of [
    "users", "paymentRequests", "paymentCounters", "paymentSettings", "auditLog",
    `${G}jobs`, `${G}members`, `${G}orders`, `${G}financialTransactions`, `${F}jobs`, "seasons/2025-2026/jobs",
  ]) await wipe(path);

  await db.doc("users/anim").set({ role: "animateur", status: "active", sectionId: "garcons", displayName: "Max" });
  await db.doc("users/fanim").set({ role: "animateur", status: "active", sectionId: "filles", displayName: "Zoé" });
  await db.doc("users/kid").set({ role: "anime", status: "active", sectionId: "garcons" });
  if (account) {
    await db.doc("paymentSettings/garcons").set({ sectionId: "garcons", iban: "BE68539007547034", holderName: "Patro Garçons ASBL" });
  }

  await db.doc(`${G}jobs/a`).set({ description: "Tondre la pelouse", broName: "Tom", date: "2026-10-01", total: 30, isPaid: false });
  await db.doc(`${G}jobs/b`).set({ description: "Tailler la haie", broName: "Léo", date: "2026-10-01", total: 15.5, isPaid: false });
  await db.doc(`${G}jobs/paid`).set({ description: "Déjà payé", broName: "Tom", total: 20, isPaid: true });
  await db.doc(`${G}jobs/zero`).set({ description: "Sans montant", broName: "Tom", total: 0, isPaid: false });
  await db.doc("seasons/2025-2026/jobs/old").set({ description: "Ancien", total: 10, isPaid: false });
  await db.doc(`${F}jobs/f1`).set({ description: "Chez les filles", total: 10, isPaid: false });
  await db.doc(`${G}members/m1`).set({ name: "Martin", balance: -12.5 });
  await db.doc(`${G}members/m2`).set({ name: "Hugo", balance: 3 });
}

const jobsAB = { jobPaths: [`${G}jobs/a`, `${G}jobs/b`], payerName: "  Mme   Dupont ", payerPhone: "0470 12 34 56" };
const data = async (path) => (await db.doc(path).get()).data();

test("créer une demande : réservé aux animateurs de la section, compte requis", async () => {
  await reset();
  await rejects(requests.createJobsRequest(db, null, jobsAB, at), "signed-out");
  await rejects(requests.createJobsRequest(db, as("kid"), jobsAB, at), "not-manager");
  await rejects(requests.createJobsRequest(db, as("fanim"), jobsAB, at), "not-manager");
  await rejects(requests.createJobsRequest(db, as("anim"), { jobPaths: [`${F}jobs/f1`] }, at), "not-manager");

  await reset({ account: false });
  await rejects(requests.createJobsRequest(db, as("anim"), jobsAB, at), "no-account");
});

test("demande groupée : montant relu sur les boulots, communication valide, boulots marqués", async () => {
  await reset();
  const created = await requests.createJobsRequest(db, as("anim"), jobsAB, at);
  assert.equal(created.amountCents, 4550);
  assert.ok(isValidCommunication(created.communication));
  assert.equal(created.communication.slice(0, 10), "2610000001");
  assert.match(created.token, /^[A-Za-z0-9_-]{22}$/);

  const request = await data(`paymentRequests/${created.id}`);
  assert.equal(request.status, "pending");
  assert.equal(request.label, "Boulots · Mme Dupont");
  assert.deepEqual(request.targets.map((t) => t.amountCents), [3000, 1550]);
  assert.equal((await data(`${G}jobs/a`)).paymentRequestId, created.id);

  // Le compteur avance, par section et par année.
  const second = await requests.createBarRequest(db, as("anim"), { memberPath: `${G}members/m1`, amountCents: 2000 }, at);
  assert.equal(second.communication.slice(0, 10), "2610000002");
  assert.notEqual(second.token, created.token);
});

test("boulots refusés : déjà payé, déjà demandé, sans montant, saisons mêlées, chemins piégés", async () => {
  await reset();
  const make = (jobPaths) => requests.createJobsRequest(db, as("anim"), { jobPaths }, at);
  await rejects(make([`${G}jobs/paid`]), "already-paid");
  await rejects(make([`${G}jobs/zero`]), "no-amount");
  await rejects(make([`${G}jobs/absent`]), "no-job");
  await rejects(make([`${G}jobs/a`, "seasons/2025-2026/jobs/old"]), "mixed-seasons");
  await rejects(make([]), "bad-jobs");
  await rejects(make("pas une liste"), "bad-jobs");
  for (const bad of ["users/anim", "paymentSettings/garcons", `${G}members/m1`, "../jobs/a", `${G}jobs/a/x`]) {
    await rejects(make([bad]), "bad-path");
  }

  await make([`${G}jobs/a`]);
  await rejects(make([`${G}jobs/a`, `${G}jobs/b`]), "already-requested");
  // Rien n'a été réservé pour b par la tentative ratée.
  assert.equal((await data(`${G}jobs/b`)).paymentRequestId, undefined);
});

test("annuler libère les boulots, et seulement une demande en attente", async () => {
  await reset();
  const created = await requests.createJobsRequest(db, as("anim"), jobsAB, at);
  await rejects(requests.cancelRequest(db, as("kid"), { requestId: created.id }), "not-manager");
  await rejects(requests.cancelRequest(db, as("fanim"), { requestId: created.id }), "not-manager");

  await requests.cancelRequest(db, as("anim"), { requestId: created.id });
  assert.equal((await data(`paymentRequests/${created.id}`)).status, "cancelled");
  assert.equal((await data(`${G}jobs/a`)).paymentRequestId, undefined);
  await rejects(requests.cancelRequest(db, as("anim"), { requestId: created.id }), "not-pending");
  await rejects(requests.markReceived(db, as("anim"), { requestId: created.id }, at), "not-pending");

  // Les boulots peuvent repartir dans une nouvelle demande.
  await requests.createJobsRequest(db, as("anim"), jobsAB, at);
});

test("paiement reçu pour des boulots : payés par virement, surplus en pourboire", async () => {
  await reset();
  const created = await requests.createJobsRequest(db, as("anim"), jobsAB, at);
  await rejects(requests.markReceived(db, as("kid"), { requestId: created.id }, at), "not-manager");
  await rejects(requests.markReceived(db, as("anim"), { requestId: created.id, receivedCents: 4000 }, at), "underpaid");
  assert.equal((await data(`${G}jobs/a`)).isPaid, false);

  const result = await requests.markReceived(db, as("anim"), { requestId: created.id, receivedCents: 5000 }, at);
  assert.equal(result.tipCents, 450);

  for (const id of ["a", "b"]) {
    const job = await data(`${G}jobs/${id}`);
    assert.equal(job.isPaid, true);
    assert.equal(job.paymentMethod, "account");
    assert.equal(job.paidAt, new Date(NOW).toISOString());
  }
  assert.equal((await data(`${G}jobs/a`)).tip, 4.5);
  assert.equal((await data(`${G}jobs/b`)).tip, undefined);

  const tips = (await db.collection(`${G}financialTransactions`).get()).docs.map((d) => d.data());
  assert.equal(tips.length, 1);
  assert.deepEqual(
    { type: tips[0].type, amount: tips[0].amount, paymentMethod: tips[0].paymentMethod, description: tips[0].description },
    { type: "income", amount: 4.5, paymentMethod: "account", description: "Pourboire · Boulots · Mme Dupont" }
  );

  const request = await data(`paymentRequests/${created.id}`);
  assert.equal(request.status, "paid");
  assert.equal(request.receivedCents, 5000);
  assert.equal(request.settledBy.type, "manual");
  const audit = (await db.collection("auditLog").get()).docs.map((d) => d.data());
  assert.equal(audit[0].type, "payment.marked_received");
  assert.equal(audit[0].actorUid, "anim");

  await rejects(requests.markReceived(db, as("anim"), { requestId: created.id }, at), "not-pending");
});

test("montant exact : pas de pourboire, pas de rentrée en trop", async () => {
  await reset();
  const created = await requests.createJobsRequest(db, as("anim"), { jobPaths: [`${G}jobs/a`] }, at);
  const result = await requests.markReceived(db, as("anim"), { requestId: created.id }, at);
  assert.equal(result.receivedCents, 3000);
  assert.equal(result.tipCents, 0);
  assert.equal((await db.collection(`${G}financialTransactions`).get()).size, 0);
});

test("compte bar : tout le montant reçu est crédité", async () => {
  await reset();
  const make = (amountCents, memberPath = `${G}members/m1`) =>
    requests.createBarRequest(db, as("anim"), { memberPath, amountCents }, at);
  for (const bad of [0, 50, 50_001, 12.5, "2000", null]) await rejects(make(bad), "bad-amount");
  await rejects(make(2000, `${G}members/absent`), "no-member");
  await rejects(make(2000, `${G}jobs/a`), "bad-path");

  // Martin doit 12,50 € : il verse 25 € au lieu des 20 demandés.
  const created = await make(2000);
  await requests.markReceived(db, as("anim"), { requestId: created.id, receivedCents: 2500 }, at);
  assert.equal((await data(`${G}members/m1`)).balance, 12.5);
  const orders = (await db.collection(`${G}orders`).get()).docs.map((d) => d.data());
  assert.equal(orders.length, 1);
  assert.deepEqual(
    { type: orders[0].type, amount: orders[0].amount, paymentMethod: orders[0].paymentMethod, memberId: orders[0].memberId },
    { type: "repayment", amount: 25, paymentMethod: "account", memberId: "m1" }
  );

  // Hugo est en positif : c'est un rechargement. Un montant inférieur est crédité tel quel.
  const hugo = await make(2000, `${G}members/m2`);
  await requests.markReceived(db, as("anim"), { requestId: hugo.id, receivedCents: 1000 }, at);
  assert.equal((await data(`${G}members/m2`)).balance, 13);
});

test("page publique : le jeton seul, et rien de trop", async () => {
  await reset();
  const created = await requests.createJobsRequest(db, as("anim"), jobsAB, at);
  for (const bad of ["", null, "court", "x".repeat(60), "../etc/passwd", created.token.slice(0, -1) + "_"]) {
    await rejects(requests.getPublicPage(db, { token: bad }), "no-request");
  }

  const page = await requests.getPublicPage(db, { token: created.token });
  assert.equal(page.status, "pending");
  assert.equal(page.amountCents, 4550);
  assert.equal(page.iban, "BE68 5390 0754 7034");
  assert.equal(page.holderName, "Patro Garçons ASBL");
  assert.match(page.communication, /^\+\+\+261\/0000\/001\d\d\+\+\+$/);
  assert.equal(page.qrPayload.split("\n")[7], "EUR45.50");
  assert.equal(page.qrPayload.split("\n")[9], page.communication);
  // Ni le nom des jeunes, ni celui du client, ni qui a créé la demande.
  const dumped = JSON.stringify(page);
  for (const secret of ["Tom", "Léo", "Dupont", "0470", "Max", "anim", created.id]) {
    assert.equal(dumped.includes(secret), false, `fuite : ${secret}`);
  }

  // Le compte change : le lien suit le nouveau compte.
  await db.doc("paymentSettings/garcons").update({ iban: "BE71096123456769" });
  assert.equal((await requests.getPublicPage(db, { token: created.token })).iban, "BE71 0961 2345 6769");

  // Payée : plus de QR ni de compte, seulement l'état.
  await requests.markReceived(db, as("anim"), { requestId: created.id }, at);
  const paid = await requests.getPublicPage(db, { token: created.token });
  assert.equal(paid.status, "paid");
  assert.equal(paid.qrPayload, undefined);
  assert.equal(paid.iban, undefined);
});
