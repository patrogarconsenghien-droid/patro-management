const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeIban, isValidBelgianIban, formatIban, lastFour } = require("../lib/iban");

test("un IBAN belge correct est accepté, quelle que soit la saisie", () => {
  assert.ok(isValidBelgianIban("BE68539007547034"));
  assert.ok(isValidBelgianIban("be68 5390 0754 7034"));
  assert.ok(isValidBelgianIban("BE68-5390-0754-7034"));
  assert.ok(isValidBelgianIban("BE71 0961 2345 6769"));
});

test("une faute de frappe est détectée par la clé de contrôle", () => {
  assert.equal(isValidBelgianIban("BE68539007547035"), false); // dernier chiffre changé
  assert.equal(isValidBelgianIban("BE68539007574034"), false); // deux chiffres inversés
  assert.equal(isValidBelgianIban("BE69539007547034"), false); // clé changée
});

test("tout ce qui n'est pas un IBAN belge est refusé", () => {
  assert.equal(isValidBelgianIban("NL91ABNA0417164300"), false); // valide, mais pas belge
  assert.equal(isValidBelgianIban("FR1420041010050500013M02606"), false);
  assert.equal(isValidBelgianIban("BE6853900754703"), false); // trop court
  assert.equal(isValidBelgianIban("BE685390075470344"), false); // trop long
  assert.equal(isValidBelgianIban(""), false);
  assert.equal(isValidBelgianIban(null), false);
  assert.equal(isValidBelgianIban(undefined), false);
});

test("mise en forme et derniers chiffres", () => {
  assert.equal(normalizeIban(" be68 5390-0754 7034 "), "BE68539007547034");
  assert.equal(formatIban("be68539007547034"), "BE68 5390 0754 7034");
  assert.equal(lastFour("BE68 5390 0754 7034"), "7034");
});
