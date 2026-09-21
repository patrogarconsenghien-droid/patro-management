// Demandes de paiement : un montant, une communication structurée unique et un
// lien public, pour des boulots faits ou pour recharger un compte bar. Sans
// dépendance à Cloud Functions, testé sur l'émulateur Firestore.
//
// Rien ici ne vient de l'app sans être revérifié : les montants sont relus sur
// les boulots, le compte bénéficiaire vient de paymentSettings, et une demande
// créée ne change plus (montant, communication, cibles). Pour corriger, on
// l'annule et on en crée une autre.
const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { buildCommunication, formatCommunication } = require("./ogm");
const { buildEpcPayload } = require("./epcQr");
const { formatIban } = require("./iban");

const SECTIONS = { garcons: "Brothers", filles: "Grandes" };
const DEFAULT_SECTION = "garcons";
const MAX_JOBS_PER_REQUEST = 20;
const BAR_MIN_CENTS = 100;
const BAR_MAX_CENTS = 50_000;

class PaymentError extends Error {
  constructor(code, reason, message) {
    super(message);
    this.code = code;
    this.reason = reason;
  }
}

const ID = "[A-Za-z0-9_-]{1,100}";

/** Document d'une collection de saison : les trois formes de chemin de l'app. */
function parseSeasonDoc(path, collectionName) {
  const text = String(path || "");
  const shapes = [
    [new RegExp(`^${collectionName}/(${ID})$`), (m) => ({ sectionId: DEFAULT_SECTION, base: "", id: m[1] })],
    [new RegExp(`^seasons/(${ID})/${collectionName}/(${ID})$`), (m) => ({ sectionId: DEFAULT_SECTION, base: `seasons/${m[1]}/`, id: m[2] })],
    [new RegExp(`^sections/(${ID})/seasons/(${ID})/${collectionName}/(${ID})$`), (m) => ({ sectionId: m[1], base: `sections/${m[1]}/seasons/${m[2]}/`, id: m[3] })],
  ];
  for (const [re, parse] of shapes) {
    const match = re.exec(text);
    if (match) {
      const parsed = parse(match);
      if (Object.hasOwn(SECTIONS, parsed.sectionId)) return { ...parsed, path: text };
    }
  }
  throw new PaymentError("invalid-argument", "bad-path", "Élément introuvable.");
}

async function requireManager(db, auth, sectionId) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  const snap = await db.doc(`users/${auth.uid}`).get();
  const profile = snap.exists ? snap.data() : null;
  const manages = profile && profile.status === "active"
    && (profile.role === "admin" || (profile.role === "animateur" && profile.sectionId === sectionId));
  if (!manages) throw new PaymentError("permission-denied", "not-manager", "Réservé aux animateurs de la section.");
  return { uid: auth.uid, name: profile.displayName || profile.email || "Un animateur" };
}

const toCents = (euros) => Math.round(Number(euros) * 100);
const cleanText = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const newToken = () => crypto.randomBytes(16).toString("base64url"); // 128 bits, non devinable

async function requireSettings(db, sectionId) {
  const snap = await db.doc(`paymentSettings/${sectionId}`).get();
  if (!snap.exists) {
    throw new PaymentError(
      "failed-precondition", "no-account",
      "Aucun compte de paiement n'est enregistré pour cette section. L'admin doit le faire dans Réglages."
    );
  }
  return snap.data();
}

/** Réserve le prochain numéro de la section pour l'année, dans la transaction. */
async function nextCommunication(tx, db, sectionId, nowMs) {
  const year = new Date(nowMs).getUTCFullYear();
  const ref = db.doc(`paymentCounters/${sectionId}-${year}`);
  const snap = await tx.get(ref);
  const sequence = (snap.exists ? snap.data().last : 0) + 1;
  tx.set(ref, { last: sequence }, { merge: true });
  return buildCommunication({ sectionId, year, sequence });
}

/** Demande pour un ou plusieurs boulots faits, non payés, d'une même saison. */
async function createJobsRequest(db, auth, { jobPaths, payerName, payerPhone } = {}, { nowMs = Date.now() } = {}) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  const paths = [...new Set(Array.isArray(jobPaths) ? jobPaths : [])];
  if (paths.length < 1 || paths.length > MAX_JOBS_PER_REQUEST) {
    throw new PaymentError("invalid-argument", "bad-jobs", `Choisis entre 1 et ${MAX_JOBS_PER_REQUEST} boulots.`);
  }
  const parsed = paths.map((path) => parseSeasonDoc(path, "jobs"));
  const { sectionId, base } = parsed[0];
  if (parsed.some((p) => p.base !== base)) {
    throw new PaymentError("invalid-argument", "mixed-seasons", "Les boulots doivent être de la même saison.");
  }

  const actor = await requireManager(db, auth, sectionId);
  await requireSettings(db, sectionId);

  const requestRef = db.collection("paymentRequests").doc();
  const result = await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(parsed.map((p) => tx.get(db.doc(p.path))));
    const targets = snaps.map((snap, index) => {
      if (!snap.exists) throw new PaymentError("not-found", "no-job", "Un des boulots n'existe plus.");
      const job = snap.data();
      if (job.isPaid) throw new PaymentError("failed-precondition", "already-paid", `« ${job.description} » est déjà payé.`);
      if (job.paymentRequestId) {
        throw new PaymentError("failed-precondition", "already-requested", `« ${job.description} » a déjà une demande de paiement en cours.`);
      }
      const cents = toCents(job.total);
      if (!(cents > 0)) throw new PaymentError("failed-precondition", "no-amount", `« ${job.description} » n'a pas de montant.`);
      return {
        path: parsed[index].path,
        description: cleanText(job.description, 120),
        broName: cleanText(job.broName, 60),
        date: job.date || null,
        amountCents: cents,
      };
    });

    const communication = await nextCommunication(tx, db, sectionId, nowMs);
    const payer = cleanText(payerName, 70);
    const request = {
      sectionId,
      base,
      kind: "jobs",
      label: payer ? `Boulots · ${payer}` : targets[0].description,
      amountCents: targets.reduce((sum, t) => sum + t.amountCents, 0),
      communication,
      token: newToken(),
      status: "pending",
      targets,
      payer: { name: payer, phone: cleanText(payerPhone, 30) },
      createdBy: actor.uid,
      createdByName: actor.name,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(requestRef, request);
    targets.forEach((t) => tx.update(db.doc(t.path), { paymentRequestId: requestRef.id }));
    return request;
  });

  return { id: requestRef.id, token: result.token, communication: result.communication, amountCents: result.amountCents };
}

/** Demande de rechargement d'un compte bar, du montant choisi. */
async function createBarRequest(db, auth, { memberPath, amountCents } = {}, { nowMs = Date.now() } = {}) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  const member = parseSeasonDoc(memberPath, "members");
  if (!Number.isInteger(amountCents) || amountCents < BAR_MIN_CENTS || amountCents > BAR_MAX_CENTS) {
    throw new PaymentError(
      "invalid-argument", "bad-amount",
      `Le montant doit être entre ${BAR_MIN_CENTS / 100} et ${BAR_MAX_CENTS / 100} €.`
    );
  }
  const actor = await requireManager(db, auth, member.sectionId);
  await requireSettings(db, member.sectionId);

  const requestRef = db.collection("paymentRequests").doc();
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(member.path));
    if (!snap.exists) throw new PaymentError("not-found", "no-member", "Ce membre n'existe plus.");
    const name = cleanText(snap.data().name, 70);

    const communication = await nextCommunication(tx, db, member.sectionId, nowMs);
    const request = {
      sectionId: member.sectionId,
      base: member.base,
      kind: "bar",
      label: `Compte bar · ${name}`,
      amountCents,
      communication,
      token: newToken(),
      status: "pending",
      member: { path: member.path, id: member.id, name },
      payer: { name, phone: "" },
      createdBy: actor.uid,
      createdByName: actor.name,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(requestRef, request);
    return request;
  });

  return { id: requestRef.id, token: result.token, communication: result.communication, amountCents: result.amountCents };
}

async function loadRequest(db, requestId) {
  if (!new RegExp(`^${ID}$`).test(String(requestId || ""))) {
    throw new PaymentError("invalid-argument", "bad-request", "Demande introuvable.");
  }
  const ref = db.doc(`paymentRequests/${requestId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new PaymentError("not-found", "no-request", "Cette demande n'existe plus.");
  return { ref, request: snap.data() };
}

/** Annule une demande en attente et libère ses boulots. */
async function cancelRequest(db, auth, { requestId } = {}) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  const { ref, request } = await loadRequest(db, requestId);
  const actor = await requireManager(db, auth, request.sectionId);

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data();
    if (fresh.status !== "pending") {
      throw new PaymentError("failed-precondition", "not-pending", "Cette demande n'est plus en attente.");
    }
    tx.update(ref, {
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: actor.uid,
      cancelledByName: actor.name,
    });
    (fresh.targets || []).forEach((t) => tx.update(db.doc(t.path), { paymentRequestId: FieldValue.delete() }));
  });
  return { status: "cancelled" };
}

/**
 * Applique un paiement reçu à une demande en attente. Sert à la saisie manuelle
 * d'un animateur, et servira au rapprochement bancaire (`source.type = "bank"`).
 *
 *  - Boulots : il faut au moins le montant demandé. Le surplus est un
 *    pourboire, noté sur le premier boulot et encodé en rentrée.
 *  - Compte bar : tout le montant reçu est crédité, quel qu'il soit.
 */
async function settleRequest(db, requestId, { receivedCents, source, nowMs = Date.now() }) {
  const ref = db.doc(`paymentRequests/${requestId}`);
  const paidAtIso = new Date(nowMs).toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new PaymentError("not-found", "no-request", "Cette demande n'existe plus.");
    const request = snap.data();
    if (request.status !== "pending") {
      throw new PaymentError("failed-precondition", "not-pending", "Cette demande n'est plus en attente.");
    }
    const received = receivedCents ?? request.amountCents;
    if (!Number.isInteger(received) || received < 1) {
      throw new PaymentError("invalid-argument", "bad-amount", "Montant reçu invalide.");
    }

    let tipCents = 0;
    if (request.kind === "jobs") {
      if (received < request.amountCents) {
        throw new PaymentError(
          "failed-precondition", "underpaid",
          "Le montant reçu est inférieur au montant demandé. Annule la demande et marque les boulots à la main, ou attends le solde."
        );
      }
      tipCents = received - request.amountCents;
      request.targets.forEach((target, index) => {
        tx.update(db.doc(target.path), {
          isPaid: true,
          paymentMethod: "account",
          paidAt: paidAtIso,
          paidVia: "payment-request",
          ...(index === 0 && tipCents > 0 ? { tip: tipCents / 100 } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      if (tipCents > 0) {
        tx.set(db.collection(`${request.base}financialTransactions`).doc(), {
          type: "income",
          amount: tipCents / 100,
          description: `Pourboire · ${request.label}`,
          paymentMethod: "account",
          category: "other",
          timestamp: paidAtIso,
          paymentRequestId: requestId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      const memberRef = db.doc(request.member.path);
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) throw new PaymentError("not-found", "no-member", "Ce membre n'existe plus.");
      const before = Number(memberSnap.data().balance) || 0;
      tx.update(memberRef, { balance: FieldValue.increment(received / 100), updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.collection(`${request.base}orders`).doc(), {
        memberId: request.member.id,
        memberName: request.member.name,
        type: before < 0 ? "repayment" : "recharge",
        amount: received / 100,
        paymentMethod: "account",
        timestamp: paidAtIso,
        items: [],
        paymentRequestId: requestId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.update(ref, {
      status: "paid",
      paidAt: FieldValue.serverTimestamp(),
      receivedCents: received,
      tipCents,
      settledBy: source,
    });
    return { status: "paid", receivedCents: received, tipCents, sectionId: request.sectionId, label: request.label, createdBy: request.createdBy };
  });
}

/** Un animateur a vu le virement sur le compte : il marque la demande reçue. */
async function markReceived(db, auth, { requestId, receivedCents } = {}, opts = {}) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  const { request } = await loadRequest(db, requestId);
  const actor = await requireManager(db, auth, request.sectionId);

  const result = await settleRequest(db, requestId, {
    receivedCents,
    source: { type: "manual", uid: actor.uid, name: actor.name },
    nowMs: opts.nowMs,
  });
  // Personne n'a vérifié ce virement à part l'animateur : on en garde la trace.
  await db.collection("auditLog").add({
    type: "payment.marked_received",
    sectionId: request.sectionId,
    actorUid: actor.uid,
    actorName: actor.name,
    requestId,
    label: request.label,
    amountCents: request.amountCents,
    receivedCents: result.receivedCents,
    at: FieldValue.serverTimestamp(),
  });
  return result;
}

/**
 * Ce que voit le client sur la page publique, à partir du seul jeton. Rien
 * d'autre ne sort : ni qui a fait les boulots, ni qui a créé la demande.
 * Le compte est relu à chaque fois dans paymentSettings.
 */
async function getPublicPage(db, { token } = {}) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(String(token || ""))) {
    throw new PaymentError("not-found", "no-request", "Ce lien de paiement n'existe pas.");
  }
  const snap = await db.collection("paymentRequests").where("token", "==", token).limit(1).get();
  if (snap.empty) throw new PaymentError("not-found", "no-request", "Ce lien de paiement n'existe pas.");
  const request = snap.docs[0].data();

  const page = {
    status: request.status,
    sectionLabel: SECTIONS[request.sectionId],
    label: request.kind === "bar" ? request.label : "Boulots du patro",
    lines: request.kind === "jobs"
      ? request.targets.map((t) => ({ description: t.description, date: t.date, amountCents: t.amountCents }))
      : [],
    amountCents: request.amountCents,
  };
  if (request.status !== "pending") return page;

  const settings = await requireSettings(db, request.sectionId);
  return {
    ...page,
    holderName: settings.holderName,
    iban: formatIban(settings.iban),
    communication: formatCommunication(request.communication),
    qrPayload: buildEpcPayload({
      holderName: settings.holderName,
      iban: settings.iban,
      amountCents: request.amountCents,
      communication: request.communication,
    }),
  };
}

module.exports = {
  PaymentError,
  parseSeasonDoc,
  createJobsRequest,
  createBarRequest,
  cancelRequest,
  markReceived,
  settleRequest,
  getPublicPage,
};
