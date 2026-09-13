import React from 'react';

// Une couleur de section par membre, stable d'une ouverture à l'autre.
const TONES = ['bg-bar-500', 'bg-boulots-500', 'bg-finance-500', 'bg-voyage-500', 'bg-reglages-500'];

const SIZES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-9 h-9 text-xs'
};

const initialsOf = (name) => {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function MemberAvatar({ name = '', size = 'md' }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  return (
    <span
      aria-hidden="true"
      className={`flex-none rounded-full grid place-items-center font-bold text-white ${SIZES[size] || SIZES.md} ${TONES[hash % TONES.length]}`}
    >
      {initialsOf(name)}
    </span>
  );
}
