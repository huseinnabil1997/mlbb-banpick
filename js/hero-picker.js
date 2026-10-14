(function () {
  "use strict";
  var api = window.Banpick;
  var Match = window.HeroMatch;
  if (!api || !Match) return;

  var H = api.heroes;
  var IDS = api.ids.slice();
  var aliases = window.HERO_ALIASES || {};
  var icons = window.HERO_ICONS || {};
  var ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
  var roleOn = {};
  ROLES.forEach(function (role) { roleOn[role] = true; });
  var target = "ally";
  var forced = null;
  var active = -1;

  var input = document.getElementById("hero-search");
  var ac = document.getElementById("ac-search");
  var grid = document.getElementById("hero-grid");
  var hint = document.getElementById("picker-hint");
  if (!input || !ac || !grid || !hint) return;

  function entries() {
    return IDS.map(function (id) {
      return { id: id, name: H[id].name, roles: H[id].roles };
    });
  }

  function activeRoles() {
    return ROLES.filter(function (role) { return roleOn[role]; });
  }

  function currentList() {
    if (forced) {
      var scoreOf = {};
      (forced.candidates || []).forEach(function (row) {
        scoreOf[Match.fold(row.name)] = row.score;
      });
      return entries().filter(function (entry) {
        return Object.prototype.hasOwnProperty.call(scoreOf, Match.fold(entry.name));
      }).sort(function (a, b) {
        return (scoreOf[Match.fold(b.name)] || 0) - (scoreOf[Match.fold(a.name)] || 0);
      });
    }
    return Match.filterHeroes(entries(), input.value, {
      roles: activeRoles(),
      aliases: aliases,
      minLetters: 2
    });
  }

  function idByName(name) {
    var wanted = Match.fold(name);
    for (var i = 0; i < IDS.length; i++) {
      if (Match.fold(H[IDS[i]].name) === wanted) return IDS[i];
    }
    return null;
  }

  function setTarget(key) {
    if (key !== "ban" && key !== "ally" && key !== "enemy") return;
    target = key;
    Array.prototype.forEach.call(document.querySelectorAll("[data-target]"), function (btn) {
      var on = btn.getAttribute("data-target") === key;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".bp-field"), function (field) {
      field.classList.toggle("is-target", field.getAttribute("data-list") === key);
    });
  }

  function initials(name) {
    var parts = String(name).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return String(name).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  }

  function addByName(name) {
    var id = idByName(name);
    if (!id) return false;
    var ok = api.add(target, id);
    if (ok) {
      forced = null;
      input.value = "";
      active = -1;
      render();
    }
    return ok;
  }

  function showCandidates(detail) {
    forced = {
      query: (detail && (detail.heard || detail.query)) || "",
      candidates: (detail && detail.candidates) || []
    };
    input.value = "";
    active = -1;
    render();
  }

  function render() {
    var list = currentList();
    var taken = api.taken();
    var typed = input.value.trim();
    if (forced) {
      hint.textContent = forced.candidates.length
        ? "Kurang yakin dengan \"" + forced.query + "\". Pilih kandidat terdekat:"
        : "Tidak ketemu hero yang mirip dengan \"" + forced.query + "\".";
    } else if (!activeRoles().length) {
      hint.textContent = "Pilih minimal satu role.";
    } else if (typed.length === 1) {
      hint.textContent = "Ketik 1 huruf lagi untuk menyaring nama.";
    } else if (typed.length >= 2 && !list.length) {
      hint.textContent = "Tidak ada hero yang cocok.";
    } else {
      hint.textContent = "Ketik minimal 2 huruf, saring role, atau klik ikon. Tombol Suara opsional.";
    }

    var showAc = forced ? forced.candidates.length > 0 : typed.length >= 2;
    var acItems = showAc ? list.slice(0, 8) : [];
    ac.innerHTML = "";
    if (!showAc) {
      ac.classList.add("hidden");
    } else if (!acItems.length) {
      var none = document.createElement("li");
      none.className = "ac-none";
      none.textContent = "Tidak ada hero yang cocok";
      ac.appendChild(none);
      ac.classList.remove("hidden");
    } else {
      acItems.forEach(function (entry, index) {
        var li = document.createElement("li");
        li.dataset.i = String(index);
        if (index === active) li.className = "on";
        li.textContent = entry.name;
        ac.appendChild(li);
      });
      ac.classList.remove("hidden");
    }

    grid.innerHTML = "";
    list.forEach(function (entry) {
      var takenNow = taken.indexOf(entry.id) >= 0;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hero-tile" + (takenNow ? " taken" : "");
      btn.disabled = takenNow;
      btn.setAttribute("aria-label", (takenNow ? "Sudah dipilih: " : "Pilih ") + entry.name);
      var icon = icons[entry.id];
      if (icon) {
        var img = document.createElement("img");
        img.alt = "";
        img.width = 48;
        img.height = 48;
        img.referrerPolicy = "no-referrer";
        img.src = icon;
        img.addEventListener("error", function () {
          var fallback = document.createElement("span");
          fallback.className = "hero-fallback";
          fallback.textContent = initials(entry.name);
          if (img.parentNode) img.parentNode.replaceChild(fallback, img);
        });
        btn.appendChild(img);
      } else {
        var fallback = document.createElement("span");
        fallback.className = "hero-fallback";
        fallback.textContent = initials(entry.name);
        btn.appendChild(fallback);
      }
      var label = document.createElement("span");
      label.className = "tile-name";
      label.textContent = entry.name;
      btn.appendChild(label);
      btn.addEventListener("click", function () { addByName(entry.name); });
      grid.appendChild(btn);
    });
  }

  input.addEventListener("input", function () {
    forced = null;
    active = -1;
    render();
  });
  input.addEventListener("keydown", function (ev) {
    var list = currentList();
    var open = !ac.classList.contains("hidden");
    var limit = Math.min(list.length, 8);
    if (ev.key === "ArrowDown" && open && limit) {
      active = Math.min(active + 1, limit - 1);
      render();
      ev.preventDefault();
    } else if (ev.key === "ArrowUp" && open && limit) {
      active = Math.max(active - 1, 0);
      render();
      ev.preventDefault();
    } else if (ev.key === "Enter") {
      if (typedReady()) {
        var pick = active >= 0 ? list[active] : list[0];
        if (pick) addByName(pick.name);
      }
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      forced = null;
      active = -1;
      ac.classList.add("hidden");
      render();
    }
  });

  function typedReady() {
    return input.value.trim().length >= 2 || !!forced;
  }

  ac.addEventListener("mousedown", function (ev) {
    var li = ev.target.closest("li[data-i]");
    if (!li) return;
    ev.preventDefault();
    var entry = currentList()[+li.dataset.i];
    if (entry) addByName(entry.name);
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-target]"), function (btn) {
    btn.addEventListener("click", function () { setTarget(btn.getAttribute("data-target")); });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".bp-field"), function (field) {
    field.addEventListener("click", function () { setTarget(field.getAttribute("data-list")); });
  });

  var roleBox = document.getElementById("picker-role");
  if (roleBox) {
    roleBox.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".role-chip");
      if (!btn) return;
      var role = btn.getAttribute("data-role");
      roleOn[role] = !roleOn[role];
      btn.classList.toggle("on", roleOn[role]);
      btn.setAttribute("aria-pressed", roleOn[role] ? "true" : "false");
      forced = null;
      render();
    });
  }

  var reset = document.getElementById("bp-reset");
  if (reset) {
    reset.addEventListener("click", function () {
      forced = null;
      input.value = "";
      active = -1;
      ROLES.forEach(function (role) { roleOn[role] = true; });
      Array.prototype.forEach.call(document.querySelectorAll("#picker-role .role-chip"), function (btn) {
        btn.classList.add("on");
        btn.setAttribute("aria-pressed", "true");
      });
      setTarget("ally");
      render();
    });
  }

  api.subscribe(function () { render(); });
  setTarget("ally");
  render();

  window.HeroPicker = {
    addByName: addByName,
    showCandidates: showCandidates,
    target: function () { return target; }
  };
})();
