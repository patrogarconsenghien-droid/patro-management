// Génère src/styles/theme.css à partir des couleurs de la direction « Foulard ».
//
// L'app utilise les noms de couleur Tailwind (gray, blue, green...) dans des
// milliers de classes. Plutôt que de les réécrire, on redéfinit chaque palette
// sous forme de variables CSS : tailwind.config.js pointe dessus, et le mode
// sombre n'a qu'à changer les variables.
//
// Usage : node scripts/build-theme.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const hex = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const WHITE = [255, 255, 255];
const INK = hex('#0B0C18');
const NIGHT = hex('#0D0F1F');

/** Échelle claire : 500 est la couleur de base, éclaircie vers 50, assombrie vers 900. */
const lightScale = (base) => {
  const b = hex(base);
  return {
    50: mix(b, WHITE, 0.92), 100: mix(b, WHITE, 0.85), 200: mix(b, WHITE, 0.7),
    300: mix(b, WHITE, 0.5), 400: mix(b, WHITE, 0.25), 500: b,
    600: mix(b, INK, 0.14), 700: mix(b, INK, 0.3), 800: mix(b, INK, 0.45), 900: mix(b, INK, 0.58)
  };
};

/**
 * Échelle sombre, inversée sur les extrémités : les teintes 50-300 servent de
 * fonds (donc foncées), les teintes 700-900 servent de texte (donc claires).
 * Le milieu reste saturé pour les boutons à texte blanc.
 */
const darkScale = (base) => {
  const b = hex(base);
  return {
    50: mix(b, NIGHT, 0.84), 100: mix(b, NIGHT, 0.76), 200: mix(b, NIGHT, 0.62),
    300: mix(b, NIGHT, 0.45), 400: mix(b, WHITE, 0.1), 500: mix(b, WHITE, 0.06),
    600: mix(b, WHITE, 0.14), 700: mix(b, WHITE, 0.38), 800: mix(b, WHITE, 0.55), 900: mix(b, WHITE, 0.7)
  };
};

// Couleurs de la direction. Les palettes secondaires (indigo, teal, cyan)
// restent présentes pour les quelques écrans qui les utilisent.
const PALETTES = {
  orange: '#E85D12', // Mousse — Bar
  green: '#0E8F5F',  // Sapin — Boulots, succès
  blue: '#3D5AFE',   // Encre — Finance
  pink: '#E8435A',   // Feu de camp — Voyage
  purple: '#6D4AFF', // Lavande — Réglages
  red: '#D93A40',    // Dettes, erreurs
  yellow: '#D99A06', // Avertissements
  indigo: '#5146E5',
  teal: '#0F9488',
  cyan: '#0891B2'
};

// Neutres réglés à la main, avec une pointe de bleu (craie le jour, nuit de camp le soir).
const GRAY_LIGHT = ['#EEF1F7', '#E6E9F1', '#DCE0EA', '#C4C9D7', '#8A8FA8', '#6B7089', '#565B75', '#3F4360', '#282C46', '#16182B'];
const GRAY_DARK = ['#0D0F1F', '#1F2340', '#2A2E4C', '#3B4063', '#6F7494', '#8A8FAD', '#A3A8C4', '#C3C7DB', '#DDE0EE', '#EEF0FA'];

const triplet = (rgb) => rgb.join(' ');

const block = (scales, gray, surface) => {
  const lines = [`  --c-surface: ${triplet(hex(surface))};`];
  STEPS.forEach((step, i) => lines.push(`  --c-gray-${step}: ${triplet(hex(gray[i]))};`));
  Object.entries(scales).forEach(([name, scale]) => {
    STEPS.forEach((step) => lines.push(`  --c-${name}-${step}: ${triplet(scale[step])};`));
  });
  return lines.join('\n');
};

const light = Object.fromEntries(Object.entries(PALETTES).map(([n, b]) => [n, lightScale(b)]));
const dark = Object.fromEntries(Object.entries(PALETTES).map(([n, b]) => [n, darkScale(b)]));

const css = `/* Généré par scripts/build-theme.mjs — ne pas modifier à la main. */

:root {
  color-scheme: light;
${block(light, GRAY_LIGHT, '#FFFFFF')}
}

/* Le mode sombre suit le réglage du téléphone. */
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
${block(dark, GRAY_DARK, '#181B31').replace(/^/gm, '  ')}
  }
}
`;

const out = fileURLToPath(new URL('../src/styles/theme.css', import.meta.url));
writeFileSync(out, css);
console.log(`Thème écrit dans ${out}`);
