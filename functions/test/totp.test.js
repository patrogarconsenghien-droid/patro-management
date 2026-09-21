const test = require("node:test");
const assert = require("node:assert/strict");
const {
  base32Encode, base32Decode, generateSecret, stepAt, codeForStep, verifyCode, otpauthUri,
} = require("../lib/totp");

// Vecteurs de la RFC 6238 (annexe B), SHA-1, secret ASCII « 12345678901234567890 ».
// La RFC donne 8 chiffres ; un code à 6 chiffres en est les 6 derniers.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

test("les codes correspondent aux vecteurs de la RFC 6238", () => {
  for (const [seconds, expected] of RFC_VECTORS) {
    assert.equal(codeForStep(RFC_SECRET, stepAt(seconds * 1000)), expected, `T=${seconds}`);
  }
});

test("base32 : aller-retour et tolérance aux espaces et minuscules", () => {
  const bytes = Buffer.from("patro-senghien-2026");
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  assert.deepEqual(base32Decode("gezd gnbv"), base32Decode("GEZDGNBV"));
  assert.throws(() => base32Decode("pas du base32 !"));
});

test("un secret généré fait 160 bits et change à chaque fois", () => {
  const a = generateSecret();
  const b = generateSecret();
  assert.equal(base32Decode(a).length, 20);
  assert.notEqual(a, b);
});

test("un code juste est accepté, y compris avec un pas d'écart d'horloge", () => {
  const nowMs = 1_700_000_000_000;
  const step = stepAt(nowMs);
  assert.equal(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step), { nowMs }), step);
  assert.equal(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step - 1), { nowMs }), step - 1);
  assert.equal(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step + 1), { nowMs }), step + 1);
});

test("un code trop vieux, faux ou mal formé est refusé", () => {
  const nowMs = 1_700_000_000_000;
  const step = stepAt(nowMs);
  assert.equal(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step - 2), { nowMs }), null);
  assert.equal(verifyCode(RFC_SECRET, "12345", { nowMs }), null);
  assert.equal(verifyCode(RFC_SECRET, "abcdef", { nowMs }), null);
  assert.equal(verifyCode(RFC_SECRET, "", { nowMs }), null);
  assert.equal(verifyCode(RFC_SECRET, undefined, { nowMs }), null);
});

test("un code déjà utilisé ne peut pas être rejoué", () => {
  const nowMs = 1_700_000_000_000;
  const step = stepAt(nowMs);
  const code = codeForStep(RFC_SECRET, step);
  assert.equal(verifyCode(RFC_SECRET, code, { nowMs, afterStep: step - 1 }), step);
  assert.equal(verifyCode(RFC_SECRET, code, { nowMs, afterStep: step }), null);
});

test("un code d'un autre secret est refusé", () => {
  const nowMs = 1_700_000_000_000;
  const other = generateSecret();
  assert.equal(verifyCode(RFC_SECRET, codeForStep(other, stepAt(nowMs)), { nowMs }), null);
});

test("l'adresse otpauth porte le compte, l'émetteur et le secret", () => {
  const uri = otpauthUri("ABCDEFGH", { account: "admin@patro.be" });
  assert.match(uri, /^otpauth:\/\/totp\/Gestion%20Patro%3Aadmin%40patro\.be\?/);
  assert.match(uri, /secret=ABCDEFGH/);
  assert.match(uri, /issuer=Gestion\+Patro/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});
