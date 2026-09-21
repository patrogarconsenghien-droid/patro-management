// Identifiant de paiement permanent d'un membre du bar.
//
// Chaque membre a SA communication structurée, pour toujours. Pour recharger
// son compte, il fait un virement du montant qu'il veut avec cette
// communication : le montant reçu est crédité sur son compte. Pas de demande à
// créer, pas de montant imposé ; il peut l'enregistrer comme bénéficiaire dans
// son app bancaire une fois pour toutes.
//
// Un membre garde le même identifiant interne d'une saison à l'autre : le code
// est donc lié à (section, membre), pas à une saison.
const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { buildMemberCode, formatCommunication } = require("./ogm");
const { buildEpcPayload } = require("./epcQr");
const { formatIban } = require("./iban");
const { PaymentError, parseSeasonDoc } = require("./paymentRequests");

const SECTIONS = { garcons: "Brothers", filles: "Grandes" };

/** Tout compte actif de la section peut afficher le QR de rechargement d'un membre. */
async function requireSectionMember(db, auth, sectionId) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  const snap = await db.doc(`users/${auth.uid}`).get();
  const profile = snap.exists ? snap.data() : null;
  const allowed = profile && profile.status === "active"
    && (profile.role === "admin" || profile.sectionId === sectionId);
  if (!allowed) throw new PaymentError("permission-denied", "not-in-section", "Réservé aux comptes de la section.");
  return { uid: auth.uid };
}

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

const codeRef = (db, sectionId, memberId) => db.doc(`paymentCodes/${sectionId}_${memberId}`);

// Un QR peut proposer un montant (une dette à rembourser) : c'est une
// suggestion, le membre reste libre de verser autre chose, et c'est toujours le
// montant réellement reçu qui est crédité.
const MAX_SUGGESTED_CENTS = 100_000;

const describe = (code, settings, amountCents = null) => ({
  memberName: code.memberName,
  sectionLabel: SECTIONS[code.sectionId],
  token: code.token,
  holderName: settings.holderName,
  iban: formatIban(settings.iban),
  communication: formatCommunication(code.communication),
  amountCents,
  // Sans montant, l'app bancaire le demande au payeur.
  qrPayload: buildEpcPayload({ holderName: settings.holderName, iban: settings.iban, amountCents, communication: code.communication }),
});

/** Le code d'un membre, créé à la première demande. */
async function getMemberCode(db, auth, { memberPath, amountCents = null } = {}) {
  if (!auth || !auth.uid) throw new PaymentError("unauthenticated", "signed-out", "Connexion requise.");
  if (amountCents !== null && !(Number.isInteger(amountCents) && amountCents >= 1 && amountCents <= MAX_SUGGESTED_CENTS)) {
    throw new PaymentError("invalid-argument", "bad-amount", `Le montant doit être entre 0,01 et ${MAX_SUGGESTED_CENTS / 100} €.`);
  }
  const member = parseSeasonDoc(memberPath, "members");
  const actor = await requireSectionMember(db, auth, member.sectionId);
  const settings = await requireSettings(db, member.sectionId);

  const ref = codeRef(db, member.sectionId, member.id);
  const code = await db.runTransaction(async (tx) => {
    const memberSnap = await tx.get(db.doc(member.path));
    if (!memberSnap.exists) throw new PaymentError("not-found", "no-member", "Ce membre n'existe plus.");
    const name = String(memberSnap.data().name || "").replace(/\s+/g, " ").trim().slice(0, 70);

    const existing = await tx.get(ref);
    if (existing.exists) {
      // Le nom suit le membre s'il a été corrigé depuis.
      if (existing.data().memberName !== name) tx.update(ref, { memberName: name });
      return { ...existing.data(), memberName: name };
    }

    const counterRef = db.doc(`paymentCounters/members-${member.sectionId}`);
    const counter = await tx.get(counterRef);
    const sequence = (counter.exists ? counter.data().last : 0) + 1;
    tx.set(counterRef, { last: sequence }, { merge: true });

    const created = {
      sectionId: member.sectionId,
      memberId: member.id,
      memberName: name,
      communication: buildMemberCode({ sectionId: member.sectionId, sequence }),
      token: crypto.randomBytes(16).toString("base64url"),
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, created);
    return created;
  });

  return describe(code, settings, amountCents);
}

/** Page publique d'un code de membre, à partir du jeton de son lien. Null si inconnu. */
async function getMemberPage(db, token) {
  const snap = await db.collection("paymentCodes").where("token", "==", token).limit(1).get();
  if (snap.empty) return null;
  const code = snap.docs[0].data();
  const settings = await requireSettings(db, code.sectionId);
  const { token: _token, amountCents: _amount, ...page } = describe(code, settings);
  return { status: "open", kind: "member", label: `Compte bar · ${code.memberName}`, amountCents: null, lines: [], ...page };
}

/**
 * Crédite le compte d'un membre à partir d'un virement portant son code.
 * Servira au rapprochement bancaire : `seasonBase` est la saison en cours de
 * la section, `bankRef` l'identifiant du virement, qui interdit de créditer
 * deux fois le même.
 */
async function creditMemberByCode(db, { communication, receivedCents, seasonBase, bankRef, nowMs = Date.now() }) {
  if (!Number.isInteger(receivedCents) || receivedCents < 1) throw new Error(`Montant invalide : ${receivedCents}`);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(String(bankRef || ""))) throw new Error("Référence bancaire manquante");

  const found = await db.collection("paymentCodes").where("communication", "==", communication).limit(1).get();
  if (found.empty) return { credited: false, reason: "unknown-code" };
  const code = found.docs[0].data();

  const memberRef = db.doc(`${seasonBase}members/${code.memberId}`);
  const orderRef = db.doc(`${seasonBase}orders/bank-${bankRef}`);
  const timestamp = new Date(nowMs).toISOString();

  return db.runTransaction(async (tx) => {
    if ((await tx.get(orderRef)).exists) return { credited: false, reason: "already-credited" };
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) return { credited: false, reason: "no-member" };

    const before = Number(memberSnap.data().balance) || 0;
    tx.update(memberRef, { balance: FieldValue.increment(receivedCents / 100), updatedAt: FieldValue.serverTimestamp() });
    tx.set(orderRef, {
      memberId: code.memberId,
      memberName: memberSnap.data().name || code.memberName,
      type: before < 0 ? "repayment" : "recharge",
      amount: receivedCents / 100,
      paymentMethod: "account",
      timestamp,
      items: [],
      bankRef,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { credited: true, sectionId: code.sectionId, memberId: code.memberId, memberName: code.memberName };
  });
}

module.exports = { getMemberCode, getMemberPage, creditMemberByCode };
