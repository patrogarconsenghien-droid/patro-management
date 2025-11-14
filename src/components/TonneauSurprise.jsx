// TonneauSurprise.jsx – Version avec TAP obligatoire avant toute animation
// et sans affichage "touchez pour continuer"

import React, { useEffect, useRef, useState } from "react";

export default function TonneauSurprise({ open, surprises = [], onComplete }) {
  const [stage, setStage] = useState("idle");
  const [revealed, setRevealed] = useState([]);
  const [specialEffect, setSpecialEffect] = useState(null);
  const [showSmoke, setShowSmoke] = useState(false);
  const [lidKick, setLidKick] = useState(false);

  const [awaitTap, setAwaitTap] = useState(false);
  const tapResolver = useRef(null);

  const timeoutsRef = useRef([]);

  // -----------------------------
  // TOUCH / CLICK pour avancer
  // -----------------------------
  useEffect(() => {
    const handleTap = () => {
      if (awaitTap && tapResolver.current) {
        tapResolver.current();
        tapResolver.current = null;
        setAwaitTap(false);
      }
    };

    window.addEventListener("click", handleTap);
    window.addEventListener("touchend", handleTap);

    return () => {
      window.removeEventListener("click", handleTap);
      window.removeEventListener("touchend", handleTap);
    };
  }, [awaitTap]);

  function waitForTap() {
    return new Promise((resolve) => {
      tapResolver.current = resolve;
      setAwaitTap(true);
    });
  }

  // -----------------------------
  // MAIN OPENING SEQUENCE
  // -----------------------------
  useEffect(() => {
    const clearAll = () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };

    if (!open) {
      clearAll();
      setStage("idle");
      setRevealed([]);
      setSpecialEffect(null);
      setShowSmoke(false);
      setLidKick(false);
      setAwaitTap(false);
      tapResolver.current = null;
      return;
    }

    // Start
    setStage("opening");
    setRevealed([]);

    // ⬇ Séquence asynchrone complète
    (async () => {
      // 🔥 PREMIER TAP OBLIGATOIRE (avant toute animation)
      await waitForTap();

      const openTimer = setTimeout(() => {
        setStage("opening-lid");

        const shakeDuration = 600;

        const afterShake = setTimeout(() => {
          setShowSmoke(true);
          const tSm = setTimeout(() => setShowSmoke(false), 900);
          timeoutsRef.current.push(tSm);

          setStage("revealing");

          if (!surprises || surprises.length === 0) {
            const tDone = setTimeout(() => {
              setStage("done");
              onComplete && onComplete([]);
            }, 600);
            timeoutsRef.current.push(tDone);
            return;
          }

          let i = 0;

          // -------------------------
          // RÉVÉLATION AVEC TAP
          // -------------------------
          const revealNext = async () => {
            if (i >= surprises.length) {
              const t = setTimeout(() => {
                setStage("done");
                onComplete && onComplete(revealed.concat());
              }, 700);

              timeoutsRef.current.push(t);
              return;
            }

            const next = surprises[i];

            // Ajout carte
            setRevealed((prev) => [...prev, next]);

            // Kick couvercle
            setLidKick(false);
            setTimeout(() => setLidKick(true), 30);
            setTimeout(() => setLidKick(false), 300);

            // Effets
            if (next.rarity === "rare") {
              setSpecialEffect("rare");
              setTimeout(() => setSpecialEffect(null), 1400);
            } else if (["legendaire", "legendary"].includes(next.rarity)) {
              setSpecialEffect("legendaire");
              setTimeout(() => setSpecialEffect(null), 2000);
            }

            i++;

            // 🔥 TAP NÉCESSAIRE POUR LA CARTE SUIVANTE
            await waitForTap();

            revealNext();
          };

          const tStart = setTimeout(revealNext, 400);
          timeoutsRef.current.push(tStart);
        }, shakeDuration);

        timeoutsRef.current.push(afterShake);
      }, 300);

      timeoutsRef.current.push(openTimer);
    })();

    return () => clearAll();
  }, [open]);

  // -----------------------------
  // Rarity stylisation
  // -----------------------------
  const rarityClass = (p) => {
    const r = (p?.rarity || "normal").toLowerCase();
    switch (r) {
      case "commun":
      case "common":
        return "rarity-commun";
      case "rare":
        return "rarity-rare";
      case "legendaire":
      case "legendary":
        return "rarity-legendaire";
      default:
        return "rarity-normal";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="relative w-full max-w-lg h-[90vh] flex items-center justify-center">

        {/* ❌ Texte supprimé — aucun affichage "tap to continue" */}

        {/* Effets rares */}
        {specialEffect === "rare" && (
          <div className="special-rare">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className={`sparkle sparkle-rare s-${i}`} />
            ))}
          </div>
        )}

        {/* Effets légendaires */}
        {specialEffect === "legendaire" && (
          <div className="special-legendaire">
            <div className="halo-legendaire" />
            {Array.from({ length: 56 }).map((_, i) => (
              <span key={i} className={`sparkle sparkle-legendaire s-${i}`} />
            ))}
          </div>
        )}

        {/* Smoke */}
        {showSmoke && (
          <div className="smoke-wrapper">
            <div className="smoke-puff" />
            <div className="smoke-puff smoke-puff-2" />
          </div>
        )}

        {/* SVG TONNEAU */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <svg viewBox="0 0 300 350" className="w-72 h-72">
            <defs>
              <linearGradient id="wood" x1="0" x2="1">
                <stop offset="0%" stopColor="#8a5a32" />
                <stop offset="100%" stopColor="#5c381f" />
              </linearGradient>

              <linearGradient id="metal" x1="0" x2="1">
                <stop offset="0%" stopColor="#d7d7d7" />
                <stop offset="50%" stopColor="#9a9a9a" />
                <stop offset="100%" stopColor="#e6e6e6" />
              </linearGradient>

              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.25" />
              </filter>
            </defs>

            <ellipse cx="150" cy="330" rx="110" ry="30" fill="#00000033" />

            <g filter="url(#shadow)">
              <rect x="40" y="70" width="220" height="210" rx="105" fill="url(#wood)" stroke="#3a2a1b" strokeWidth="6" />
            </g>

            <rect x="40" y="110" width="220" height="18" rx="9" fill="url(#metal)" />
            <rect x="40" y="210" width="220" height="18" rx="9" fill="url(#metal)" />

            {[...Array(8)].map((_, i) => {
              const x = 62 + i * 23;
              return <rect key={i} x={x} y="70" width="12" height="210" rx="4" fill="#00000010" />;
            })}

            <g
              className={
                "barrel-lid " +
                (stage === "opening-lid" ? "shake-open " : "") +
                (stage === "revealing" ? "opened " : "") +
                (lidKick ? "kick " : "")
              }
            >
              <ellipse cx="150" cy="60" rx="110" ry="34" fill="#744726" stroke="#3a2a1b" strokeWidth="6" />
              <rect x="40" y="46" width="220" height="20" rx="10" fill="url(#metal)" />
            </g>
          </svg>
        </div>

        {/* CARTES */}
        <div className="cards-stack absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center">
          {revealed.map((p, idx) => (
            <div
              key={idx}
              className={`result-card card-fall ${rarityClass(p)}`}
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">🍺</div>
                <div>
                  <div className="text-xs opacity-80">Verre Surprise</div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-[11px] opacity-80">{p.rarity}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Résultat final */}
        {stage === "done" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-3 text-center">Résultat</h3>

              <div className="space-y-3">
                {revealed.map((p, i) => (
                  <div key={i} className={`final-item p-3 rounded-lg flex justify-between ${rarityClass(p)}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">🍺</div>
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs opacity-80">{p.rarity}</div>
                      </div>
                    </div>
                    <div>{p.price ? p.price + " €" : ""}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-center">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={() => onComplete(revealed)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STYLE */}
        <style>{`
/* Barrel lid */
.barrel-lid { transform-origin: 150px 60px; transition: transform 0.7s ease-out; }
.barrel-lid.shake-open { animation: lid-shake 0.6s ease-in-out; }
.barrel-lid.opened { transform: rotate(-55deg) translate(-26px, -18px); }
.barrel-lid.kick { animation: lid-kick 0.3s ease-out; }

@keyframes lid-kick {
  0% { transform: rotate(-55deg) translate(-26px, -18px); }
  40% { transform: rotate(-68deg) translate(-34px, -22px); }
  100% { transform: rotate(-55deg) translate(-26px, -18px); }
}

@keyframes lid-shake {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  50% { transform: rotate(4deg); }
  75% { transform: rotate(-3deg); }
  100% { transform: rotate(0deg); }
}

/* Smoke */
.smoke-wrapper { position: absolute; top: 20%; left: 50%; transform: translateX(-50%); z-index: 40; }
.smoke-puff {
  width: 100px; height: 60px;
  background: radial-gradient(circle at 30% 30%, rgba(200,200,200,0.9), rgba(200,200,200,0.4) 30%, rgba(200,200,200,0) 70%);
  opacity: 0;
  border-radius: 50%;
  animation: smoke-rise 1s ease-out forwards;
}
.smoke-puff-2 {
  width: 70px; height: 45px; margin-left: 40px;
  animation-delay: 150ms;
}

@keyframes smoke-rise {
  0% { opacity: 0; transform: translateY(0) scale(0.6); }
  40% { opacity: 1; transform: translateY(-20px) scale(0.9); }
  100% { opacity: 0; transform: translateY(-70px) scale(1.3); }
}

/* Cards */
.result-card {
  width: 100%;
  max-width: 760px;
  padding: 24px 28px;
  border-radius: 14px;
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 30px rgba(2,6,23,0.45);
  opacity: 0;
  transform-origin: center;
}

.card-fall {
  animation: fall-away 1.9s cubic-bezier(.22,.9,.3,1) forwards;
}

@keyframes fall-away {
  0%   { transform: translateY(0) scale(1.15); opacity: 1; }
  40%  { transform: translateY(0) scale(1); opacity: 1; }
  70%  { transform: translateY(130px) scale(0.8); opacity: 0.8; }
  100% { transform: translateY(260px) scale(0.55); opacity: 0; }
}

/* Rarity */
.rarity-commun { border: 1px solid #aaa5; background: rgba(130,130,130,0.25); }
.rarity-normal { border: 1px solid #3b82f67a; background: rgba(59,130,246,0.18); }
.rarity-rare { border: 1px solid #8b5cf67a; background: rgba(139,92,246,0.25); }
.rarity-legendaire { border: 1px solid #f59e0b7a; background: rgba(245,158,11,0.27); box-shadow: 0 6px 20px rgba(245,158,11,0.35); }

/* Legendary halo */
.halo-legendaire {
  position: absolute;
  top: 44%;
  left: 50%;
  width: 300px;
  height: 300px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255,215,0,0.55), transparent 60%);
  border-radius: 50%;
  animation: halo-pulse 1.4s ease-out forwards;
}

@keyframes halo-pulse {
  0% { opacity: 0; transform: scale(0.4) translate(-50%, -50%); }
  40% { opacity: 1; transform: scale(1.1) translate(-50%, -50%); }
  100% { opacity: 0; transform: scale(1) translate(-50%, -50%); }
}

/* Sparkles */
.sparkle { position: absolute; width: 8px; height: 8px; border-radius: 50%; opacity: 0; animation: sparkle-fall 1.2s linear forwards; }
.sparkle-rare { background: #a000ff; }
.sparkle-legendaire { background: #ffd200; }

@keyframes sparkle-fall {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(120px) scale(0.4); }
}

${Array.from({ length: 64 })
  .map((_, i) => {
    const left = Math.random() * 100;
    const top = Math.random() * 40 + 10;
    const delay = Math.random() * 300;
    return `.s-${i} { left:${left}%; top:${top}%; animation-delay:${delay}ms; }`;
  })
  .join("\n")}
`}</style>
      </div>
    </div>
  );
}
