// Codes à usage unique basés sur le temps (TOTP, RFC 6238), ceux de Google
// Authenticator et des apps équivalentes : HMAC-SHA1, 6 chiffres, pas de 30 s.
//
// Écrit à la main, sans dépendance : ce code garde le numéro de compte du
// patro, on veut pouvoir le relire en entier. Il est vérifié contre les
// vecteurs de test de la RFC (voir test/totp.test.js).
const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Secret base32 invalide");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secret aléatoire de 160 bits, la taille recommandée pour HMAC-SHA1. */
const generateSecret = () => base32Encode(crypto.randomBytes(20));

const stepAt = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** Code attendu pour un pas de temps donné. */
function codeForStep(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Vérifie un code. Tolère un pas d'écart d'horloge de chaque côté.
 *
 * `afterStep` interdit le rejeu : un code n'est accepté que si son pas de temps
 * est strictement postérieur au dernier pas déjà utilisé. Renvoie le pas de
 * temps du code accepté (à mémoriser), ou null.
 */
function verifyCode(secret, code, { nowMs = Date.now(), afterStep = -1, window = 1 } = {}) {
  const candidate = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return null;

  const current = stepAt(nowMs);
  for (let delta = -window; delta <= window; delta++) {
    const step = current + delta;
    if (step <= afterStep) continue;
    const expected = Buffer.from(codeForStep(secret, step));
    // Comparaison en temps constant : ne rien laisser fuiter sur les chiffres justes.
    if (crypto.timingSafeEqual(expected, Buffer.from(candidate))) return step;
  }
  return null;
}

/** Adresse otpauth:// à afficher en QR pour l'app d'authentification. */
function otpauthUri(secret, { account, issuer = "Gestion Patro" }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  stepAt,
  codeForStep,
  verifyCode,
  otpauthUri,
};
