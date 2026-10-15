var test = require("node:test");
var assert = require("node:assert");
require("../data/hero-art.js");
require("../data/hero-icons.js");

test("hero-art punya 133 entri", function () {
  assert.strictEqual(Object.keys(globalThis.HERO_ART).length, 133);
});

test("id hero-art sama dengan hero-icons dan berupa URL https", function () {
  assert.deepStrictEqual(Object.keys(globalThis.HERO_ART).sort(), Object.keys(globalThis.HERO_ICONS).sort());
  Object.keys(globalThis.HERO_ART).forEach(function (id) {
    assert.match(globalThis.HERO_ART[id], /^https:\/\//);
  });
});
