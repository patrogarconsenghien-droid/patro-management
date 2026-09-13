import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ROLE_LABELS, ROLES, SECTIONS, isAdmin } from './auth/account';

const STATUS_LABELS = {
  pending: 'En attente',
  active: 'Actif',
  disabled: 'Désactivé'
};

const STATUS_TONES = {
  pending: 'bg-orange-100 text-orange-800',
  active: 'bg-green-100 text-green-800',
  disabled: 'bg-gray-200 text-gray-600'
};

const initialsOf = (name) =>
  String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

/**
 * Gestion des comptes : valider les nouveaux comptes, choisir leur rôle et leur
 * section, les relier à leur Bro, désactiver un compte.
 *
 * Un animateur gère les comptes de sa section et les comptes en attente ; il ne
 * peut pas nommer d'admin ni modifier un admin. Personne ne modifie son propre
 * compte, pour ne jamais se retirer l'accès par erreur.
 */
const Accounts = ({ Header, navigateTo, account, bros = [], saveToFirebase }) => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const me = account?.profile;
  const meIsAdmin = isAdmin(me);

  useEffect(() => onSnapshot(
    collection(db, 'users'),
    (snapshot) => setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (readError) => {
      console.error('Lecture des comptes impossible:', readError);
      setError(readError);
    }
  ), []);

  const visibleUsers = useMemo(() => {
    const order = { pending: 0, active: 1, disabled: 2 };
    return users
      .filter((u) => meIsAdmin || u.status === 'pending' || u.sectionId === me?.sectionId)
      .sort((a, b) =>
        (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
        String(a.displayName).localeCompare(String(b.displayName))
      );
  }, [users, meIsAdmin, me?.sectionId]);

  const linkedBroIds = useMemo(
    () => new Map(users.filter((u) => u.broId).map((u) => [u.broId, u.id])),
    [users]
  );

  const pendingCount = visibleUsers.filter((u) => u.status === 'pending').length;

  const update = async (target, changes) => {
    setBusyId(target.id);
    try {
      await updateDoc(doc(db, 'users', target.id), {
        ...changes,
        updatedAt: serverTimestamp(),
        updatedBy: me?.email || null
      });
    } catch (updateError) {
      console.error('Mise à jour du compte impossible:', updateError);
      alert(`La modification du compte de ${target.displayName} a échoué.`);
    } finally {
      setBusyId(null);
    }
  };

  const validate = (target) => {
    if (!target.role || !target.sectionId) {
      alert('Choisis d\'abord un rôle et une section pour ce compte.');
      return;
    }
    if (target.role === ROLES.ANIME && !target.broId) {
      const ok = confirm(
        `${target.displayName} n'est relié à aucun Bro : il ne pourra pas répondre aux boulots.\n\nValider quand même ?`
      );
      if (!ok) return;
    }
    update(target, { status: 'active', validatedAt: serverTimestamp() });
  };

  const createBroFor = async (target) => {
    const name = String(target.displayName || '').trim();
    if (!name) return;
    setBusyId(target.id);
    try {
      const broId = await saveToFirebase('bros', { name, totalHours: 0 });
      await updateDoc(doc(db, 'users', target.id), {
        broId,
        updatedAt: serverTimestamp(),
        updatedBy: me?.email || null
      });
    } catch (createError) {
      console.error('Création du Bro impossible:', createError);
      alert(`Impossible de créer le Bro « ${name} ».`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <Header title="Comptes" onBack={() => navigateTo('settings')} />

      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600">
          {pendingCount > 0
            ? `${pendingCount} compte${pendingCount > 1 ? 's' : ''} en attente de validation.`
            : 'Aucun compte en attente.'}
        </p>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3" role="alert">
            Les comptes n'ont pas pu être chargés.
          </p>
        )}

        {visibleUsers.map((target) => {
          const isSelf = target.id === me?.id;
          const targetIsAdmin = target.role === ROLES.ADMIN;
          const locked = isSelf || busyId === target.id || (!meIsAdmin && targetIsAdmin);
          const hasMatchingBro = bros.some(
            (bro) => bro.name?.trim().toLowerCase() === String(target.displayName || '').trim().toLowerCase()
          );

          return (
            <div key={target.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {target.photoURL ? (
                  <img src={target.photoURL} alt="" className="w-10 h-10 rounded-full flex-none" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-10 h-10 rounded-full flex-none grid place-items-center bg-purple-500 text-white text-sm font-bold">
                    {initialsOf(target.displayName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {target.displayName}{isSelf && <span className="text-gray-500 font-normal"> (toi)</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{target.email}</p>
                </div>
                <span className={`flex-none text-xs font-semibold px-2 py-1 rounded-full ${STATUS_TONES[target.status] || STATUS_TONES.pending}`}>
                  {STATUS_LABELS[target.status] || 'En attente'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Rôle
                  <select
                    value={target.role || ''}
                    disabled={locked}
                    onChange={(e) => update(target, { role: e.target.value || null })}
                    className="mt-1 w-full p-2 border rounded-lg text-sm disabled:opacity-60"
                  >
                    <option value="">Choisir…</option>
                    <option value={ROLES.ANIME}>{ROLE_LABELS.anime}</option>
                    <option value={ROLES.ANIMATEUR}>{ROLE_LABELS.animateur}</option>
                    {meIsAdmin && <option value={ROLES.ADMIN}>{ROLE_LABELS.admin}</option>}
                  </select>
                </label>

                <label className="text-xs text-gray-600">
                  Section
                  <select
                    value={target.sectionId || ''}
                    disabled={locked || !meIsAdmin}
                    onChange={(e) => update(target, { sectionId: e.target.value || null })}
                    className="mt-1 w-full p-2 border rounded-lg text-sm disabled:opacity-60"
                  >
                    <option value="">Choisir…</option>
                    {Object.entries(SECTIONS).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {!meIsAdmin && !target.sectionId && !locked && (
                <button
                  onClick={() => update(target, { sectionId: me?.sectionId })}
                  className="text-xs text-blue-600 underline"
                >
                  Mettre dans ma section ({SECTIONS[me?.sectionId]})
                </button>
              )}

              <label className="block text-xs text-gray-600">
                Relié au Bro
                <select
                  value={target.broId || ''}
                  disabled={locked}
                  onChange={(e) => update(target, { broId: e.target.value || null })}
                  className="mt-1 w-full p-2 border rounded-lg text-sm disabled:opacity-60"
                >
                  <option value="">Aucun</option>
                  {[...bros]
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                    .map((bro) => {
                      const takenBy = linkedBroIds.get(bro.id);
                      const takenByOther = takenBy && takenBy !== target.id;
                      return (
                        <option key={bro.id} value={bro.id} disabled={takenByOther}>
                          {bro.name}{takenByOther ? ' (déjà relié)' : ''}
                        </option>
                      );
                    })}
                </select>
              </label>

              {!target.broId && !hasMatchingBro && !locked && target.displayName && (
                <button
                  onClick={() => createBroFor(target)}
                  className="text-xs text-blue-600 underline"
                >
                  Créer le Bro « {target.displayName} » et le relier
                </button>
              )}

              {!locked && (
                <div className="flex gap-2 pt-1">
                  {target.status !== 'active' && (
                    <button
                      onClick={() => validate(target)}
                      className="flex-1 p-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold active:scale-95 transition-transform"
                    >
                      {target.status === 'disabled' ? 'Réactiver' : 'Valider'}
                    </button>
                  )}
                  {target.status !== 'disabled' && (
                    <button
                      onClick={() => {
                        if (confirm(`Désactiver le compte de ${target.displayName} ? Il n'aura plus accès à l'app.`)) {
                          update(target, { status: 'disabled' });
                        }
                      }}
                      className="flex-1 p-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold active:scale-95 transition-transform"
                    >
                      Désactiver
                    </button>
                  )}
                </div>
              )}

              {isSelf && (
                <p className="text-xs text-gray-500">Tu ne peux pas modifier ton propre compte.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Accounts;
