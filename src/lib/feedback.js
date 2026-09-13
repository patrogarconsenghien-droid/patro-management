// Retours visuels posés directement sur <body> : un toast en haut de l'écran
// et une poignée de foulards qui s'envolent. Hors de React volontairement,
// pour survivre au changement d'écran qui suit souvent l'action (valider une
// commande ramène à la liste des membres).

const SECTION_COLORS = ['orange', 'green', 'blue', 'pink', 'purple'];

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Message court qui descend du haut de l'écran puis repart. */
export function toast(message, { tone = 'success', duration = 2600 } = {}) {
  const el = document.createElement('div');
  el.className = `foulard-toast foulard-toast--${tone}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 450);
  }, duration);
}

/**
 * Foulards aux couleurs des sections, lâchés depuis un point de l'écran.
 * Réservé aux vraies réussites : commande encaissée, saison clôturée.
 */
export function celebrate({ x, y } = {}) {
  if (prefersReducedMotion()) return;

  const box = document.createElement('div');
  box.className = 'foulard-burst';
  box.style.left = `${x ?? window.innerWidth / 2}px`;
  box.style.top = `${y ?? window.innerHeight - 90}px`;

  const count = 16;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('i');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 70 + Math.random() * 70;
    piece.style.setProperty('--c', `var(--c-${SECTION_COLORS[i % SECTION_COLORS.length]}-500)`);
    piece.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--y', `${Math.sin(angle) * distance - 40}px`);
    piece.style.setProperty('--r', `${Math.random() * 360 - 180}deg`);
    box.appendChild(piece);
  }

  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1000);
}
