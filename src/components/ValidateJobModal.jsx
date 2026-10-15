import React, { useMemo, useState } from 'react';
import { FileText, Minus, Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import BroAvatar from './BroAvatar';
import { formatCurrency } from '../lib/format';
import { vocabFor } from '../lib/vocab';
import { SECTIONS } from '../auth/account';
import { otherSectionId } from '../lib/seasons';

const STEP = 0.5;
const roundHalf = (value) => Math.max(0, Math.round(Number(value) * 2) / 2);
const hoursLabel = (value) => `${String(value).replace('.', ',')} h`;

/**
 * Valider un boulot programmé : heures de chacun, ajout ou retrait de
 * participants, tarif, et note de frais pour la personne qui paie.
 *
 * - `lines` part des inscrits, avec la durée prévue.
 * - On n'ajoute que des membres de sa section : on ne lit pas ceux de l'autre.
 * - `onConfirm({ lines, rate, billTo, withNote, collectTogether })` écrit
 *   tout ; `onPreview` ouvre la note sans rien valider.
 * - `collectTogether` : avec des membres de l'autre section, le client paie
 *   tout en une fois chez nous (réglage de la section, modifiable ici).
 */
export default function ValidateJobModal({
  job, bros = [], broPhotos = {}, sectionId, collectOpenJobsTogether = false, onConfirm, onPreview, onClose
}) {
  const v = vocabFor(sectionId);
  const otherLabel = SECTIONS[otherSectionId(sectionId)];
  const defaultHours = job.estimatedHours || 1;
  const [lines, setLines] = useState(() =>
    (job.registeredBros || []).map((registration) => {
      const bro = bros.find((b) => b.id === registration.broId);
      return {
        key: `${registration.sectionId || sectionId}:${registration.broId}`,
        broId: registration.broId,
        sectionId: registration.sectionId || sectionId,
        name: registration.name || bro?.name || 'Inconnu',
        hours: defaultHours
      };
    })
  );
  const [rate, setRate] = useState(String(job.customRate ?? ''));
  const [billTo, setBillTo] = useState(job.contactName || '');
  const [withNote, setWithNote] = useState(true);
  const [collectTogether, setCollectTogether] = useState(collectOpenJobsTogether);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);

  const rateValue = Number(String(rate).replace(',', '.')) || 0;
  const totalHours = lines.reduce((sum, l) => sum + l.hours, 0);
  const total = totalHours * rateValue;
  const otherTotal = lines.filter((l) => l.sectionId !== sectionId).reduce((sum, l) => sum + l.hours, 0) * rateValue;
  const invalid = lines.length === 0 || lines.some((l) => !(l.hours > 0)) || !(rateValue > 0);

  const addable = useMemo(
    () => [...bros]
      .filter((bro) => !lines.some((l) => l.sectionId === sectionId && l.broId === bro.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [bros, lines, sectionId]
  );

  const setHours = (key, value) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, hours: roundHalf(value) } : l)));

  const addPerson = (broId) => {
    const bro = bros.find((b) => b.id === broId);
    if (!bro) return;
    setLines((current) => [...current, {
      key: `${sectionId}:${bro.id}`, broId: bro.id, sectionId, name: bro.name, hours: defaultHours
    }]);
    setAdding('');
  };

  const payload = () => ({ lines, rate: rateValue, billTo: billTo.trim(), withNote, collectTogether: collectTogether && otherTotal > 0 });

  const confirm = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      await onConfirm(payload());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Valider le boulot">
      <div className="space-y-5">
        <div>
          <p className="font-semibold leading-tight">{job.description}</p>
          <p className="text-sm text-gray-500">
            Prévu : {job.registeredBros.length}/{job.brosNeeded} inscrit{v.e}s · {hoursLabel(defaultHours)} chacun
          </p>
        </div>

        {/* Qui a travaillé, et combien de temps */}
        <div>
          <p className="text-sm font-semibold mb-2">Qui a travaillé</p>
          {lines.length === 0 && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">Personne : ajoute au moins une personne.</p>
          )}
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50">
                <BroAvatar name={l.name} photoURL={l.sectionId === sectionId ? broPhotos[l.broId] : undefined} size="sm" />
                <span className="flex-1 min-w-0 truncate font-medium text-sm">{l.name}</span>
                <button
                  onClick={() => setHours(l.key, l.hours - STEP)}
                  className="w-8 h-8 grid place-items-center rounded-lg bg-white ring-1 ring-gray-200 active:scale-90 transition-transform"
                  aria-label={`Une demi-heure de moins pour ${l.name}`}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  step={STEP}
                  min="0"
                  value={l.hours}
                  onChange={(e) => setHours(l.key, e.target.value)}
                  className="w-14 p-1.5 rounded-lg border text-center font-mono text-sm"
                  aria-label={`Heures de ${l.name}`}
                />
                <button
                  onClick={() => setHours(l.key, l.hours + STEP)}
                  className="w-8 h-8 grid place-items-center rounded-lg bg-white ring-1 ring-gray-200 active:scale-90 transition-transform"
                  aria-label={`Une demi-heure de plus pour ${l.name}`}
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                  className="w-8 h-8 grid place-items-center rounded-lg text-red-600 active:scale-90 transition-transform"
                  aria-label={`Retirer ${l.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>

          {addable.length > 0 && (
            <select
              value={adding}
              onChange={(e) => addPerson(e.target.value)}
              className="mt-2 w-full p-2.5 rounded-xl border text-sm"
            >
              <option value="">+ Ajouter quelqu'un…</option>
              {addable.map((bro) => <option key={bro.id} value={bro.id}>{bro.name}</option>)}
            </select>
          )}
        </div>

        {/* Tarif et total */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold">Tarif / heure</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="mt-1 w-full p-2.5 rounded-xl border font-mono"
            />
          </label>
          <div className="text-sm">
            <span className="font-semibold">Total</span>
            <p className="mt-1 p-2.5 rounded-xl bg-green-50 text-green-800 font-mono font-bold">
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{hoursLabel(totalHours)} au total</p>
          </div>
        </div>

        {/* Note de frais */}
        <div className="rounded-xl ring-1 ring-gray-200 p-3 space-y-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm">
              <span className="font-semibold block">Note de frais</span>
              <span className="text-gray-500">Une ligne par personne, et le QR de virement de la demande de paiement</span>
            </span>
            <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} className="w-5 h-5" />
          </label>
          {withNote && (
            <>
              <label className="block text-sm">
                <span className="text-gray-600">Pour (qui paie)</span>
                <input
                  type="text"
                  value={billTo}
                  onChange={(e) => setBillTo(e.target.value)}
                  placeholder="Nom de la personne ou de l'organisme"
                  className="mt-1 w-full p-2.5 rounded-xl border"
                />
              </label>
              {otherTotal > 0 && (
                <div className="text-sm space-y-1.5">
                  <p className="text-gray-600">Part des {otherLabel} : {formatCurrency(otherTotal)}</p>
                  {[
                    { value: true, label: 'Le client paie tout ici', detail: `un seul QR ; on doit ${formatCurrency(otherTotal)} aux ${otherLabel}` },
                    { value: false, label: 'Chaque section demande sa part', detail: `les ${otherLabel} envoient leur propre demande` }
                  ].map((option) => (
                    <label key={String(option.value)} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="collect-together"
                        checked={collectTogether === option.value}
                        onChange={() => setCollectTogether(option.value)}
                        className="mt-1"
                      />
                      <span><span className="font-medium">{option.label}</span> <span className="text-gray-500">· {option.detail}</span></span>
                    </label>
                  ))}
                </div>
              )}
              <button
                onClick={() => onPreview(payload())}
                disabled={invalid}
                className="w-full inline-flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gray-100 text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
              >
                <FileText size={16} /> Aperçu de la note
              </button>
            </>
          )}
        </div>

        <button
          onClick={confirm}
          disabled={invalid || saving}
          className="w-full p-3.5 rounded-xl bg-green-500 text-white text-base font-bold shadow-md disabled:opacity-40 active:scale-95 transition-transform"
        >
          {saving ? 'Validation…' : `Valider · ${formatCurrency(total)}`}
        </button>
        {lines.length > 0 && lines.length < job.brosNeeded && (
          <p className="text-xs text-orange-700 text-center -mt-3">
            {lines.length} sur {job.brosNeeded} prévus : le boulot sera noté comme partiel.
          </p>
        )}
      </div>
    </Modal>
  );
}
