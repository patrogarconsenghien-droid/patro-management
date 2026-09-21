// Cœur du socle de sécurité des paiements, sans dépendance à Cloud Functions :
// tout prend `db` et l'heure en paramètre, pour être testé sur l'émulateur
// Firestore (voir test/paymentSecurity.emulator.test.js).
//
// Trois règles tiennent l'ensemble :
//   1. Le numéro de compte (paymentSettings/{section}) n'est écrit que d'ici.
//      Les règles Firestore refusent toute écriture venant de l'app.
//   2. Le changer exige un admin, connecté depuis moins de 5 minutes, ET un
//      code de son app d'authentification. Une session volée ne suffit pas.
//   3. Chaque geste sensible laisse une ligne dans auditLog, en ajout seul.
const { FieldValue } = require("firebase-admin/firestore");
const totp = require("./totp");
const { normalizeIban, isValidBelgianIban, lastFour } = require("./iban");

const SECTIONS = { garcons: "Brothers", filles: "Grandes" };
const RECENT_LOGIN_SECONDS = 5 * 60;
const MAX_FAILED_CODES = 5;
const LOCK_MINUTES = 15;
// Le nom du bénéficiaire est limité à 70 caractères dans un QR de virement SEPA.
const HOLDER_NAME_MAX = 70;

/** Erreur métier : `code` suit les codes d'erreur des fonctions appelables. */
class SecurityError extends Error {
  constructor(code, reason, message) {
    super(message);
    this.code = code;
    this.reason = reason;
  }
}

const securityRef = (db, uid) => db.doc(`paymentSecurity/${uid}`);

function audit(db, entry) {
  return db.collection("auditLog").add({ ...entry, at: FieldValue.serverTimestamp() });
}

/**
 * Exige un compte admin actif. Avec `recent`, exige en plus une connexion
 * Google de moins de 5 minutes : l'app redemande le compte juste avant.
 */
async function requireAdmin(db, auth, { nowMs = Date.now(), recent = true } = {}) {
  if (!auth || !auth.uid) {
    throw new SecurityError("unauthenticated", "signed-out", "Connexion requise.");
  }
  const token = auth.token || {};
  if (token.firebase && token.firebase.sign_in_provider === "anonymous") {
    throw new SecurityError("permission-denied", "anonymous", "Compte non autorisé.");
  }

  const snap = await db.doc(`users/${auth.uid}`).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || profile.status !== "active" || profile.role !== "admin") {
    throw new SecurityError("permission-denied", "not-admin", "Réservé à l'admin.");
  }

  if (recent) {
    const age = nowMs / 1000 - Number(token.auth_time || 0);
    if (!(age >= 0 && age <= RECENT_LOGIN_SECONDS)) {
      throw new SecurityError(
        "failed-precondition", "recent-login-required",
        "Reconnecte-toi à Google pour confirmer que c'est bien toi."
      );
    }
  }

  return { uid: auth.uid, email: String(token.email || profile.email || "").toLowerCase() };
}

/**
 * Vérifie un code contre `field` (« secret » ou « pendingSecret ») de l'admin.
 * Compte les échecs : 5 codes faux verrouillent 15 minutes. Un code accepté
 * est mémorisé et ne peut pas resservir.
 */
async function consumeCode(db, actor, code, { nowMs = Date.now(), field = "secret", action }) {
  const ref = securityRef(db, actor.uid);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};

    if (data.lockedUntil && data.lockedUntil.toMillis() > nowMs) {
      return { ok: false, reason: "locked", lockedUntil: data.lockedUntil.toMillis() };
    }
    const secret = data[field];
    if (!secret) return { ok: false, reason: "not-enrolled" };

    const step = totp.verifyCode(secret, code, { nowMs, afterStep: data.lastUsedStep ?? -1 });
    if (step === null) {
      const failed = (data.failedAttempts || 0) + 1;
      const locked = failed >= MAX_FAILED_CODES;
      tx.set(ref, {
        failedAttempts: locked ? 0 : failed,
        lockedUntil: locked ? new Date(nowMs + LOCK_MINUTES * 60 * 1000) : null,
      }, { merge: true });
      return { ok: false, reason: locked ? "locked-now" : "bad-code", remaining: MAX_FAILED_CODES - failed };
    }

    tx.set(ref, { lastUsedStep: step, failedAttempts: 0, lockedUntil: null }, { merge: true });
    return { ok: true };
  });

  if (outcome.ok) return;

  if (outcome.reason === "not-enrolled") {
    throw new SecurityError(
      "failed-precondition", "not-enrolled",
      "Aucune app d'authentification n'est encore reliée à ce compte."
    );
  }
  if (outcome.reason === "locked") {
    throw new SecurityError(
      "resource-exhausted", "locked",
      "Trop de codes faux. Réessaie dans quelques minutes."
    );
  }

  await audit(db, {
    type: "code.refused",
    action,
    actorUid: actor.uid,
    actorEmail: actor.email,
    lockedNow: outcome.reason === "locked-now",
  });
  throw new SecurityError(
    outcome.reason === "locked-now" ? "resource-exhausted" : "permission-denied",
    outcome.reason === "locked-now" ? "locked" : "bad-code",
    outcome.reason === "locked-now"
      ? `Trop de codes faux : verrouillé ${LOCK_MINUTES} minutes.`
      : "Code incorrect."
  );
}

/** L'app d'authentification est-elle reliée ? */
async function getStatus(db, auth, opts = {}) {
  const actor = await requireAdmin(db, auth, { ...opts, recent: false });
  const snap = await securityRef(db, actor.uid).get();
  const data = snap.exists ? snap.data() : {};
  return {
    enrolled: Boolean(data.secret),
    enrolledAt: data.enrolledAt ? data.enrolledAt.toMillis() : null,
  };
}

/**
 * Prépare une nouvelle app d'authentification. Si une app est déjà reliée, il
 * faut un code de celle-ci : on ne remplace pas le second facteur avec le seul
 * premier. Le nouveau secret reste « en attente » jusqu'à confirmEnrollment.
 */
async function startEnrollment(db, auth, { code } = {}, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const actor = await requireAdmin(db, auth, { nowMs });
  const ref = securityRef(db, actor.uid);
  const snap = await ref.get();
  const replacing = Boolean(snap.exists && snap.data().secret);

  if (replacing) await consumeCode(db, actor, code, { nowMs, action: "totp.replace" });

  const secret = totp.generateSecret();
  await ref.set({ pendingSecret: secret, pendingAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(db, {
    type: replacing ? "totp.replace_started" : "totp.enroll_started",
    actorUid: actor.uid,
    actorEmail: actor.email,
  });

  return { secret, uri: totp.otpauthUri(secret, { account: actor.email || actor.uid }) };
}

/** Confirme l'app scannée : le premier code prouve qu'elle est bien réglée. */
async function confirmEnrollment(db, auth, { code } = {}, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const actor = await requireAdmin(db, auth, { nowMs });
  await consumeCode(db, actor, code, { nowMs, field: "pendingSecret", action: "totp.confirm" });

  const ref = securityRef(db, actor.uid);
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    tx.set(ref, {
      secret: data.pendingSecret,
      pendingSecret: FieldValue.delete(),
      pendingAt: FieldValue.delete(),
      enrolledAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await audit(db, { type: "totp.enrolled", actorUid: actor.uid, actorEmail: actor.email });
  return { enrolled: true };
}

/** Pose ou remplace le compte de paiement d'une section. */
async function setPaymentAccount(db, auth, { sectionId, iban, holderName, code } = {}, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const actor = await requireAdmin(db, auth, { nowMs });

  if (!Object.hasOwn(SECTIONS, sectionId)) {
    throw new SecurityError("invalid-argument", "bad-section", "Section inconnue.");
  }
  if (!isValidBelgianIban(iban)) {
    throw new SecurityError(
      "invalid-argument", "bad-iban",
      "Ce numéro n'est pas un IBAN belge valide. Vérifie chaque chiffre."
    );
  }
  const name = String(holderName || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > HOLDER_NAME_MAX) {
    throw new SecurityError(
      "invalid-argument", "bad-holder",
      `Le nom du titulaire doit faire entre 2 et ${HOLDER_NAME_MAX} caractères.`
    );
  }

  // Le code en dernier : une saisie invalide ne doit pas en gaspiller un.
  await consumeCode(db, actor, code, { nowMs, action: "iban.change" });

  const clean = normalizeIban(iban);
  const ref = db.doc(`paymentSettings/${sectionId}`);
  const previous = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? snap.data() : null;
    const changed = !before || before.iban !== clean;
    tx.set(ref, {
      sectionId,
      iban: clean,
      holderName: name,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email,
      // L'ancien compte reste visible un temps à côté du nouveau, pour qu'un
      // animateur remarque un changement qu'il n'attendait pas.
      previousIban: changed ? (before ? before.iban : null) : (before.previousIban ?? null),
      previousHolderName: changed ? (before ? before.holderName : null) : (before.previousHolderName ?? null),
      previousReplacedAt: changed && before ? FieldValue.serverTimestamp() : (before ? before.previousReplacedAt ?? null : null),
    });
    return before;
  });

  await audit(db, {
    type: previous ? "iban.changed" : "iban.set",
    sectionId,
    actorUid: actor.uid,
    actorEmail: actor.email,
    iban: clean,
    holderName: name,
    previousIban: previous ? previous.iban : null,
    previousHolderName: previous ? previous.holderName : null,
  });

  return {
    sectionId,
    sectionLabel: SECTIONS[sectionId],
    lastFour: lastFour(clean),
    changed: !previous || previous.iban !== clean,
    first: !previous,
  };
}

module.exports = {
  SECTIONS,
  SecurityError,
  requireAdmin,
  getStatus,
  startEnrollment,
  confirmEnrollment,
  setPaymentAccount,
};
