import React from 'react';
import { formatCurrency } from '../lib/format';

/** Solde d'un membre : rouge s'il doit, vert s'il a du crédit, gris à zéro. */
export default function BalancePill({ value }) {
  const amount = Number(value) || 0;
  const tone = amount < -0.005
    ? 'bg-red-100 text-red-700'
    : amount > 0.005
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex flex-none font-mono text-xs font-medium px-2 py-0.5 rounded-full ${tone}`}>
      {amount > 0.005 ? '+' : ''}{formatCurrency(amount)}
    </span>
  );
}
