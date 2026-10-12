(function () {
  "use strict";
  var D = window.BANPICK_DATA;
  if (!D) return;
  var H = D.heroes;
  var IDS = Object.keys(H);
  var NAME = {};
  IDS.forEach(function (id) { NAME[id] = H[id].name; });
  var state = { ban: [], ally: [], enemy: [] };
  var LABEL = { ban: "di-ban", ally: "tim kita", enemy: "musuh" };
  var ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
  var LANES = ["Exp Lane", "Jungling", "Mid Lane", "Gold Lane", "Roaming"];
  var roleOn = {};
  var laneOn = {};
  ROLES.forEach(function (r) { roleOn[r] = true; });
  LANES.forEach(function (l) { laneOn[l] = true; });
  var pool = "mythic";
  var TOP = 10;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }); }
  function nm(id) { return NAME[id] || id; }
  function rankOf(id) { return H[id][pool]; }

  function hit(id, key, other) {
    var list = rankOf(id)[key];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i][0]) === String(other) && list[i][1]) return true;
    }
    return false;
  }
  function counterHit(a, b) { return hit(a, "c", b) || hit(b, "w", a); }
  function synergyHit(a, b) { return hit(a, "s", b) || hit(b, "s", a); }
  function antiHit(a, b) { return hit(a, "a", b) || hit(b, "a", a); }

  function scorePick(k) {
    var parts = [], total = 0;
    state.enemy.forEach(function (e) {
      if (counterHit(k, e)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(e) }); }
      if (counterHit(e, k)) { total -= 1; parts.push({ cls: "minus", t: "Di-counter " + nm(e) }); }
    });
    state.ally.forEach(function (a) {
      if (synergyHit(k, a)) { total += 1; parts.push({ cls: "plus", t: "Sinergi dengan " + nm(a) }); }
      if (antiHit(k, a)) { total -= 1; parts.push({ cls: "minus", t: "Anti-sinergi dengan " + nm(a) }); }
    });
    return { total: total, parts: parts };
  }
  function scoreBan(k) {
    var parts = [], total = 0;
    state.ally.forEach(function (a) {
      if (counterHit(k, a)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(a) + " (tim kita)" }); }
    });
    state.enemy.forEach(function (e) {
      if (synergyHit(k, e)) { total += 1; parts.push({ cls: "plus", t: "Sinergi dengan " + nm(e) + " (musuh)" }); }
      if (antiHit(k, e)) { total -= 1; parts.push({ cls: "minus", t: "Anti-sinergi dengan " + nm(e) + " (musuh)" }); }
    });
    return { total: total, parts: parts };
  }

  function taken() { return state.ban.concat(state.ally, state.enemy); }

  function card(k, sc, rank) {
    var h = H[k];
    var r = rankOf(k);
    var parts = sc.parts.map(function (p) {
      return '<li class="' + p.cls + '"><span>' + esc(p.t) + "</span></li>";
    }).join("");
    var meta = "WR " + fmt(r.wr) + "% · Pick " + fmt(r.pr) + "% · Ban " + fmt(r.br) + "%";
    return '<article class="bp-card"><div class="bp-head"><span class="bp-rank">' + rank + '</span><div class="bp-title"><h3>' + esc(h.name) + '</h3><span class="bp-role">' + esc(h.roles.join(" / ")) + " · " + esc(h.lanes.join(" / ")) + '</span></div><span class="bp-score count">' + sc.total + ' hubungan</span></div><ul class="bp-why">' + parts + '</ul><div class="bp-meta">' + esc(meta) + "</div></article>";
  }

  function render() {
    var t = taken();
    var cands = IDS.filter(function (k) { return t.indexOf(k) < 0; });
    var pickEl = document.getElementById("out-pick");
    var banEl = document.getElementById("out-ban");
    if (!state.enemy.length && !state.ally.length) {
      pickEl.innerHTML = banEl.innerHTML = '<p class="bp-empty">Pilih hero tim kita dan/atau hero musuh untuk melihat rekomendasi.</p>';
      return;
    }
    function list(fn, el, emptyMsg, filterPick) {
      var rows = cands.map(function (k) { return { k: k, s: fn(k) }; }).filter(function (row) { return row.s.total > 0; });
      if (filterPick) {
        rows = rows.filter(function (row) {
          var h = H[row.k];
          return h.roles.some(function (role) { return roleOn[role]; }) && h.lanes.some(function (lane) { return laneOn[lane]; });
        });
      }
      rows.sort(function (a, b) { return b.s.total - a.s.total || nm(a.k).localeCompare(nm(b.k)); });
      el.innerHTML = rows.length ? rows.slice(0, TOP).map(function (row, i) { return card(row.k, row.s, i + 1); }).join("") : '<p class="bp-empty">' + emptyMsg + "</p>";
    }
    var anyRole = ROLES.some(function (r) { return roleOn[r]; });
    var anyLane = LANES.some(function (l) { return laneOn[l]; });
    if (!anyRole || !anyLane) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu role dan satu lane.</p>';
    else list(scorePick, pickEl, "Belum ada hero role/lane ini yang cocok untuk pilihan ini.", true);
    list(scoreBan, banEl, "Belum ada data counter / sinergi yang cocok untuk pilihan ini.", false);
  }

  function setMsg(m) { document.getElementById("bp-msg").textContent = m || ""; }
  function renderChips(key) {
    document.getElementById("chips-" + key).innerHTML = state[key].map(function (id) {
      return '<span class="chip chip-' + key + '">' + esc(nm(id)) + '<button type="button" data-k="' + key + '" data-s="' + id + '" aria-label="Hapus ' + esc(nm(id)) + '">&times;</button></span>';
    }).join("");
  }
  function add(key, id) {
    for (var k in state) if (state[k].indexOf(id) >= 0) { setMsg(nm(id) + " sudah ada di daftar " + LABEL[k] + "."); return false; }
    state[key].push(id);
    setMsg("");
    renderChips(key);
    render();
    return true;
  }
  function remove(key, id) {
    state[key] = state[key].filter(function (s) { return s !== id; });
    renderChips(key);
    render();
  }

  ["ban", "ally", "enemy"].forEach(function (key) {
    var input = document.getElementById("in-" + key);
    var ac = document.getElementById("ac-" + key);
    var active = -1;
    var opts = [];
    var skipFocus = false;
    function close() { ac.classList.add("hidden"); active = -1; }
    function show() {
      var q = input.value.trim().toLowerCase();
      var t = taken();
      opts = IDS.filter(function (id) {
        if (t.indexOf(id) >= 0) return false;
        if (!q) return true;
        return H[id].name.toLowerCase().indexOf(q) >= 0 || id === q;
      }).sort(function (a, b) {
        function rankName(id) {
          if (!q) return 0;
          var n = H[id].name.toLowerCase();
          return n === q ? 0 : n.indexOf(q) === 0 ? 1 : 2;
        }
        return rankName(a) - rankName(b) || H[a].name.localeCompare(H[b].name);
      }).slice(0, 12);
      if (!opts.length) {
        ac.innerHTML = '<li class="ac-none">Tidak ada hero yang cocok</li>';
        ac.classList.remove("hidden");
        return;
      }
      ac.innerHTML = opts.map(function (id, i) {
        return '<li data-i="' + i + '"' + (i === active ? ' class="on"' : "") + ">" + esc(H[id].name) + "</li>";
      }).join("");
      ac.classList.remove("hidden");
    }
    function choose(i) {
      if (opts[i] && add(key, opts[i])) input.value = "";
      skipFocus = true;
      close();
      input.focus();
    }
    input.addEventListener("input", function () { active = -1; show(); });
    input.addEventListener("focus", function () { if (skipFocus) { skipFocus = false; return; } show(); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { active = Math.min(active + 1, opts.length - 1); show(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { active = Math.max(active - 1, 0); show(); ev.preventDefault(); }
      else if (ev.key === "Enter") { choose(active >= 0 ? active : 0); ev.preventDefault(); }
      else if (ev.key === "Escape") close();
      else if (ev.key === "Backspace" && !input.value && state[key].length) remove(key, state[key][state[key].length - 1]);
    });
    ac.addEventListener("mousedown", function (ev) {
      var li = ev.target.closest("li[data-i]");
      if (li) { ev.preventDefault(); choose(+li.dataset.i); }
    });
  });

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest(".chip button");
    if (b) remove(b.dataset.k, b.dataset.s);
  });
  document.getElementById("bp-reset").addEventListener("click", function () {
    state = { ban: [], ally: [], enemy: [] };
    ["ban", "ally", "enemy"].forEach(renderChips);
    setMsg("");
    render();
  });
  document.querySelector(".bp-rank-switch").addEventListener("click", function (ev) {
    var btn = ev.target.closest(".rank-chip");
    if (!btn) return;
    pool = btn.getAttribute("data-pool");
    document.querySelectorAll(".rank-chip").forEach(function (el) {
      var on = el === btn;
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    render();
  });
  function wireFilter(box, map, attr) {
    box.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".role-chip");
      if (!btn) return;
      var key = btn.getAttribute(attr);
      map[key] = !map[key];
      btn.classList.toggle("on", map[key]);
      btn.setAttribute("aria-pressed", map[key] ? "true" : "false");
      render();
    });
  }
  wireFilter(document.getElementById("role-filter"), roleOn, "data-role");
  wireFilter(document.getElementById("lane-filter"), laneOn, "data-lane");
  render();
})();
