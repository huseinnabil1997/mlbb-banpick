var test = require("node:test");
var assert = require("node:assert");
require("../data/hero-icons.js");

test("hero-icons punya 133 entri", function () {
  assert.strictEqual(Object.keys(globalThis.HERO_ICONS).length, 133);
});

test("setiap ikon berupa URL https", function () {
  Object.keys(globalThis.HERO_ICONS).forEach(function (id) {
    assert.match(globalThis.HERO_ICONS[id], /^https:\/\//);
  });
});
