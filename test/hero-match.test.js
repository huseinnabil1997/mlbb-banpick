"use strict";

var fs = require("fs");
var path = require("path");
var test = require("node:test");
var assert = require("node:assert/strict");
var heroMatch = require("../js/hero-match");
var aliases = require("../js/hero-aliases");

var fold = heroMatch.fold;
var rank = heroMatch.rank;
var matchMany = heroMatch.matchMany;
var filterHeroes = heroMatch.filterHeroes;

function loadEntries() {
  var raw = fs.readFileSync(path.join(__dirname, "../data/banpick.js"), "utf8");
  var json = raw.slice(raw.indexOf("{")).replace(/;\s*$/, "");
  var data = JSON.parse(json);
  return Object.keys(data.heroes).map(function (id) {
    return { id: id, name: data.heroes[id].name, roles: data.heroes[id].roles };
  });
}

var entries = loadEntries();
var names = entries.map(function (entry) { return entry.name; });

test("levenshtein jarak klasik", function () {
  assert.equal(heroMatch.levenshtein("kitten", "sitting"), 3);
  assert.equal(heroMatch.levenshtein("haya", "haya"), 0);
});

test("alias haya langsung ke Hayabusa", function () {
  var result = rank("haya", names, aliases);
  assert.equal(result.confident, true);
  assert.equal(result.match, "Hayabusa");
});

test("ejaan STT higher busa ikut alias Hayabusa", function () {
  var result = rank("higher busa", names, aliases);
  assert.equal(result.match, "Hayabusa");
  assert.equal(result.confident, true);
});

test("tanpa alias, higherbusa tidak yakin tapi Hayabusa kandidat teratas", function () {
  var result = rank("higherbusa", names, {});
  assert.equal(result.confident, false);
  assert.equal(result.match, null);
  assert.ok(result.candidates.length >= 1);
  assert.equal(result.candidates[0].name, "Hayabusa");
});

test("typo hayabsa cukup yakin ke Hayabusa", function () {
  var result = rank("hayabsa", names, {});
  assert.equal(result.confident, true);
  assert.equal(result.match, "Hayabusa");
});

test("nat ragu antara Natalia dan Natan", function () {
  var result = rank("nat", names, aliases);
  assert.equal(result.confident, false);
  var found = result.candidates.map(function (row) { return row.name; }).sort();
  assert.deepEqual(found, ["Natalia", "Natan"]);
});

test("alias singkat yang bukan awalan nama", function () {
  assert.equal(rank("yss", names, aliases).match, "Yi Sun-shin");
  assert.equal(rank("kupa", names, aliases).match, "Popol and Kupa");
  assert.equal(rank("x borg", names, aliases).match, "X.Borg");
  assert.equal(rank("wukong", names, aliases).match, "Sun");
  assert.equal(rank("moscow", names, aliases).match, "Moskov");
});

test("nama resmi tetap cocok setelah lipat tanda baca", function () {
  assert.equal(rank("Chang'e", names, {}).match, "Chang'e");
  assert.equal(rank("x.borg", names, {}).match, "X.Borg");
  assert.equal(rank("yi sun-shin", names, {}).match, "Yi Sun-shin");
  assert.equal(fold("Lapu-Lapu"), "lapulapu");
});

test("kata ban tidak otomatis jadi Bane", function () {
  var result = rank("ban", names, aliases);
  assert.equal(result.confident, false);
  assert.equal(rank("Bane", names, aliases).match, "Bane");
});

test("omong kosong tidak menghasilkan kandidat", function () {
  var result = rank("zzzzqqqq", names, aliases);
  assert.equal(result.confident, false);
  assert.equal(result.candidates.length, 0);
});

test("matchMany menggabungkan beberapa nama", function () {
  var parts = matchMany("haya franco", names, aliases);
  assert.deepEqual(parts.map(function (part) { return part.kind === "match" ? part.name : part.kind; }), [
    "Hayabusa",
    "Franco"
  ]);
});

test("matchMany tanpa alias menandai higher busa sebagai ragu", function () {
  var parts = matchMany("higher busa", names, {});
  assert.equal(parts.length, 1);
  assert.equal(parts[0].kind, "uncertain");
  assert.equal(parts[0].candidates[0].name, "Hayabusa");
});

test("setiap alias menunjuk ke hero yang ada", function () {
  Object.keys(aliases).forEach(function (key) {
    var dest = aliases[key];
    var targets = Array.isArray(dest) ? dest : [dest];
    targets.forEach(function (target) {
      assert.ok(names.indexOf(target) >= 0, key + " -> " + target);
    });
    var owner = names.filter(function (name) { return fold(name) === fold(key); });
    if (owner.length === 1 && !Array.isArray(dest)) {
      assert.equal(owner[0], dest, "alias " + key + " bentrok dengan nama hero lain");
    }
  });
});

test("alias xb tetap ketemu X.Borg walau nama resmi ada titik", function () {
  var hits = filterHeroes(entries, "xb", { aliases: aliases });
  assert.ok(hits.some(function (entry) { return entry.name === "X.Borg"; }));
});

test("filter nama baru jalan setelah 2 huruf", function () {
  var one = filterHeroes(entries, "h", { aliases: aliases, roles: null, minLetters: 2 });
  var two = filterHeroes(entries, "ha", { aliases: aliases, roles: null, minLetters: 2 });
  assert.equal(one.length, entries.length);
  assert.ok(two.length < entries.length);
  assert.ok(two.some(function (entry) { return entry.name === "Hayabusa"; }));
  assert.ok(two.some(function (entry) { return entry.name === "Hanabi"; }));
  assert.equal(filterHeroes(entries, "haya", { aliases: aliases })[0].name, "Hayabusa");
});

test("filter role memotong grid", function () {
  var assassins = filterHeroes(entries, "", { roles: ["Assassin"], aliases: aliases });
  assert.ok(assassins.length > 0);
  assassins.forEach(function (entry) {
    assert.ok(entry.roles.indexOf("Assassin") >= 0);
  });
  var hayaAsMarksman = filterHeroes(entries, "haya", { roles: ["Marksman"], aliases: aliases });
  assert.equal(hayaAsMarksman.length, 0);
  var hayaAsAssassin = filterHeroes(entries, "haya", { roles: ["Assassin"], aliases: aliases });
  assert.deepEqual(hayaAsAssassin.map(function (entry) { return entry.name; }), ["Hayabusa"]);
});

test("role kosong tidak menampilkan hero", function () {
  assert.deepEqual(filterHeroes(entries, "haya", { roles: [], aliases: aliases }), []);
});
