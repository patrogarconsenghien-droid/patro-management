// Liens et QR de paiement.
//
// Les liens envoyés aux clients portent toujours la même adresse, celle de
// l'app sur Vercel : un client apprend à la reconnaître, et un lien venu
// d'ailleurs doit lui paraître suspect.
const PUBLIC_ORIGIN = 'https://patro-management.vercel.app';

export const payUrl = (token) =>
  `${import.meta.env.DEV ? window.location.origin : PUBLIC_ORIGIN}/payer/${token}`;

/** Jeton d'un chemin « /payer/<jeton> », ou null. */
export const payTokenFromPath = (pathname) => {
  const match = /^\/payer\/([A-Za-z0-9_-]{20,40})\/?$/.exec(pathname || '');
  return match ? match[1] : null;
};

/**
 * Dessine un QR à partir du contenu fourni par le serveur. Niveau de
 * correction M, celui que recommande la norme des QR de virement. Le QR est
 * dessiné dans le navigateur : son contenu ne part vers aucun service tiers.
 */
export async function renderQr(payload, width = 480) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width });
}
