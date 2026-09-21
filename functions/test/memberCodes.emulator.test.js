// Tests des codes de paiement permanents des membres du bar (pnpm test:functions).
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const memberCodes = require("../lib/memberCodes");
const publicPage = require("../lib/publicPage");
const requests = require("../lib/paymentRequests");
const { isMemberCode, isValidCommunication, findCommunication } = require("../lib/ogm");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Ces tests écrivent dans Firestore : ils ne tournent que sur l'émulateur.");
}
if (getApps().length === 0) initializeApp({ projectId: "patro-rules-test" });
const db = getFirestore();

const G = "seasons/2026-2027/";
const NEXT = "seasons/2027-2028/";
const F = "sections/filles/seasons/2026-2027/";
const as = (uid) => ({ uid, token: {} });
const digitsOf = (pretty) => pretty.replace(/\D/g, "");

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
    "users", "paymentCodes", "paymentCounters", "paymentSettings", "paymentRequests",
    `${G}members`, `${G}orders`, `${NEXT}members`, `${NEXT}orders`, `${F}members`,
  ]) await wipe(path);

  await db.doc("users/anim").set({ role: "animateur", status: "active", sectionId: "garcons" });
  await db.doc("users/kid").set({ role: "anime", status: "active", sectionId: "garcons" });
  await db.doc("users/fkid").set({ role: "anime", status: "active", sectionId: "filles" });
  await db.doc("users/wait").set({ role: null, status: "pending", sectionId: null });
  if (account) {
    await db.doc("paymentSettings/garcons").set({ sectionId: "garcons", iban: "BE68539007547034", holderName: "Patro Garçons ASBL" });
    await db.doc("paymentSettings/filles").set({ sectionId: "filles", iban: "BE71096123456769", holderName: "Patro Filles ASBL" });
  }
  await db.doc(`${G}members/m1`).set({ name: "Martin", balance: -12.5 });
  await db.doc(`${G}members/m2`).set({ name: "Hugo", balance: 3 });
  await db.doc(`${F}members/f1`).set({ name: "Léa", balance: 0 });
}

const data = async (path) => (await db.doc(path).get()).data();

test("le code d'un membre : créé une fois, le même pour toujours", async () => {
  await reset();
  const first = await memberCodes.getMemberCode(db, as("anim"), { memberPath: `${G}members/m1` });
  const digits = digitsOf(first.communication);
  assert.ok(isValidCommunication(digits) && isMemberCode(digits));
  assert.equal(digits.slice(0, 10), "9100000001");
  assert.equal(first.memberName, "Martin");
  assert.equal(first.iban, "BE68 5390 0754 7034");

  // Redemandé, par un animé cette fois : identique.
  const again = await memberCodes.getMemberCode(db, as("kid"), { memberPath: `${G}members/m1` });
  assert.equal(again.communication, first.communication);
  assert.equal(again.token, first.token);

  // Chacun le sien, et les sections ne se marchent pas dessus.
  const hugo = await memberCodes.getMemberCode(db, as("anim"), { memberPath: `${G}members/m2` });
  assert.equal(digitsOf(hugo.communication).slice(0, 10), "9100000002");
  const lea = await memberCodes.getMemberCode(db, as("fkid"), { memberPath: `${F}members/f1` });
  assert.equal(digitsOf(lea.communication).slice(0, 10), "9200000001");
  assert.equal(lea.iban, "BE71 0961 2345 6769");

  // Le même membre, vu depuis la saison suivante : même code.
  await db.doc(`${NEXT}members/m1`).set({ name: "Martin D.", balance: 0 });
  const nextSeason = await memberCodes.getMemberCode(db, as("anim"), { memberPath: `${NEXT}members/m1` });
  assert.equal(nextSeason.communication, first.communication);
  assert.equal(nextSeason.memberName, "Martin D.");
});

test("QR de rechargement : pas de montant, la communication du membre", async () => {
  await reset();
  const code = await memberCodes.getMemberCode(db, as("anim"), { memberPath: `${G}members/m1` });
  const lines = code.qrPayload.split("\n");
  assert.equal(lines.length, 11);
  assert.equal(lines[6], "BE68539007547034");
  assert.equal(lines[7], ""); // montant libre
  assert.equal(lines[9], code.communication);
});

test("QR de remboursement : le montant de la dette est proposé, la communication ne change pas", async () => {
  await reset();
  const m1 = { memberPath: `${G}members/m1` };
  const free = await memberCodes.getMemberCode(db, as("anim"), m1);
  const debt = await memberCodes.getMemberCode(db, as("anim"), { ...m1, amountCents: 1250 });
  assert.equal(debt.communication, free.communication);
  assert.equal(debt.amountCents, 1250);
  assert.equal(debt.qrPayload.split("\n")[7], "EUR12.50");
  assert.equal(free.amountCents, null);

  for (const bad of [0, -5, 12.5, 100_001, "1250"]) {
    await rejects(memberCodes.getMemberCode(db, as("anim"), { ...m1, amountCents: bad }), "bad-amount");
  }
  // Le lien public du membre, lui, reste à montant libre.
  assert.equal((await publicPage.getPublicPage(db, { token: free.token })).amountCents, null);
});

test("qui peut afficher un code", async () => {
  await reset();
  const m1 = { memberPath: `${G}members/m1` };
  await rejects(memberCodes.getMemberCode(db, null, m1), "signed-out");
  await rejects(memberCodes.getMemberCode(db, as("wait"), m1), "not-in-section");
  await rejects(memberCodes.getMemberCode(db, as("fkid"), m1), "not-in-section");
  await rejects(memberCodes.getMemberCode(db, as("inconnu"), m1), "not-in-section");
  await rejects(memberCodes.getMemberCode(db, as("anim"), { memberPath: `${G}members/absent` }), "no-member");
  await rejects(memberCodes.getMemberCode(db, as("anim"), { memberPath: "users/anim" }), "bad-path");

  await reset({ account: false });
  await rejects(memberCodes.getMemberCode(db, as("anim"), m1), "no-account");
});

test("page publique d'un membre : montant libre, jeton non devinable", async () => {
  await reset();
  const code = await memberCodes.getMemberCode(db, as("anim"), { memberPath: `${G}members/m1` });
  const page = await publicPage.getPublicPage(db, { token: code.token });
  assert.equal(page.status, "open");
  assert.equal(page.kind, "member");
  assert.equal(page.label, "Compte bar · Martin");
  assert.equal(page.amountCents, null);
  assert.equal(page.communication, code.communication);
  assert.equal(page.token, undefined);
  assert.equal(JSON.stringify(page).includes("-12.5"), false); // le solde ne sort pas

  await rejects(publicPage.getPublicPage(db, { token: "abcdefghijklmnopqrstuv" }), "no-request");
  await rejects(publicPage.getPublicPage(db, { token: "court" }), "no-request");
});

test("virement reçu avec le code : le montant versé est crédité, une seule fois", async () => {
  await reset();
  const code = await memberCodes.getMemberCode(db, as("anim"), { memberPath: `${G}members/m1` });
  const communication = digitsOf(code.communication);

  // Le libellé du relevé, tel que la banque le renvoie.
  assert.equal(findCommunication(`VIREMENT ${code.communication} MARTIN`), communication);

  const credit = (receivedCents, bankRef) =>
    memberCodes.creditMemberByCode(db, { communication, receivedCents, seasonBase: G, bankRef, nowMs: Date.UTC(2026, 9, 3) });

  const first = await credit(2500, "tx-001");
  assert.equal(first.credited, true);
  assert.equal((await data(`${G}members/m1`)).balance, 12.5);
  const order = await data(`${G}orders/bank-tx-001`);
  assert.deepEqual(
    { type: order.type, amount: order.amount, paymentMethod: order.paymentMethod, memberId: order.memberId },
    { type: "repayment", amount: 25, paymentMethod: "account", memberId: "m1" }
  );

  // Le même virement relu à la synchronisation suivante : rien ne bouge.
  assert.deepEqual(await credit(2500, "tx-001"), { credited: false, reason: "already-credited" });
  assert.equal((await data(`${G}members/m1`)).balance, 12.5);

  // Un second virement, lui, s'ajoute : c'est un rechargement.
  await credit(1000, "tx-002");
  assert.equal((await data(`${G}members/m1`)).balance, 22.5);
  assert.equal((await data(`${G}orders/bank-tx-002`)).type, "recharge");

  assert.deepEqual(
    await memberCodes.creditMemberByCode(db, { communication: "910000009921", receivedCents: 500, seasonBase: G, bankRef: "tx-003" }),
    { credited: false, reason: "unknown-code" }
  );
  await assert.rejects(credit(0, "tx-004"));
  await assert.rejects(credit(500, ""));
});
