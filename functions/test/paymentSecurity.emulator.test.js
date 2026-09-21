// Tests du socle de sécurité sur l'émulateur Firestore. À lancer depuis la
// racine : pnpm test:functions (l'émulateur fournit FIRESTORE_EMULATOR_HOST).
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const totp = require("../lib/totp");
const security = require("../lib/paymentSecurity");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Ces tests écrivent dans Firestore : ils ne tournent que sur l'émulateur.");
}

initializeApp({ projectId: "patro-rules-test" });
const db = getFirestore();

const NOW = 1_800_000_000_000;
const IBAN = "BE68 5390 0754 7034";
const IBAN_2 = "BE71 0961 2345 6769";

const authOf = (uid, { ageSeconds = 30, email = `${uid}@patro.be`, provider = "google.com" } = {}) => ({
  uid,
  token: { email, auth_time: NOW / 1000 - ageSeconds, firebase: { sign_in_provider: provider } },
});
const ADMIN = authOf("admin1");
const opts = (shiftSeconds = 0) => ({ nowMs: NOW + shiftSeconds * 1000 });
/** L'admin, reconnecté 30 s avant l'instant simulé. */
const adminAt = (shiftSeconds) => authOf('admin1', { ageSeconds: 30 - shiftSeconds });

const rejects = (promise, reason) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof security.SecurityError, `erreur inattendue : ${error}`);
    assert.equal(error.reason, reason);
    return true;
  });

const auditTypes = async () =>
  (await db.collection("auditLog").get()).docs.map((d) => d.data().type).sort();

async function reset() {
  for (const name of ["users", "paymentSecurity", "paymentSettings", "auditLog"]) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/admin1").set({ role: "admin", status: "active", sectionId: "garcons", email: "admin1@patro.be" });
  await db.doc("users/anim1").set({ role: "animateur", status: "active", sectionId: "garcons" });
  await db.doc("users/kid1").set({ role: "anime", status: "active", sectionId: "garcons" });
  await db.doc("users/old1").set({ role: "admin", status: "disabled", sectionId: "garcons" });
}

/** Relie une app d'authentification à l'admin et renvoie son secret. */
async function enroll(shift = 0) {
  const { secret } = await security.startEnrollment(db, ADMIN, {}, opts(shift));
  const code = totp.codeForStep(secret, totp.stepAt(NOW + shift * 1000));
  await security.confirmEnrollment(db, ADMIN, { code }, opts(shift));
  return secret;
}
const codeAt = (secret, shift) => totp.codeForStep(secret, totp.stepAt(NOW + shift * 1000));

test("seul un admin actif passe", async () => {
  await reset();
  await rejects(security.getStatus(db, null), "signed-out");
  await rejects(security.getStatus(db, authOf("anim1")), "not-admin");
  await rejects(security.getStatus(db, authOf("kid1")), "not-admin");
  await rejects(security.getStatus(db, authOf("old1")), "not-admin");
  await rejects(security.getStatus(db, authOf("inconnu")), "not-admin");
  await rejects(security.getStatus(db, authOf("admin1", { provider: "anonymous" })), "anonymous");
  assert.deepEqual(await security.getStatus(db, ADMIN), { enrolled: false, enrolledAt: null });
});

test("une connexion de plus de 5 minutes est refusée pour tout geste sensible", async () => {
  await reset();
  const stale = authOf("admin1", { ageSeconds: 6 * 60 });
  await rejects(security.startEnrollment(db, stale, {}, opts()), "recent-login-required");
  await rejects(security.setPaymentAccount(db, stale, { sectionId: "garcons", iban: IBAN, holderName: "Patro", code: "000000" }, opts()), "recent-login-required");
  // Consulter le statut ne demande pas de reconnexion.
  assert.equal((await security.getStatus(db, stale, opts())).enrolled, false);
});

test("relier une app : le secret n'est actif qu'après un premier code juste", async () => {
  await reset();
  const { secret, uri } = await security.startEnrollment(db, ADMIN, {}, opts());
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.equal((await security.getStatus(db, ADMIN)).enrolled, false);

  await rejects(security.confirmEnrollment(db, ADMIN, { code: "000000" }, opts()), "bad-code");
  assert.equal((await security.getStatus(db, ADMIN)).enrolled, false);

  await security.confirmEnrollment(db, ADMIN, { code: codeAt(secret, 0) }, opts());
  assert.equal((await security.getStatus(db, ADMIN)).enrolled, true);
  const stored = (await db.doc("paymentSecurity/admin1").get()).data();
  assert.equal(stored.secret, secret);
  assert.equal(stored.pendingSecret, undefined);
});

test("sans app reliée, impossible de poser un compte", async () => {
  await reset();
  await rejects(
    security.setPaymentAccount(db, ADMIN, { sectionId: "garcons", iban: IBAN, holderName: "Patro Garçons", code: "123456" }, opts()),
    "not-enrolled"
  );
  assert.equal((await db.doc("paymentSettings/garcons").get()).exists, false);
});

test("poser puis changer le compte : l'ancien reste visible, tout est journalisé", async () => {
  await reset();
  const secret = await enroll();

  const first = await security.setPaymentAccount(db, ADMIN,
    { sectionId: "garcons", iban: IBAN, holderName: "  Patro   Garçons ", code: codeAt(secret, 60) }, opts(60));
  assert.deepEqual(first, { sectionId: "garcons", sectionLabel: "Brothers", lastFour: "7034", changed: true, first: true });
  let saved = (await db.doc("paymentSettings/garcons").get()).data();
  assert.equal(saved.iban, "BE68539007547034");
  assert.equal(saved.holderName, "Patro Garçons");
  assert.equal(saved.previousIban, null);

  const second = await security.setPaymentAccount(db, ADMIN,
    { sectionId: "garcons", iban: IBAN_2, holderName: "Patro Garçons", code: codeAt(secret, 120) }, opts(120));
  assert.equal(second.changed, true);
  assert.equal(second.first, false);
  saved = (await db.doc("paymentSettings/garcons").get()).data();
  assert.equal(saved.iban, "BE71096123456769");
  assert.equal(saved.previousIban, "BE68539007547034");
  assert.ok(saved.previousReplacedAt);

  // Les sections sont indépendantes.
  assert.equal((await db.doc("paymentSettings/filles").get()).exists, false);

  assert.deepEqual(await auditTypes(), ["iban.changed", "iban.set", "totp.enroll_started", "totp.enrolled"]);
});

test("saisies invalides : refusées sans consommer de code", async () => {
  await reset();
  const secret = await enroll();
  const code = codeAt(secret, 60);
  const base = { sectionId: "garcons", iban: IBAN, holderName: "Patro", code };

  await rejects(security.setPaymentAccount(db, ADMIN, { ...base, sectionId: "autre" }, opts(60)), "bad-section");
  await rejects(security.setPaymentAccount(db, ADMIN, { ...base, sectionId: "__proto__" }, opts(60)), "bad-section");
  await rejects(security.setPaymentAccount(db, ADMIN, { ...base, iban: "BE68539007547035" }, opts(60)), "bad-iban");
  await rejects(security.setPaymentAccount(db, ADMIN, { ...base, iban: "NL91ABNA0417164300" }, opts(60)), "bad-iban");
  await rejects(security.setPaymentAccount(db, ADMIN, { ...base, holderName: "x" }, opts(60)), "bad-holder");
  await rejects(security.setPaymentAccount(db, ADMIN, { ...base, holderName: "x".repeat(71) }, opts(60)), "bad-holder");

  // Le même code marche encore : aucune des erreurs ci-dessus ne l'a brûlé.
  await security.setPaymentAccount(db, ADMIN, base, opts(60));
});

test("un code ne sert qu'une fois", async () => {
  await reset();
  const secret = await enroll();
  const code = codeAt(secret, 60);
  await security.setPaymentAccount(db, ADMIN, { sectionId: "garcons", iban: IBAN, holderName: "Patro", code }, opts(60));
  await rejects(
    security.setPaymentAccount(db, ADMIN, { sectionId: "garcons", iban: IBAN_2, holderName: "Pirate", code }, opts(61)),
    "bad-code"
  );
  assert.equal((await db.doc("paymentSettings/garcons").get()).data().iban, "BE68539007547034");
});

test("5 codes faux verrouillent 15 minutes, même pour un code juste", async () => {
  await reset();
  const secret = await enroll();
  const attempt = (code, shift) =>
    security.setPaymentAccount(db, ADMIN, { sectionId: "garcons", iban: IBAN_2, holderName: "Pirate", code }, opts(shift));

  for (let i = 0; i < 4; i++) await rejects(attempt("000000", 60), "bad-code");
  await rejects(attempt("000000", 60), "locked");
  await rejects(attempt(codeAt(secret, 90), 90), "locked");
  assert.equal((await db.doc("paymentSettings/garcons").get()).exists, false);

  // Après 15 minutes, un code juste repasse. La connexion, elle, doit être refaite.
  const later = 16 * 60;
  const fresh = { ...ADMIN, token: { ...ADMIN.token, auth_time: (NOW / 1000) + later - 10 } };
  await security.setPaymentAccount(db, fresh,
    { sectionId: "garcons", iban: IBAN, holderName: "Patro", code: codeAt(secret, later) }, opts(later));

  const types = await auditTypes();
  assert.equal(types.filter((t) => t === "code.refused").length, 5);
});

test("remplacer l'app d'authentification exige un code de l'ancienne", async () => {
  await reset();
  const oldSecret = await enroll();

  await rejects(security.startEnrollment(db, adminAt(60), {}, opts(60)), "bad-code");
  await rejects(security.startEnrollment(db, adminAt(60), { code: "000000" }, opts(60)), "bad-code");

  const { secret: newSecret } = await security.startEnrollment(db, adminAt(120), { code: codeAt(oldSecret, 120) }, opts(120));
  assert.notEqual(newSecret, oldSecret);

  // Tant que la nouvelle n'est pas confirmée, l'ancienne reste la seule valable.
  await rejects(
    security.setPaymentAccount(db, adminAt(180), { sectionId: "garcons", iban: IBAN, holderName: "Patro", code: codeAt(newSecret, 180) }, opts(180)),
    "bad-code"
  );
  await security.confirmEnrollment(db, adminAt(240), { code: codeAt(newSecret, 240) }, opts(240));
  await security.setPaymentAccount(db, adminAt(300),
    { sectionId: "garcons", iban: IBAN, holderName: "Patro", code: codeAt(newSecret, 300) }, opts(300));
  await rejects(
    security.setPaymentAccount(db, adminAt(360), { sectionId: "garcons", iban: IBAN_2, holderName: "Patro", code: codeAt(oldSecret, 360) }, opts(360)),
    "bad-code"
  );
});
