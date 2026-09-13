import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

// Les photos sont réduites avant envoi : un portrait de 512 px suffit pour un
// avatar, et un téléphone produit des images de plusieurs mégaoctets.
const MAX_SIDE = 512;

/** Lit un fichier image et le redimensionne en JPEG carré, côté téléphone. */
export async function resizeToSquareJpeg(file, side = MAX_SIDE) {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  // Recadrage centré en carré.
  ctx.drawImage(
    bitmap,
    (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size,
    0, 0, side, side
  );
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image illisible'))), 'image/jpeg', 0.85);
  });
}

/**
 * Envoie la photo d'un Bro et renvoie son adresse. Le chemin encode la
 * section et le Bro : les règles de Storage s'en servent.
 */
export async function uploadBroPhoto({ sectionId, broId, file }) {
  const blob = await resizeToSquareJpeg(file);
  const path = `bros/${sectionId}/${broId}.jpg`;
  const target = ref(storage, path);
  await uploadBytes(target, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=86400' });
  // Un paramètre de version force le rafraîchissement après changement.
  return `${await getDownloadURL(target)}${'&v=' + Date.now()}`;
}
