import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, query, serverTimestamp, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Check, Copy, FileText, Maximize2, QrCode, Share2, X } from 'lucide-react';
import { db, functions } from './firebase';
import Modal from './components/Modal';
import ExpenseNote from './components/ExpenseNote';
import { SECTIONS } from './auth/account';
import { collectionRef, docRef, otherSectionId } from './lib/seasons';
import { formatCurrency, formatDate } from './lib/format';
import { toast } from './lib/feedback';
import { payUrl, renderQr } from './lib/payLink';

const STATUS = {
  pending: { label: 'En attente', tone: 'bg-orange-100 text-orange-800' },
  paid: { label: 'Reçu', tone: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Annulée', tone: 'bg-gray-200 text-gray-600' }
};

const euros = (cents) => formatCurrency((cents || 0) / 100);

/** Une ligne par boulot : un boulot fait à dix est enregistré en dix lignes. */
const mergeTargets = (targets = []) => {
  const merged = new Map();
  targets.forEach((target) => {
    const description = String(target.description || '').replace(/\s*\(PARTIEL [^)]*\)\s*$/, '').trim();
    const key = `${target.date}|${description.toLowerCase()}`;
    if (!merged.has(key)) merged.set(key, { key, description, amountCents: 0, names: [] });
    const line = merged.get(key);
    line.amountCents += target.amountCents;
    if (target.broName) line.names.push(target.broName);
  });
  return [...merged.values()];
};
const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;

const sectionOfPath = (path) => /^sections\/([^/]+)\//.exec(String(path))?.[1] || 'garcons';
const workOf = (description) => String(description || '').replace(/\s*\(PARTIEL [^)]*\)\s*$/, '').trim();

/**
 * Note de frais d'une demande faite avant que les notes soient gardées :
 * reconstruite à partir de la demande (qui, combien) et des boulots faits
 * (heures, tarif, lieu). Les participants de l'autre section venus sur le
 * même boulot sont ajoutés, même si leur part a été demandée à part : la note
 * montre toute l'équipe.
 */
async function noteFromRequest(request, sectionId, sharedSeasonId) {
  const targets = request.targets || [];
  const otherId = otherSectionId(sectionId);
  const jobs = await Promise.all(targets.map(async (target) => {
    try {
      const snap = await getDoc(doc(db, target.path));
      return snap.exists() ? snap.data() : null;
    } catch {
      return null;
    }
  }));
  const known = jobs.filter(Boolean);
  const rate = Number(known.find((job) => job.hourlyRate > 0)?.hourlyRate) || 0;
  if (!(rate > 0)) throw new Error('Tarif introuvable : les boulots de cette demande n\'existent plus.');

  // Les boulots que nous avons créés chez l'autre section pour les mêmes
  // boulots programmés, et qui ne sont pas déjà sur la demande.
  const scheduledIds = [...new Set(known.map((job) => job.originalScheduledJobId).filter(Boolean))];
  const onRequest = new Set(targets.map((target) => target.path));
  const extra = [];
  if (sharedSeasonId) {
    await Promise.all(scheduledIds.map(async (scheduledId) => {
      try {
        const snap = await getDocs(query(
          collectionRef(db, sharedSeasonId, 'jobs', otherId),
          where('crossSectionFrom', '==', sectionId),
          where('originalScheduledJobId', '==', scheduledId)
        ));
        snap.docs.filter((d) => !onRequest.has(d.ref.path)).forEach((d) => extra.push(d.data()));
      } catch (error) {
        console.error('Lecture des boulots de l\'autre section impossible:', error);
      }
    }));
  }

  const works = [...new Set([...targets, ...extra].map((t) => workOf(t.description)))];
  const lines = targets.map((target, index) => {
    const lineSection = target.sectionId || sectionOfPath(target.path);
    const hours = Number(jobs[index]?.hours) || Math.round((target.amountCents / 100 / rate) * 100) / 100;
    const name = target.broName || 'Inconnu';
    return {
      key: `${lineSection}:${index}`,
      broId: jobs[index]?.broId || null,
      sectionId: lineSection,
      // Plusieurs boulots sur la même demande : chaque ligne dit lequel.
      name: works.length > 1 ? `${name} · ${workOf(target.description)}` : name,
      hours
    };
  }).concat(extra.map((job, index) => ({
    key: `${otherId}:extra${index}`,
    broId: job.broId || null,
    sectionId: otherId,
    name: works.length > 1 ? `${job.broName || 'Inconnu'} · ${workOf(job.description)}` : (job.broName || 'Inconnu'),
    hours: Number(job.hours) || 0
  })));
  const first = jobs.find((job, index) => job && sectionOfPath(targets[index].path) === sectionId) || known[0] || {};
  return {
    issuedAt: request.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    sectionId,
    sectionLabel: SECTIONS[sectionId],
    otherLabel: SECTIONS[otherSectionId(sectionId)],
    billTo: request.payer?.name || first.contactName || '',
    description: works.join(' + '),
    date: targets[0]?.date || first.date || null,
    location: first.location || '',
    rate,
    lines,
    collectTogether: targets.some((t) => t.sectionId),
    paymentRequestId: request.id,
    rebuiltFromRequest: true
  };
}
const messageOf = (error) =>
  error?.details?.reason ? error.message : 'Ça n\'a pas marché. Vérifie ta connexion et réessaie.';

/** Détail d'une demande : le QR à montrer, le lien à envoyer, et les actions. */
const RequestDetail = ({ request, onClose, onOpenNote, onCreateNote, createNoteLabel }) => {
  const [page, setPage] = useState(null);
  const [qr, setQr] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const link = payUrl(request.token);
  const pending = request.status === 'pending';

  useEffect(() => {
    if (!pending) return undefined;
    let cancelled = false;
    // Le contenu du QR vient du serveur, à partir du compte officiel.
    call('getPaymentPage', { token: request.token })
      .then(async (data) => {
        if (cancelled) return;
        setPage(data);
        setQr(await renderQr(data.qrPayload, 560));
      })
      .catch((loadError) => { if (!cancelled) setError(messageOf(loadError)); });
    return () => { cancelled = true; };
  }, [request.token, pending]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie ce lien :', link);
    }
  };

  const share = async () => {
    const text = `${request.label} : ${euros(request.amountCents)} à payer par virement.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Paiement Patro', text, url: link }); } catch { /* partage annulé */ }
    } else {
      copyLink();
    }
  };

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try { await action(); } catch (caught) { console.error('Demande de paiement:', caught); setError(messageOf(caught)); } finally { setBusy(false); }
  };

  const markReceived = () => run(async () => {
    const typed = window.prompt(
      `Montant reçu sur le compte pour « ${request.label} » ?\n\nUn montant supérieur est compté comme pourboire.`,
      String((request.amountCents / 100).toFixed(2)).replace('.', ',')
    );
    if (typed === null) return;
    const receivedCents = Math.round(parseFloat(typed.replace(',', '.')) * 100);
    if (!Number.isFinite(receivedCents) || receivedCents < 1) { setError('Montant invalide.'); return; }
    const result = await call('markPaymentReceived', { requestId: request.id, receivedCents });
    toast(result.tipCents > 0 ? `Paiement reçu, dont ${euros(result.tipCents)} de pourboire` : 'Paiement reçu');
    onClose();
  });

  const cancel = () => run(async () => {
    if (!confirm(`Annuler la demande « ${request.label} » ?\n\nLe lien et le QR ne fonctionneront plus.`)) return;
    await call('cancelPaymentRequest', { requestId: request.id });
    toast('Demande annulée');
    onClose();
  });

  if (fullscreen && qr) {
    return (
      <button
        onClick={() => setFullscreen(false)}
        className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4 p-6"
        aria-label="Fermer le QR en plein écran"
      >
        <img src={qr} alt="QR de paiement" className="w-full max-w-md" />
        <p className="font-display text-4xl font-extrabold text-gray-900">{euros(request.amountCents)}</p>
        <p className="text-sm text-gray-500">Scanne avec ton app bancaire · touche pour fermer</p>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-3xl font-extrabold tracking-tight">{euros(request.amountCents)}</p>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[request.status]?.tone}`}>
          {STATUS[request.status]?.label}
        </span>
      </div>

      {request.kind === 'jobs' && (
        <ul className="text-sm text-gray-700 divide-y divide-gray-100">
          {mergeTargets(request.targets).map((line) => (
            <li key={line.key} className="py-1.5 flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate">{line.description}</span>
                <span className="block text-xs text-gray-500 truncate">
                  {line.names.length > 1 ? `${line.names.length} participants : ${line.names.join(', ')}` : line.names[0]}
                </span>
              </span>
              <span className="font-mono flex-none">{euros(line.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {onCreateNote && (
        <button onClick={onCreateNote} className="w-full p-2.5 rounded-xl bg-gray-100 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <FileText size={16} />{createNoteLabel}
        </button>
      )}

      {onOpenNote && (
        <button onClick={onOpenNote} className="w-full p-2.5 rounded-xl bg-gray-100 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <FileText size={16} />Voir la note de frais
        </button>
      )}

      {request.status === 'paid' && (
        <p className="text-sm text-green-800 bg-green-50 rounded-xl p-3">
          Reçu {euros(request.receivedCents)}
          {request.tipCents > 0 ? `, dont ${euros(request.tipCents)} de pourboire` : ''}
          {request.settledBy?.type === 'manual' ? `. Marqué par ${request.settledBy.name}.` : '. Vu sur le compte bancaire.'}
        </p>
      )}

      {pending && (
        <>
          {qr ? (
            <button onClick={() => setFullscreen(true)} className="block mx-auto" aria-label="Afficher le QR en plein écran">
              <img src={qr} alt="QR de paiement" width="220" height="220" className="rounded-xl ring-1 ring-gray-200" />
            </button>
          ) : !error && <p className="text-sm text-gray-500 text-center py-8">Préparation du QR…</p>}

          {page && (
            <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-gray-500">Compte</dt><dd className="font-mono">{page.iban}</dd>
              <dt className="text-gray-500">Titulaire</dt><dd>{page.holderName}</dd>
              <dt className="text-gray-500">Communication</dt><dd className="font-mono">{page.communication}</dd>
            </dl>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setFullscreen(true)} disabled={!qr} className="p-2.5 rounded-xl bg-gray-900 text-gray-50 text-sm font-semibold flex flex-col items-center gap-1 disabled:opacity-50 active:scale-95 transition-transform">
              <Maximize2 size={18} />Plein écran
            </button>
            <button onClick={share} className="p-2.5 rounded-xl bg-white ring-1 ring-gray-200 text-sm font-semibold flex flex-col items-center gap-1 active:scale-95 transition-transform">
              <Share2 size={18} />Envoyer
            </button>
            <button onClick={copyLink} className="p-2.5 rounded-xl bg-white ring-1 ring-gray-200 text-sm font-semibold flex flex-col items-center gap-1 active:scale-95 transition-transform">
              {copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Copié' : 'Copier le lien'}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3" role="alert">{error}</p>}

      {pending && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <button onClick={markReceived} disabled={busy} className="w-full p-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform">
            J'ai vu le virement sur le compte
          </button>
          <button onClick={cancel} disabled={busy} className="w-full p-2.5 rounded-xl text-sm text-red-700 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <X size={16} />Annuler la demande
          </button>
        </div>
      )}
    </div>
  );
};

const Payments = ({ Header, navigateTo, sectionId, seasonId, sharedSeasonId, jobs = [] }) => {
  const [requests, setRequests] = useState(null);
  const [selectedJobs, setSelectedJobs] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  // La demande qu'on vient de créer, telle que le serveur l'a renvoyée : le QR
  // s'ouvre tout de suite, sans attendre que la liste se mette à jour.
  const [justCreated, setJustCreated] = useState(null);
  const [listError, setListError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Notes de frais faites à la validation des boulots, et la note ouverte.
  const [notes, setNotes] = useState([]);
  const [debts, setDebts] = useState([]);
  const [shownNote, setShownNote] = useState(null);
  const [openingNote, setOpeningNote] = useState(null);

  useEffect(() => onSnapshot(
    collectionRef(db, seasonId, 'expenseNotes', sectionId),
    (snapshot) => setNotes(
      snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))
    ),
    (readError) => console.error('Lecture des notes de frais impossible:', readError)
  ), [seasonId, sectionId]);

  // Ce que la section doit à l'autre pour les boulots encaissés en une fois.
  useEffect(() => onSnapshot(
    query(collection(db, 'sectionDebts'), where('debtorSection', '==', sectionId)),
    (snapshot) => setDebts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (readError) => console.error('Lecture des dettes entre sections impossible:', readError)
  ), [sectionId]);

  useEffect(() => onSnapshot(
    query(collection(db, 'paymentRequests'), where('sectionId', '==', sectionId)),
    (snapshot) => { setListError(false); setRequests(
      snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()))
    ); },
    // Ne jamais faire passer un refus de lecture pour une liste vide : des
    // demandes existent peut-être, et leurs boulots sont réservés.
    (readError) => { console.error('Lecture des demandes de paiement impossible:', readError); setListError(true); setRequests([]); }
  ), [sectionId]);

  // Boulots faits, non payés, sans demande en cours, regroupés par client.
  // Un boulot fait à plusieurs est enregistré en une ligne par participant :
  // ici il redevient UN boulot, avec son total et une seule case à cocher.
  const groups = useMemo(() => {
    const byClient = new Map();
    jobs
      .filter((job) => !job.isPaid && !job.paymentRequestId && Number(job.total) > 0)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .forEach((job) => {
        const name = (job.contactName || '').trim();
        const key = name ? name.toLowerCase() : '';
        if (!byClient.has(key)) byClient.set(key, { key, name, phone: job.contactPhone || '', jobs: [], works: new Map() });
        const group = byClient.get(key);
        group.jobs.push(job);

        // Même boulot programmé, ou à défaut même jour et même intitulé.
        const base = String(job.description || '').replace(/\s*\(PARTIEL [^)]*\)\s*$/, '').trim();
        const workKey = job.originalScheduledJobId || `${job.date}|${base.toLowerCase()}`;
        if (!group.works.has(workKey)) group.works.set(workKey, { key: workKey, description: base, date: job.date, jobs: [] });
        group.works.get(workKey).jobs.push(job);
      });
    return [...byClient.values()]
      .map((group) => ({ ...group, works: [...group.works.values()] }))
      .sort((a, b) => (a.key === '') - (b.key === '') || a.key.localeCompare(b.key));
  }, [jobs]);

  const requestById = useMemo(() => new Map((requests || []).map((r) => [r.id, r])), [requests]);
  const debtByRequest = useMemo(() => new Map(debts.map((d) => [d.paymentRequestId, d])), [debts]);
  const noteByRequest = useMemo(
    () => new Map(notes.filter((n) => n.paymentRequestId).map((n) => [n.paymentRequestId, n])),
    [notes]
  );

  /**
   * Rouvre une note : le QR se redemande au serveur tant que la demande est en
   * attente ; payée, la note le dit ; sans demande, elle reste sans QR.
   */
  const openNote = async (note) => {
    const request = requestById.get(note.paymentRequestId);
    setOpeningNote(note.id);
    try {
      let payment = null;
      let paidAt = null;
      if (request?.status === 'pending') {
        const page = await call('getPaymentPage', { token: request.token });
        payment = {
          holderName: page.holderName,
          iban: page.iban,
          communication: page.communication,
          qrPayload: page.qrPayload,
          link: payUrl(request.token)
        };
      } else if (request?.status === 'paid') {
        paidAt = request.paidAt?.toDate?.().toISOString() || new Date().toISOString();
      }
      setOpenId(null);
      setShownNote({ ...note, payment, paidAt, preview: false });
    } catch (caught) {
      console.error('Ouverture de la note:', caught);
      toast(messageOf(caught), { tone: 'error' });
    } finally {
      setOpeningNote(null);
    }
  };

  // Une note déjà reconstruite se refait par-dessus : elle ne vient pas de la
  // validation, rien de saisi à la main ne s'y perd.
  const createNote = async (request) => {
    try {
      const note = await noteFromRequest(request, sectionId, sharedSeasonId);
      const existing = noteByRequest.get(request.id);
      let id = existing?.id;
      if (existing) {
        await setDoc(docRef(db, seasonId, 'expenseNotes', id, sectionId), {
          ...note, billTo: existing.billTo || note.billTo, createdAt: existing.createdAt || serverTimestamp(), updatedAt: serverTimestamp()
        });
      } else {
        id = (await addDoc(collectionRef(db, seasonId, 'expenseNotes', sectionId), { ...note, createdAt: serverTimestamp() })).id;
      }
      toast(existing ? 'Note de frais refaite' : 'Note de frais créée');
      await openNote({ id, ...note, billTo: existing?.billTo || note.billTo });
    } catch (caught) {
      console.error('Création de la note:', caught);
      toast(caught?.message || 'Ça n\'a pas marché.', { tone: 'error' });
    }
  };

  const selected = jobs.filter((job) => selectedJobs.has(job.id));
  const selectedTotal = selected.reduce((sum, job) => sum + Number(job.total), 0);
  const opened = requests?.find((r) => r.id === openId)
    || (justCreated?.id === openId ? justCreated : null);

  // Cocher un boulot ou un client coche toutes ses lignes d'un coup.
  const toggleGroup = (group) => setSelectedJobs((current) => {
    const ids = group.jobs.map((job) => job.id);
    const all = ids.every((id) => current.has(id));
    const next = new Set(current);
    ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
    return next;
  });

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try { await action(); } catch (caught) { console.error('Paiements:', caught); setError(messageOf(caught)); } finally { setBusy(false); }
  };

  const createForJobs = () => run(async () => {
    const clients = [...new Set(selected.map((job) => (job.contactName || '').trim()).filter(Boolean))];
    if (clients.length > 1 && !confirm(`Ces boulots concernent plusieurs clients (${clients.join(', ')}). Les mettre sur la même demande ?`)) return;
    const first = selected.find((job) => job.contactName) || {};
    const created = await call('createJobsPaymentRequest', {
      jobPaths: selected.map((job) => docRef(db, seasonId, 'jobs', job.id, sectionId).path),
      payerName: clients.length === 1 ? clients[0] : '',
      payerPhone: clients.length === 1 ? (first.contactPhone || '') : ''
    });
    setJustCreated({
      ...created,
      status: 'pending',
      kind: 'jobs',
      label: clients.length === 1 ? `Boulots · ${clients[0]}` : (selected[0]?.description || 'Boulots'),
      targets: selected.map((job) => ({
        path: job.id,
        description: job.description,
        broName: job.broName,
        date: job.date,
        amountCents: Math.round(Number(job.total) * 100)
      }))
    });
    setSelectedJobs(new Set());
    setOpenId(created.id);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <Header title="Paiements" onBack={() => navigateTo('boulots')} />

      <div className="p-4 space-y-5">
        <p className="text-sm text-gray-600">
          Le client scanne un QR avec son app bancaire : le compte des {SECTIONS[sectionId] || sectionId}, le montant et la
          communication sont préremplis. Pour recharger un compte bar, passe par l'onglet Bar : chaque membre y a
          son propre QR.
        </p>

        {error && <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3" role="alert">{error}</p>}

        {/* Notes de frais */}
        {notes.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-bold mb-2">Notes de frais</h2>
            <ul className="space-y-3">
              {notes.map((note) => {
                const lines = note.lines || [];
                const amount = (list) => list.reduce((sum, l) => sum + l.hours * note.rate, 0);
                const total = amount(lines);
                const otherTotal = amount(lines.filter((l) => l.sectionId !== note.sectionId));
                const request = requestById.get(note.paymentRequestId);
                const debt = debtByRequest.get(note.paymentRequestId);
                const status = request ? STATUS[request.status] : { label: 'Sans QR', tone: 'bg-gray-200 text-gray-600' };
                return (
                  <li key={note.id} className="bg-white rounded-2xl ring-1 ring-gray-200 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold leading-tight">{note.description}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {note.billTo || 'Sans client indiqué'} · {formatDate(note.date)} · {lines.length} participant{lines.length > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="text-right flex-none">
                        <span className="block font-display text-xl font-extrabold">{formatCurrency(total)}</span>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${status?.tone}`}>{status?.label}</span>
                      </span>
                    </div>

                    {otherTotal > 0 && (
                      <p className={`text-sm rounded-xl px-3 py-2 ${
                        debt?.status === 'settled' ? 'bg-green-50 text-green-800'
                          : note.collectTogether ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-600'
                      }`}>
                        {!note.collectTogether
                          ? `Part des ${note.otherLabel} : ${formatCurrency(otherTotal)}, demandée par leur section`
                          : debt?.status === 'settled'
                            ? `${formatCurrency(otherTotal)} versés aux ${note.otherLabel} ✓`
                            : debt
                              ? `Dont ${formatCurrency(otherTotal)} à verser aux ${note.otherLabel}`
                              : `Dont ${formatCurrency(otherTotal)} pour les ${note.otherLabel}, à leur verser après paiement`}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openNote(note)}
                        disabled={openingNote === note.id}
                        className="flex-1 p-2.5 rounded-xl bg-gray-900 text-gray-50 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
                      >
                        <FileText size={16} />{openingNote === note.id ? 'Ouverture…' : 'Ouvrir la note'}
                      </button>
                      {request && (
                        <button
                          onClick={() => setOpenId(request.id)}
                          className="p-2.5 px-4 rounded-xl bg-white ring-1 ring-gray-200 text-sm font-semibold flex items-center gap-2 active:scale-95 transition-transform"
                        >
                          <QrCode size={16} />Paiement
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Boulots à encaisser */}
        <section>
          <h2 className="font-display text-lg font-bold mb-2">Boulots à encaisser</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500 bg-white rounded-2xl ring-1 ring-gray-200 p-4">
              Aucun boulot fait en attente de paiement.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key || 'sans-client'} className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
                  <button onClick={() => toggleGroup(group)} className="w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-gray-100 text-left">
                    <span className="font-semibold truncate">{group.name || 'Sans client indiqué'}</span>
                    <span className="text-xs text-gray-600 flex-none">
                      {group.works.length} boulot{group.works.length > 1 ? 's' : ''} · tout cocher
                    </span>
                  </button>
                  <ul className="divide-y divide-gray-100">
                    {group.works.map((work) => {
                      const ids = work.jobs.map((job) => job.id);
                      const checked = ids.every((id) => selectedJobs.has(id));
                      const total = work.jobs.reduce((sum, job) => sum + Number(job.total), 0);
                      const names = work.jobs.map((job) => job.broName).filter(Boolean);
                      return (
                        <li key={work.key}>
                          <label className="flex items-center gap-3 px-4 py-2.5">
                            <input
                              id={`work-${work.key}`}
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroup(work)}
                              className="w-5 h-5 flex-none"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium truncate">{work.description}</span>
                              <span className="block text-xs text-gray-500 truncate">
                                {formatDate(work.date)} · {names.length > 1 ? `${names.length} participants : ${names.join(', ')}` : names[0]}
                              </span>
                            </span>
                            <span className="font-mono text-sm flex-none">{formatCurrency(total)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <button
              onClick={createForJobs}
              disabled={busy}
              className="mt-3 w-full p-3.5 rounded-2xl bg-green-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <QrCode size={18} />
              Créer le QR · {formatCurrency(selectedTotal)}
            </button>
          )}
        </section>

        {/* Demandes */}
        <section>
          <h2 className="font-display text-lg font-bold mb-2">Demandes</h2>
          {requests === null && <p className="text-sm text-gray-500">Chargement…</p>}
          {listError && (
            <p className="text-sm text-red-700 bg-red-50 rounded-2xl p-4" role="alert">
              L'app n'a pas le droit de lire les demandes de paiement : les règles Firestore publiées ne sont pas à
              jour. Les demandes déjà créées existent bien et réapparaîtront ici dès que l'admin aura publié les
              nouvelles règles.
            </p>
          )}
          {!listError && requests?.length === 0 && (
            <p className="text-sm text-gray-500 bg-white rounded-2xl ring-1 ring-gray-200 p-4">Aucune demande pour l'instant.</p>
          )}
          {requests?.length > 0 && (
            <ul className="bg-white rounded-2xl ring-1 ring-gray-200 divide-y divide-gray-100 overflow-hidden">
              {requests.map((request) => (
                <li key={request.id}>
                  <button onClick={() => setOpenId(request.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">
                        {noteByRequest.has(request.id) && <FileText size={14} className="inline -mt-0.5 mr-1 text-gray-500" aria-label="Avec note de frais" />}
                        {request.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {request.createdAt?.toDate?.().toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }) || 'À l\'instant'}
                        {' · '}{request.createdByName}
                      </span>
                    </span>
                    <span className="font-mono text-sm flex-none">{euros(request.amountCents)}</span>
                    <span className={`flex-none px-2 py-0.5 rounded-full text-xs font-bold ${STATUS[request.status]?.tone}`}>
                      {STATUS[request.status]?.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal isOpen={Boolean(opened)} onClose={() => setOpenId(null)} title={opened?.label || 'Demande'}>
        {opened && (
          <RequestDetail
            key={opened.id}
            request={opened}
            onClose={() => setOpenId(null)}
            onOpenNote={noteByRequest.has(opened.id) ? () => openNote(noteByRequest.get(opened.id)) : undefined}
            onCreateNote={opened.kind === 'jobs' && opened.status !== 'cancelled' && opened.targets?.[0]?.path?.includes('/')
              && (!noteByRequest.has(opened.id) || noteByRequest.get(opened.id).rebuiltFromRequest) ? () => createNote(opened) : undefined}
            createNoteLabel={noteByRequest.has(opened.id) ? 'Refaire la note de frais' : 'Créer la note de frais'}
          />
        )}
      </Modal>

      {shownNote && (
        <ExpenseNote
          note={shownNote}
          onClose={() => setShownNote(null)}
          onChangeBillTo={shownNote.id ? async (billTo) => {
            await updateDoc(docRef(db, seasonId, 'expenseNotes', shownNote.id, sectionId), { billTo, updatedAt: serverTimestamp() });
            setShownNote((current) => current && { ...current, billTo });
          } : undefined}
        />
      )}
    </div>
  );
};

export default Payments;
