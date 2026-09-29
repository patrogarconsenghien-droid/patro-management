import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MAX_DOTS = 3;

// Dates au format AAAA-MM-JJ, en heure locale : toISOString() passerait en UTC
// et décalerait d'un jour autour de minuit.
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseIso = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
};

const longDate = (iso) => parseIso(iso).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Calendrier pour choisir la date d'un boulot, avec les boulots déjà
 * programmés : on voit d'un coup d'œil les jours pris et les jours libres, ce
 * qui aide à proposer des dates au client.
 *
 * `jobs` : boulots programmés (ceux de la section et ceux que l'autre section
 * a ouverts, marqués `_shared`). `excludeId` : le boulot en cours de
 * modification, qu'on ne compte pas.
 */
export default function JobCalendar({ value, onChange, jobs = [], excludeId = null, otherLabel = 'autre section' }) {
  const [month, setMonth] = useState(() => {
    const d = parseIso(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = isoOf(new Date());

  const byDate = useMemo(() => {
    const map = new Map();
    jobs
      .filter((job) => job.date && job.id !== excludeId)
      .forEach((job) => {
        if (!map.has(job.date)) map.set(job.date, []);
        map.get(job.date).push(job);
      });
    map.forEach((list) => list.sort((a, b) => String(a.timeStart).localeCompare(String(b.timeStart))));
    return map;
  }, [jobs, excludeId]);

  // Grille du mois, semaines commençant le lundi.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d++) list.push(isoOf(new Date(month.getFullYear(), month.getMonth(), d)));
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);

  const shift = (delta) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const busyDays = cells.filter((iso) => iso && byDate.has(iso)).length;
  const selectedJobs = byDate.get(value) || [];

  return (
    <div className="rounded-2xl ring-1 ring-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Mois précédent" className="p-2 rounded-lg active:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="font-display font-bold capitalize">
            {month.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })}
          </p>
          <p className="text-xs text-gray-500">
            {busyDays === 0 ? 'Aucun boulot ce mois-ci' : `${busyDays} jour${busyDays > 1 ? 's' : ''} avec un boulot`}
          </p>
        </div>
        <button type="button" onClick={() => shift(1)} aria-label="Mois suivant" className="p-2 rounded-lg active:bg-gray-100">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day, i) => (
          <span key={i} className={`text-[11px] font-bold ${i >= 5 ? 'text-boulots-700' : 'text-gray-400'}`}>{day}</span>
        ))}

        {cells.map((iso, i) => {
          if (!iso) return <span key={`vide-${i}`} />;
          const dayJobs = byDate.get(iso) || [];
          const selected = iso === value;
          const past = iso < today;
          const weekend = i % 7 >= 5;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              aria-label={`${longDate(iso)}${dayJobs.length ? `, ${dayJobs.length} boulot${dayJobs.length > 1 ? 's' : ''}` : ', libre'}`}
              className={[
                'h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors',
                selected ? 'bg-gray-900 text-white' : dayJobs.length ? 'bg-boulots-50' : weekend ? 'bg-gray-50' : '',
                iso === today && !selected ? 'ring-2 ring-boulots-500' : '',
                past && !selected ? 'opacity-40' : ''
              ].join(' ')}
            >
              <span className={`text-sm leading-none ${dayJobs.length ? 'font-bold' : ''}`}>{Number(iso.slice(8))}</span>
              <span className="flex items-center gap-0.5 h-1.5">
                {dayJobs.slice(0, MAX_DOTS).map((job) => (
                  <span
                    key={job.id}
                    className={`w-1.5 h-1.5 rounded-full ${job._shared ? 'bg-purple-500' : selected ? 'bg-white' : 'bg-boulots-600'}`}
                  />
                ))}
                {dayJobs.length > MAX_DOTS && (
                  <span className={`text-[9px] leading-none font-bold ${selected ? 'text-white' : 'text-boulots-700'}`}>+</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-boulots-600" />Nos boulots</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />Boulots des {otherLabel}</span>
      </div>

      {/* Le jour choisi */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-sm font-semibold first-letter:uppercase">{longDate(value)}</p>
        {selectedJobs.length === 0 ? (
          <p className="text-sm text-green-700 mt-0.5">Aucun boulot ce jour-là : jour libre.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {selectedJobs.map((job) => {
              const registered = (job.registeredBros || []).length;
              return (
                <li key={job.id} className="text-sm flex items-baseline gap-2">
                  <span className="font-mono text-xs text-gray-500 flex-none w-11">{job.timeStart || '—'}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {job.description}
                    {job._shared && <span className="text-purple-700"> · {otherLabel}</span>}
                  </span>
                  <span className="flex-none text-xs text-gray-500">{registered}/{job.brosNeeded}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
