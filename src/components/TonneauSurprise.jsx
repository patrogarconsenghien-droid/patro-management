// TonneauSurprise.jsx
// Composant autonome prêt à coller dans App.jsx (au-dessus du return principal)

import React, { useEffect, useState } from 'react';

/**
 * Props:
 * - open (bool)
 * - surprises (Array of product objects: { id, name, rarity? })
 * - onComplete(revealedSurprises) called when animation finished
 *
 * Usage:
 * <TonneauSurprise
 *   open={showRoulette}
 *   surprises={rouletteSurprises}
 *   onComplete={(revealed) => { /* build orderConfirmation here *\/ }}
 * />
 */
export default function TonneauSurprise({ open, surprises = [], onComplete }) {
  const [stage, setStage] = useState('idle'); // idle -> opening -> revealing -> done
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState([]);

  useEffect(() => {
    if (!open) {
      setStage('idle');
      setIndex(0);
      setRevealed([]);
      return;
    }

    // Start sequence
    setStage('opening');

    // Open animation (800ms) -> then reveal each surprise one by one
    const openTimer = setTimeout(() => {
      setStage('revealing');
      // reveal items sequentially
      if (surprises.length === 0) {
        // still call complete after a short delay
        setTimeout(() => {
          setStage('done');
          onComplete && onComplete([]);
        }, 600);
        return;
      }

      let i = 0;
      const revealInterval = 900; // ms between reveals

      const revealNext = () => {
        if (i >= surprises.length) {
          // finished
          setTimeout(() => {
            setStage('done');
            onComplete && onComplete(revealed.concat());
          }, 700);
          return;
        }

        const next = surprises[i];
        setRevealed(prev => [...prev, next]);
        i += 1;
        setIndex(i);
        setTimeout(revealNext, revealInterval);
      };

      // start revealing first after small delay
      setTimeout(revealNext, 250);

    }, 800);

    return () => clearTimeout(openTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // helper for rarity-based classes
  const rarityClass = (p) => {
    const r = (p && p.rarity) || p?.rarity || 'normal';
    switch (r.toLowerCase()) {
      case 'commun': case 'common': return 'rarity-commun';
      case 'normal': return 'rarity-normal';
      case 'rare': return 'rarity-rare';
      case 'legendaire': case 'legendary': return 'rarity-legendaire';
      default: return 'rarity-normal';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
      <div className="relative w-full max-w-lg">
        {/* TONNEAU SVG + animation */}
        <div className="flex flex-col items-center">
          <div className={`tonneau-wrap ${stage === 'opening' ? 'open' : ''} ${stage === 'revealing' ? 'reveal' : ''}`}>
            {/* barrel body */}
            <svg viewBox="0 0 300 260" className="w-72 h-64" xmlns="http://www.w3.org/2000/svg">
              {/* staves */}
              <defs>
                <linearGradient id="wood" x1="0" x2="1">
                  <stop offset="0%" stopColor="#7a4a2a" />
                  <stop offset="100%" stopColor="#4e2f1a" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge><feMergeNode in="b"/></feMerge>
                </filter>
              </defs>

              {/* barrel body */}
              <ellipse cx="150" cy="140" rx="110" ry="70" fill="url(#wood)" stroke="#3b2a20" strokeWidth="6" />
              <rect x="40" y="80" width="220" height="120" rx="60" ry="60" fill="url(#wood)" stroke="#3b2a20" strokeWidth="6" />

              {/* lid (we'll rotate this part with CSS) */}
              <g className="tonneau-lid" transform="translate(0,0)">
                <rect x="48" y="32" width="204" height="48" rx="20" ry="20" fill="#6b3f24" stroke="#3b2a20" strokeWidth="6" />
                <rect x="88" y="40" width="124" height="8" rx="4" ry="4" fill="#2c1a12" />
              </g>
            </svg>

            {/* particles when revealing */}
            <div className="absolute inset-0 pointer-events-none flex items-start justify-center">
              {stage === 'revealing' && (
                <div className="particles w-full h-full">
                  {/* create some decorative spans */}
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span key={i} className={`particle p-${i}`}></span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revealed cards stack */}
          <div className="mt-6 w-full flex flex-col items-center space-y-3">
            {revealed.map((p, idx) => (
              <div key={`${p.id}-${idx}`} className={`result-card transform transition-all duration-700 ${rarityClass(p)} ${stage === 'revealing' ? 'pop-in' : ''}`}>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">🍺</div>
                  <div className="text-left">
                    <div className="text-sm opacity-80">Verre Surprise</div>
                    <div className="text-lg font-semibold">{p.name}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs opacity-80">Rareté: {p.rarity || 'normal'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* central card shown after done */}
        {stage === 'done' && revealed.length > 0 && (
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-md text-center">
              <h3 className="text-xl font-bold mb-2">Résultat</h3>
              <div className="space-y-3">
                {revealed.map((p, i) => (
                  <div key={`final-${p.id}-${i}`} className={`final-item p-3 rounded-lg ${rarityClass(p)} flex items-center justify-between`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">🍺</div>
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs opacity-80">{p.rarity || 'normal'}</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{p.price ? `${p.price} €` : ''}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-center">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={() => {
                  // close and report
                  onComplete && onComplete(revealed);
                }}>OK</button>
              </div>
            </div>
          </div>
        )}

        {/* Styles scoped for the component */}
        <style>{`
          .tonneau-wrap { position: relative; }
          .tonneau-lid { transform-origin: 150px 56px; transition: transform 700ms cubic-bezier(0.2,0.9,0.3,1); }
          .tonneau-wrap.open .tonneau-lid { transform: rotate(-45deg) translate(-10px,-6px); }

          .particle { position: absolute; width: 8px; height: 8px; border-radius: 50%; opacity: 0; }
          .particles .particle { animation: particle-float 1200ms linear forwards; }

          /* random-ish animations */
          ${Array.from({ length: 18 }).map((_, i) => {
            const left = Math.round(Math.random()*80)+10;
            const delay = (i * 60);
            const dur = 1000 + Math.round(Math.random()*800);
            return `.particles .p-${i} { left: ${left}%; bottom: 40%; background: rgba(255,255,255,${0.85 - Math.random()*0.4}); transform: translateY(0); animation-delay: ${delay}ms; animation-duration: ${dur}ms; }`;
          }).join('\n')}

          @keyframes particle-float { from { opacity: 1; transform: translateY(0) scale(0.6); } to { opacity: 0; transform: translateY(-120px) scale(1.1); } }

          .result-card { width: 92%; max-width: 520px; background: rgba(255,255,255,0.06); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px); color: white; box-shadow: 0 6px 20px rgba(2,6,23,0.45); }
          .pop-in { transform: translateY(-6px) scale(1.02); }

          /* rarity styles */
          .rarity-commun { border: 1px solid rgba(255,255,255,0.04); background: linear-gradient(90deg, rgba(120,120,120,0.12), rgba(80,80,80,0.06)); }
          .rarity-normal { border: 1px solid rgba(59,130,246,0.15); background: linear-gradient(90deg, rgba(59,130,246,0.06), rgba(59,130,246,0.03)); }
          .rarity-rare { border: 1px solid rgba(139,92,246,0.18); background: linear-gradient(90deg, rgba(139,92,246,0.06), rgba(139,92,246,0.03)); }
          .rarity-legendaire { border: 1px solid rgba(245,158,11,0.28); background: linear-gradient(90deg, rgba(245,158,11,0.09), rgba(245,158,11,0.03)); box-shadow: 0 10px 30px rgba(245,158,11,0.12); filter: drop-shadow(0 6px 20px rgba(245,158,11,0.12)); }

          /* final card styles */
          .final-item { display:flex; align-items:center; justify-content:space-between; }

        `}</style>
      </div>
    </div>
  );
}


/* Integration notes (à lire dans le fichier d'aide) :

1) Colle ce composant dans App.jsx (ou crée un fichier TonneauSurprise.jsx et importes-le).

2) Remplace le bloc Modal existant qui affichait showRoulette par :

  <TonneauSurprise
    open={showRoulette}
    surprises={rouletteSurprises.map(p => ({ id: p.id, name: p.name, rarity: p.rarity || (p.weight === 1 ? 'legendaire' : 'normal'), price: p.price }))}
    onComplete={(revealed) => {
      // revealed = liste d'objets retournée par le composant
      // Tu peux copier ici le code qui construisait orderItems + setOrderConfirmation
      // Exemple rapide (garde ton implémentation actuelle) :
      setShowRoulette(false);
      const orderItems = revealed.map(p => ({ productId: p.id, productName: `🎲 Verre Surprise : ${p.name}`, quantity: 1, pricePerUnit: surpriseSettings.price, total: surpriseSettings.price, saleType: 'unit' }));
      // puis merge avec les autres items du panier comme tu le fais déjà et setOrderConfirmation(...)
  }}

3) Supprime/neutralise le setTimeout de 4000ms dans validateOrder() qui fermait la fenêtre — on attend maintenant le callback onComplete.

*/
