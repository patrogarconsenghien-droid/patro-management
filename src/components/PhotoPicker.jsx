import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import BroAvatar from './BroAvatar';
import { uploadBroPhoto } from '../lib/photos';
import { toast } from '../lib/feedback';

/**
 * Avatar cliquable : choisir ou prendre une photo, la réduire, l'envoyer,
 * puis enregistrer son adresse sur le Bro via `onSaved`.
 */
export default function PhotoPicker({ name, photoURL, sectionId, broId, onSaved, size = 'md', compact = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadBroPhoto({ sectionId, broId, file });
      await onSaved(url);
      toast('Photo enregistrée');
    } catch (error) {
      console.error('Envoi de la photo impossible:', error);
      const detail = /storage\/unauthorized/.test(error?.code) ? "Tu n'as pas le droit de changer cette photo."
        : /storage\/(unknown|retry-limit|bucket)/.test(error?.code) ? "Le stockage des photos n'est pas encore activé sur Firebase."
          : error?.message || 'Réessaie.';
      toast(`Photo non enregistrée. ${detail}`, { tone: 'error', duration: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); input.current?.click(); }}
        disabled={busy}
        className={`relative flex-none ${compact ? 'inline-flex items-center gap-2 text-sm text-gray-600' : ''} active:scale-95 transition-transform disabled:opacity-60`}
        title="Changer la photo"
        aria-label={`Changer la photo de ${name}`}
      >
        {compact ? (
          <>
            <Camera size={16} />
            <span>{photoURL ? 'Changer la photo' : 'Ajouter une photo'}</span>
          </>
        ) : (
          <>
            <BroAvatar name={name} photoURL={photoURL} size={size} className="ring-2 ring-white shadow-md" />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-900 text-gray-50 grid place-items-center ring-2 ring-gray-50">
              <Camera size={12} />
            </span>
          </>
        )}
      </button>
    </>
  );
}
