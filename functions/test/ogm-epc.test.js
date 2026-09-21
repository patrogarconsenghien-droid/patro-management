const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCommunication, formatCommunication, isValidCommunication, findCommunication } = require("../lib/ogm");
const { buildEpcPayload, formatAmount } = require("../lib/epcQr");

test("communication : année, section, compteur et clé modulo 97", () => {
  const digits = buildCommunication({ sectionId: "garcons", year: 2026, sequence: 42 });
  assert.equal(digits.slice(0, 10), "2610000042");
  assert.equal(digits.length, 12);
  assert.equal(Number(digits.slice(10)), Number(2610000042n % 97n) || 97);
  assert.ok(isValidCommunication(digits));
  assert.equal(buildCommunication({ sectionId: "filles", year: 2026, sequence: 1 }).slice(0, 3), "262");
});

test("communication : exemple de référence et cas du reste nul", () => {
  // Exemple classique de la norme : 123/4567/890 → clé 02.
  assert.ok(isValidCommunication("123456789002"));
  assert.equal(isValidCommunication("123456789003"), false);
  // Reste 0 → la clé vaut 97, jamais 00.
  assert.ok(isValidCommunication("000000009797"));
  assert.equal(isValidCommunication("000000009700"), false);
});

test("communication : mise en forme et limites", () => {
  assert.equal(formatCommunication("123456789002"), "+++123/4567/89002+++");
  assert.throws(() => buildCommunication({ sectionId: "autre", year: 2026, sequence: 1 }));
  assert.throws(() => buildCommunication({ sectionId: "garcons", year: 2026, sequence: 0 }));
  assert.throws(() => buildCommunication({ sectionId: "garcons", year: 2026, sequence: 10_000_000 }));
});

test("communication retrouvée dans un libellé de relevé, sous toutes ses formes", () => {
  const digits = buildCommunication({ sectionId: "garcons", year: 2026, sequence: 7 });
  const pretty = formatCommunication(digits);
  assert.equal(findCommunication(pretty), digits);
  assert.equal(findCommunication(`Virement de M. Dupont ${pretty} merci`), digits);
  assert.equal(findCommunication(pretty.replaceAll("+", "")), digits);
  assert.equal(findCommunication(digits), digits);
  assert.equal(findCommunication(`REF ${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`), digits);
  assert.equal(findCommunication("Merci pour le boulot du 3 octobre"), null);
  assert.equal(findCommunication("+++123/4567/89003+++"), null); // clé fausse
  assert.equal(findCommunication(""), null);
  assert.equal(findCommunication(null), null);
});

test("montant du QR : en centimes, sans virgule flottante", () => {
  assert.equal(formatAmount(4500), "EUR45.00");
  assert.equal(formatAmount(1), "EUR0.01");
  assert.equal(formatAmount(1005), "EUR10.05");
  assert.equal(formatAmount(2999), "EUR29.99");
  for (const bad of [0, -5, 12.5, NaN, "45", null]) assert.throws(() => formatAmount(bad), String(bad));
});

test("contenu du QR conforme au guide Febelfin", () => {
  const payload = buildEpcPayload({
    holderName: "Patro Garçons Senghien ASBL",
    iban: "be68 5390 0754 7034",
    amountCents: 4500,
    communication: "123456789002",
  });
  assert.deepEqual(payload.split("\n"), [
    "BCD", "002", "1", "SCT", "",
    "Patro Garçons Senghien ASBL",
    "BE68539007547034",
    "EUR45.00",
    "",
    "+++123/4567/89002+++", // remittance structurée
    "", // remittance libre vide
  ]);
});

test("QR : un nom piégé ne casse pas le format", () => {
  const payload = buildEpcPayload({
    holderName: "Patro\nBE00PIRATE\r\nEUR9999", iban: "BE68539007547034", amountCents: 100, communication: "123456789002",
  });
  const lines = payload.split("\n");
  assert.equal(lines.length, 11);
  assert.equal(lines[6], "BE68539007547034");
  assert.equal(lines[7], "EUR1.00");
  assert.throws(() => buildEpcPayload({ holderName: " ", iban: "BE68539007547034", amountCents: 100, communication: "123456789002" }));
  assert.ok(buildEpcPayload({ holderName: "x".repeat(200), iban: "BE68539007547034", amountCents: 100, communication: "123456789002" }).split("\n")[5].length === 70);
});
