import React from 'react';
import MemberAvatar from './MemberAvatar';

const SIZES = {
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
  lg: 'w-14 h-14',
  xl: 'w-24 h-24'
};

/**
 * Photo d'un Bro : celle envoyée dans l'app, sinon celle du compte Google
 * relié, sinon ses initiales.
 */
export default function BroAvatar({ name = '', photoURL, size = 'md', className = '' }) {
  if (!photoURL) return <MemberAvatar name={name} size={size === 'sm' ? 'sm' : 'md'} />;
  return (
    <img
      src={photoURL}
      alt=""
      referrerPolicy="no-referrer"
      className={`flex-none rounded-full object-cover bg-gray-200 ${SIZES[size] || SIZES.md} ${className}`}
    />
  );
}
