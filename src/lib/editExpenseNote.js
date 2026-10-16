// Modifier une note de frais déjà faite : heures, participants, tarif, client.
// Tout ce qui en découle suit : les boulots faits (des deux sections), les
// heures des Bro, et la demande de paiement, refaite puisqu'un montant
// demandé ne change jamais (voir functions/lib/paymentRequests.js).
import { addDoc, deleteDoc, getDocs, increment, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { collectionRef, docRef, otherSectionId } from './seasons';
import { payUrl } from './payLink';

const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;
const keyOf = (sectionId, broId) => `${sectionId}:${broId}`;

export class NoteEditError extends Error {}

/** Les boulots faits de la note : les nôtres, et ceux créés chez l'autre section. */
export async function jobsOfNote(note, { sectionId, seasonId, sharedSeasonId, ownJobs }) {
  const own = ownJobs
    .filter((job) => job.originalScheduledJobId === note.scheduledJobId)
    .map((job) => ({ ...job, sectionId, ref: docRef(db, seasonId, 'jobs', job.id, sectionId) }));
  const otherId = otherSectionId(sectionId);
  let other = [];
  if (sharedSeasonId) {
    const snap = await getDocs(query(
      collectionRef(db, sharedSeasonId, 'jobs', otherId),
      where('crossSectionFrom', '==', sectionId),
      where('originalScheduledJobId', '==', note.scheduledJobId)
    ));
    other = snap.docs.map((d) => ({ id: d.id, ...d.data(), sectionId: otherId, ref: d.ref }));
  }
  return [...own, ...other];
}

/** Ce qui empêche de modifier : argent déjà reçu, ou une autre demande en cours. */
export function blockerOf(jobs, request) {
  if (request?.status === 'paid' || jobs.some((job) => job.isPaid || job.collectedBy)) {
    return 'Ce boulot est déjà payé : sa note ne se modifie plus.';
  }
  if (jobs.some((job) => job.paymentRequestId && job.paymentRequestId !== request?.id)) {
    return 'Une autre demande de paiement couvre ce boulot : annule-la d\'abord dans Paiements.';
  }
  return null;
}

/**
 * @param draft  { lines, rate, billTo, collectTogether } venu de la fenêtre
 * @returns      { note, payment } : la note à jour, et le QR de la nouvelle demande
 */
export async function applyNoteEdit(note, draft, { sectionId, seasonId, sharedSeasonId, ownJobs, request }) {
  if (!note.scheduledJobId) throw new NoteEditError('Cette note ne vient pas d\'une validation : refais-la plutôt depuis la demande.');
  const jobs = await jobsOfNote(note, { sectionId, seasonId, sharedSeasonId, ownJobs });
  const blocker = blockerOf(jobs, request);
  if (blocker) throw new NoteEditError(blocker);
  if (draft.lines.some((l) => l.sectionId !== sectionId) && !sharedSeasonId) {
    throw new NoteEditError('Saison de l\'autre section inconnue : recharge l\'app et réessaie.');
  }

  // Le montant d'une demande est figé : on l'annule, une nouvelle suit.
  if (request?.status === 'pending') await call('cancelPaymentRequest', { requestId: request.id });

  const { lines, rate, billTo } = draft;
  const brosNeeded = jobs.find((job) => job.originalBrosNeeded)?.originalBrosNeeded || lines.length;
  const isPartial = lines.length < brosNeeded;
  const description = isPartial ? `${note.description} (PARTIEL ${lines.length}/${brosNeeded})` : note.description;
  const common = {
    hourlyRate: rate,
    description,
    isPartialCompletion: isPartial,
    actualBrosUsed: lines.length,
    contactName: billTo
  };
  const seasonOf = (section) => (section === sectionId ? seasonId : sharedSeasonId);
  const addHours = async (section, broId, delta) => {
    if (!broId || !delta) return;
    try {
      await updateDoc(docRef(db, seasonOf(section), 'bros', broId, section), { totalHours: increment(delta), updatedAt: serverTimestamp() });
    } catch (error) {
      // Un Bro supprimé depuis : ses heures n'ont plus de compteur.
      console.error('Heures du Bro non mises à jour:', error);
    }
  };

  const byKey = new Map(jobs.map((job) => [keyOf(job.sectionId, job.broId), job]));
  const kept = new Set();
  const finalPaths = [];
  for (const line of lines) {
    const key = keyOf(line.sectionId, line.broId);
    const existing = byKey.get(key);
    const fields = { ...common, hours: line.hours, total: line.hours * rate };
    if (existing) {
      kept.add(key);
      await updateDoc(existing.ref, { ...fields, updatedAt: serverTimestamp() });
      await addHours(line.sectionId, line.broId, line.hours - (Number(existing.hours) || 0));
      finalPaths.push({ own: line.sectionId === sectionId, path: existing.ref.path });
    } else {
      const ref = await addDoc(collectionRef(db, seasonOf(line.sectionId), 'jobs', line.sectionId), {
        ...fields,
        broId: line.broId,
        broName: line.name,
        date: note.date,
        isPaid: false,
        paymentMethod: null,
        originalScheduledJobId: note.scheduledJobId,
        contactPhone: request?.payer?.phone || '',
        location: note.location || '',
        originalBrosNeeded: brosNeeded,
        ...(line.sectionId === sectionId ? {} : { crossSectionFrom: sectionId }),
        createdAt: serverTimestamp()
      });
      await addHours(line.sectionId, line.broId, line.hours);
      finalPaths.push({ own: line.sectionId === sectionId, path: ref.path });
    }
  }
  for (const job of jobs) {
    if (kept.has(keyOf(job.sectionId, job.broId))) continue;
    await deleteDoc(job.ref);
    await addHours(job.sectionId, job.broId, -(Number(job.hours) || 0));
  }

  // Nouvelle demande, du même mode qu'avant (ou celui choisi).
  const together = Boolean(draft.collectTogether) && finalPaths.some((p) => !p.own);
  let payment = null;
  let paymentRequestId = null;
  let paymentError = null;
  if (finalPaths.some((p) => p.own)) {
    try {
      const created = await call('createJobsPaymentRequest', {
        jobPaths: finalPaths.filter((p) => together || p.own).map((p) => p.path),
        sectionId,
        payerName: billTo,
        payerPhone: request?.payer?.phone || ''
      });
      paymentRequestId = created.id;
      const page = await call('getPaymentPage', { token: created.token });
      payment = {
        holderName: page.holderName,
        iban: page.iban,
        communication: page.communication,
        qrPayload: page.qrPayload,
        link: payUrl(created.token)
      };
    } catch (error) {
      console.error('Nouvelle demande de paiement impossible:', error);
      paymentError = error?.details?.reason ? error.message : 'Vérifie ta connexion.';
    }
  }

  const updated = {
    ...note,
    lines: lines.map(({ key, broId, sectionId: lineSection, name, hours }) => ({ key, broId, sectionId: lineSection, name, hours })),
    rate,
    billTo,
    collectTogether: together && Boolean(paymentRequestId),
    paymentRequestId,
    otherLabel: note.otherLabel,
    issuedAt: new Date().toISOString()
  };
  const { id, payment: _payment, paidAt: _paidAt, preview: _preview, ...stored } = updated;
  await updateDoc(docRef(db, seasonId, 'expenseNotes', id, sectionId), { ...stored, updatedAt: serverTimestamp() });
  return { note: updated, payment, paymentError };
}

