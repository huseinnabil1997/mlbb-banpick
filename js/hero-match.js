/* Fuzzy match nama hero (Levenshtein) + alias.
   Dipakai pencarian dan koreksi hasil speech-to-text. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HeroMatch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CONFIDENT_MIN = 0.82;
  var CONFIDENT_GAP = 0.08;
  var LIST_MIN = 0.62;
  var WEAK_MIN = 0.48;

  function fold(value) {
    return String(value)
      .toLowerCase()
      .replace(/\bnumber\b/g, "no")
      .replace(/['’.]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function levenshtein(left, right) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    var prev = [];
    var i, j;
    for (j = 0; j <= right.length; j++) prev[j] = j;
    for (i = 1; i <= left.length; i++) {
      var cur = [i];
      for (j = 1; j <= right.length; j++) {
        var cost = left.charAt(i - 1) === right.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[right.length];
  }

  function aliasIndex(aliases) {
    var map = {};
    if (!aliases) return map;
    Object.keys(aliases).forEach(function (key) {
      var dest = aliases[key];
      var labels = Array.isArray(dest) ? dest.slice() : [dest];
      map[fold(key)] = { labels: labels, ambiguous: Array.isArray(dest) };
    });
    return map;
  }

  function resolveName(label, names) {
    var wanted = fold(label);
    for (var i = 0; i < names.length; i++) {
      if (fold(names[i]) === wanted) return names[i];
    }
    return null;
  }

  function scoreAgainst(query, target) {
    if (query === target) return { score: 1, lev: 1 };
    var dist = levenshtein(query, target);
    var maxLen = Math.max(query.length, target.length);
    var lev = maxLen ? 1 - dist / maxLen : 0;
    var prefix = 0;
    if (query.length >= 3 && target.indexOf(query) === 0) {
      prefix = 0.8 + 0.2 * (query.length / target.length);
    }
    return { score: Math.max(lev, prefix), lev: lev };
  }

  function rank(text, names, aliases) {
    var query = fold(text);
    var list = names || [];
    var empty = { query: query, match: null, confident: false, candidates: [] };
    if (!query || !list.length) return empty;

    var indexed = aliasIndex(aliases);
    if (Object.prototype.hasOwnProperty.call(indexed, query)) {
      var entry = indexed[query];
      var resolved = [];
      entry.labels.forEach(function (label) {
        var name = resolveName(label, list);
        if (name && resolved.indexOf(name) < 0) resolved.push(name);
      });
      if (resolved.length === 1 && !entry.ambiguous) {
        return {
          query: query,
          match: resolved[0],
          confident: true,
          candidates: [{ name: resolved[0], score: 1 }]
        };
      }
      if (resolved.length) {
        return {
          query: query,
          match: null,
          confident: false,
          candidates: resolved.map(function (name) { return { name: name, score: 0.8 }; })
        };
      }
    }

    var scored = list.map(function (name) {
      var target = fold(name);
      var parts = scoreAgainst(query, target);
      return { name: name, target: target, score: parts.score, lev: parts.lev };
    }).sort(function (a, b) {
      return b.score - a.score || a.name.localeCompare(b.name);
    });

    var best = scored[0];
    var second = scored[1] || null;
    var gap = second ? best.score - second.score : 1;
    var cover = best.target.length ? query.length / best.target.length : 0;
    var confident = best.score >= 0.999 || (
      query.length >= 4 &&
      best.score >= CONFIDENT_MIN &&
      gap >= CONFIDENT_GAP &&
      (best.lev >= 0.8 || cover >= 0.5)
    );
    var show = best.score >= LIST_MIN || (
      query.length >= 5 && best.score >= WEAK_MIN && gap >= CONFIDENT_GAP
    );
    if (!show) return empty;

    var floor = Math.max(WEAK_MIN, best.score - 0.12);
    var candidates = scored.filter(function (row) { return row.score >= floor; }).slice(0, 5).map(function (row) {
      return { name: row.name, score: Math.round(row.score * 1000) / 1000 };
    });
    return {
      query: query,
      match: confident ? best.name : null,
      confident: confident,
      candidates: candidates
    };
  }

  function matchMany(text, names, aliases) {
    var raw = String(text).toLowerCase().replace(/\bnumber\b/g, "no").replace(/['’.]/g, " ");
    var words = raw.split(/[^a-z0-9]+/).filter(Boolean);
    var out = [];
    var i = 0;
    while (i < words.length) {
      var confidentHit = null;
      var uncertainHit = null;
      var max = Math.min(4, words.length - i);
      var n;
      for (n = max; n >= 1; n--) {
        var piece = words.slice(i, i + n).join(" ");
        var ranked = rank(piece, names, aliases);
        if (ranked.confident && ranked.match) {
          confidentHit = { take: n, ranked: ranked };
          break;
        }
        var top = ranked.candidates[0];
        if (top && (!uncertainHit || top.score > uncertainHit.ranked.candidates[0].score)) {
          uncertainHit = { take: n, ranked: ranked };
        }
      }
      if (confidentHit) {
        out.push({ kind: "match", name: confidentHit.ranked.match });
        i += confidentHit.take;
      } else if (uncertainHit) {
        out.push({
          kind: "uncertain",
          query: uncertainHit.ranked.query,
          candidates: uncertainHit.ranked.candidates
        });
        i += uncertainHit.take;
      } else {
        i += 1;
      }
    }
    return out;
  }

  function aliasNamesFor(query, aliases, names) {
    var found = {};
    var indexed = aliasIndex(aliases);
    var q = fold(query);
    if (!q) return found;
    Object.keys(indexed).forEach(function (key) {
      if (key !== q && key.indexOf(q) !== 0) return;
      indexed[key].labels.forEach(function (label) {
        var name = resolveName(label, names);
        if (name) found[name] = key === q ? 2 : 1;
      });
    });
    return found;
  }

  function filterHeroes(entries, query, options) {
    var opts = options || {};
    var minLetters = opts.minLetters == null ? 2 : opts.minLetters;
    var aliases = opts.aliases || {};
    var roles = opts.roles;
    var raw = String(query || "").trim();
    var qLower = raw.toLowerCase();
    var qFold = fold(raw);
    var pool = (entries || []).filter(function (entry) {
      if (!roles) return true;
      if (!roles.length) return false;
      return (entry.roles || []).some(function (role) { return roles.indexOf(role) >= 0; });
    });
    if (raw.length < minLetters) {
      return pool.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "id"); });
    }

    var names = pool.map(function (entry) { return entry.name; });
    var ranked = rank(raw, names, aliases);
    var fuzzy = {};
    ranked.candidates.forEach(function (row) { fuzzy[row.name] = row.score; });
    if (ranked.match) fuzzy[ranked.match] = Math.max(fuzzy[ranked.match] || 0, 1);
    var viaAlias = aliasNamesFor(raw, aliases, names);

    var hits = pool.filter(function (entry) {
      if (entry.name.toLowerCase().indexOf(qLower) >= 0) return true;
      if (viaAlias[entry.name]) return true;
      return (fuzzy[entry.name] || 0) >= LIST_MIN;
    });
    hits.sort(function (a, b) {
      return relevance(b) - relevance(a) || a.name.localeCompare(b.name, "id");
    });
    return hits;

    function relevance(entry) {
      var nameFold = fold(entry.name);
      if (nameFold === qFold) return 100;
      if (viaAlias[entry.name] === 2) return 95;
      if (qFold && nameFold.indexOf(qFold) === 0) return 80;
      if (viaAlias[entry.name]) return 75;
      if (entry.name.toLowerCase().indexOf(qLower) >= 0) return 70;
      return 50 + (fuzzy[entry.name] || 0);
    }
  }

  return {
    fold: fold,
    levenshtein: levenshtein,
    rank: rank,
    matchMany: matchMany,
    filterHeroes: filterHeroes
  };
});
