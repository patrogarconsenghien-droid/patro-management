// Rappel d'un boulot programmé : qui relancer, et quoi leur écrire. Sans
// dépendance à Cloud Functions, pour être testé sur l'émulateur Firestore.
//
// On relance les membres d'une section qui n'ont pas répondu : ni inscrits, ni
// « ne peut pas », ni déjà pris sur un autre boulot le même jour. Le calcul est
// refait ici : le serveur ne fait pas confiance à une liste envoyée par l'app.
const { FieldValue } = require("firebase-admin/firestore");

const SECTIONS = ["garcons", "filles"];
const DEFAULT_SECTION = "garcons";
// Entre deux rappels d'un même boulot : personne ne veut être relancé en rafale.
const MIN_MINUTES_BETWEEN_REMINDERS = 60;

class ReminderError extends Error {
  constructor(code, reason, message) {
    super(message);
    this.code = code;
    this.reason = reason;
  }
}

const ID = "[A-Za-z0-9_-]{1,100}";
const JOB_PATHS = [
  // Garçons, saison historique : collections à la racine.
  { re: new RegExp(`^scheduledJobs/(${ID})$`), parse: (m) => ({ sectionId: DEFAULT_SECTION, base: "", jobId: m[1] }) },
  { re: new RegExp(`^seasons/(${ID})/scheduledJobs/(${ID})$`), parse: (m) => ({ sectionId: DEFAULT_SECTION, base: `seasons/${m[1]}/`, jobId: m[2] }) },
  { re: new RegExp(`^sections/(${ID})/seasons/(${ID})/scheduledJobs/(${ID})$`), parse: (m) => ({ sectionId: m[1], base: `sections/${m[1]}/seasons/${m[2]}/`, jobId: m[3] }) },
];
const BROS_PATHS = [
  { re: /^bros$/, parse: () => ({ sectionId: DEFAULT_SECTION, base: "" }) },
  { re: new RegExp(`^seasons/(${ID})/bros$`), parse: (m) => ({ sectionId: DEFAULT_SECTION, base: `seasons/${m[1]}/` }) },
  { re: new RegExp(`^sections/(${ID})/seasons/(${ID})/bros$`), parse: (m) => ({ sectionId: m[1], base: `sections/${m[1]}/seasons/${m[2]}/` }) },
];

/** N'accepte que les trois formes de chemin que l'app utilise vraiment. */
function parsePath(path, shapes) {
  for (const { re, parse } of shapes) {
    const match = re.exec(String(path || ""));
    if (match) {
      const parsed = parse(match);
      if (SECTIONS.includes(parsed.sectionId)) return parsed;
    }
  }
  throw new ReminderError("invalid-argument", "bad-path", "Boulot introuvable.");
}

async function requireManager(db, auth, sectionId) {
  if (!auth || !auth.uid) throw new ReminderError("unauthenticated", "signed-out", "Connexion requise.");
  const snap = await db.doc(`users/${auth.uid}`).get();
  const profile = snap.exists ? snap.data() : null;
  const manages = profile && profile.status === "active"
    && (profile.role === "admin" || (profile.role === "animateur" && profile.sectionId === sectionId));
  if (!manages) {
    throw new ReminderError("permission-denied", "not-manager", "Réservé aux animateurs de la section.");
  }
  return { uid: auth.uid, name: profile.displayName || profile.email || "Un animateur" };
}

function formatDateFr(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-BE", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Brussels",
  });
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

/** Texte du rappel, commun à la notification et au mail. */
function buildMessage(job, { appUrl, senderName }) {
  const description = String(job.description || "Boulot");
  const date = formatDateFr(job.date);
  const registered = (job.registeredBros || []).length;
  const missing = Math.max(0, (Number(job.brosNeeded) || 0) - registered);
  const link = `${appUrl}/#boulots-scheduled`;

  const facts = [
    date && `Quand : ${date}${job.timeStart ? ` à ${job.timeStart}` : ""}`,
    job.location && `Où : ${job.location}`,
    job.estimatedHours && `Durée estimée : ${job.estimatedHours} h`,
    missing > 0 && `Il manque encore ${missing} personne${missing > 1 ? "s" : ""}.`,
  ].filter(Boolean);

  const title = "Tu viens ? On attend ta réponse";
  const body = [description, date].filter(Boolean).join(" · ");
  const text = [
    `${senderName} te relance pour ce boulot : ${description}`,
    "",
    ...facts,
    "",
    "Réponds en deux secondes, que tu viennes ou pas :",
    link,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(senderName)} te relance pour ce boulot : <strong>${escapeHtml(description)}</strong></p>`,
    `<ul>${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>`,
    `<p>Réponds en deux secondes, que tu viennes ou pas :<br><a href="${link}">${link}</a></p>`,
  ].join("");

  return { title, body, subject: `Rappel : ${body}`, text, html, link };
}

/**
 * Prépare un rappel : vérifie les droits et le délai, calcule qui relancer,
 * marque le boulot, et dépose un mail par destinataire dans la collection
 * `mail` (envoyée par l'extension Firebase « Trigger Email »).
 *
 * Renvoie de quoi envoyer les notifications : { uids, message, counts }.
 */
async function prepareReminder(db, auth, { jobPath, brosPath } = {}, { nowMs = Date.now(), appUrl } = {}) {
  // La connexion d'abord : un inconnu n'apprend rien, pas même si un chemin est valide.
  if (!auth || !auth.uid) throw new ReminderError("unauthenticated", "signed-out", "Connexion requise.");
  const jobRefInfo = parsePath(jobPath, JOB_PATHS);
  const brosInfo = parsePath(brosPath, BROS_PATHS);
  // On relance les membres de SA section, y compris pour un boulot que
  // l'autre section a ouvert.
  const actor = await requireManager(db, auth, brosInfo.sectionId);

  const jobRef = db.doc(jobPath);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new ReminderError("not-found", "no-job", "Ce boulot n'existe plus.");
  const job = jobSnap.data();

  if (jobRefInfo.sectionId !== brosInfo.sectionId && job.openToOtherSection !== true) {
    throw new ReminderError("permission-denied", "not-open", "Ce boulot n'est pas ouvert à ta section.");
  }

  const registered = job.registeredBros || [];
  if (registered.length >= (Number(job.brosNeeded) || 0)) {
    throw new ReminderError("failed-precondition", "full", "L'équipe est déjà complète.");
  }

  // Un rappel par heure et par section, pas plus.
  const stampField = `lastReminderAt.${brosInfo.sectionId}`;
  const last = job.lastReminderAt && job.lastReminderAt[brosInfo.sectionId];
  if (last && nowMs - last.toMillis() < MIN_MINUTES_BETWEEN_REMINDERS * 60 * 1000) {
    const wait = Math.ceil((MIN_MINUTES_BETWEEN_REMINDERS * 60 * 1000 - (nowMs - last.toMillis())) / 60000);
    throw new ReminderError(
      "resource-exhausted", "too-soon",
      `Un rappel vient d'être envoyé. Réessaie dans ${wait} minute${wait > 1 ? "s" : ""}.`
    );
  }

  // Déjà pris ce jour-là : sur les boulots de la section du boulot et de la mienne.
  const sameDayBases = [...new Set([jobRefInfo.base, brosInfo.base])];
  const sameDay = (await Promise.all(
    sameDayBases.map((base) => db.collection(`${base}scheduledJobs`).where("date", "==", job.date || "").get())
  )).flatMap((snap) => snap.docs).filter((doc) => doc.ref.path !== jobRef.path);
  const busy = new Set(sameDay.flatMap((doc) => (doc.data().registeredBros || []).map((reg) => reg.broId)));

  const answered = new Set([
    ...registered.map((reg) => reg.broId),
    ...(job.unavailableBros || []).map((u) => u.broId),
  ]);
  const brosSnap = await db.collection(brosPath).get();
  const toAsk = brosSnap.docs.map((doc) => doc.id).filter((id) => !answered.has(id) && !busy.has(id));
  if (toAsk.length === 0) {
    throw new ReminderError("failed-precondition", "nobody", "Tout le monde a déjà répondu.");
  }

  // Les comptes actifs de la section reliés à ces membres. Plusieurs comptes
  // peuvent être reliés au même membre.
  const usersSnap = await db.collection("users").where("status", "==", "active").get();
  const asked = new Set(toAsk);
  const accounts = usersSnap.docs
    .map((doc) => ({ uid: doc.id, ...doc.data() }))
    .filter((user) => user.sectionId === brosInfo.sectionId && user.broId && asked.has(user.broId));
  const reached = new Set(accounts.map((user) => user.broId));

  const message = buildMessage(job, { appUrl, senderName: actor.name });
  const emails = [...new Set(accounts.map((user) => String(user.email || "").toLowerCase()).filter(Boolean))];

  const batch = db.batch();
  for (const email of emails) {
    batch.set(db.collection("mail").doc(), {
      to: [email],
      message: { subject: message.subject, text: message.text, html: message.html },
      // Pour retrouver d'où vient un mail, et faire le ménage.
      source: { type: "job_reminder", jobPath, sentBy: actor.uid },
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(jobRef, {
    [stampField]: FieldValue.serverTimestamp(),
    reminderCount: FieldValue.increment(1),
  });
  await batch.commit();

  return {
    uids: accounts.map((user) => user.uid),
    message,
    jobId: jobRefInfo.jobId,
    sectionId: brosInfo.sectionId,
    counts: {
      people: toAsk.length,
      emailed: emails.length,
      // Membres sans compte relié : personne à prévenir, à relancer de vive voix.
      unreachable: toAsk.filter((id) => !reached.has(id)).length,
    },
  };
}

module.exports = { ReminderError, prepareReminder, buildMessage, parsePath, JOB_PATHS, BROS_PATHS };
