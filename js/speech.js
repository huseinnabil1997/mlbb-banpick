(function () {
  "use strict";
  var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  var inputs = document.querySelectorAll("input[data-speech]");
  if (!Ctor || !inputs.length) return;

  function heroNames() {
    var data = window.BANPICK_DATA;
    if (data && data.selectable) return data.selectable.map(function (hero) { return hero.name; });
    if (data && data.heroes) {
      return Object.keys(data.heroes).map(function (id) { return data.heroes[id].name; });
    }
    return Array.prototype.map.call(document.querySelectorAll("[data-name]"), function (el) {
      return el.getAttribute("data-name");
    });
  }

  function fold(value) {
    return String(value).toLowerCase().replace(/\bnumber\b/g, "no").replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "");
  }

  function editDistance(left, right) {
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

  function score(query, name) {
    if (query === name) return 0;
    if (query.length <= name.length && name.indexOf(query) === 0) return (name.length - query.length) * 0.4;
    if (Math.abs(query.length - name.length) > 2) return 99;
    return editDistance(query, name);
  }

  function matchName(text) {
    var query = fold(text);
    var list = heroNames();
    if (!query || !list.length) return null;
    var best = null;
    var bestDistance = 99;
    var ties = 0;
    for (var i = 0; i < list.length; i++) {
      var gap = score(query, fold(list[i]));
      if (gap < bestDistance) {
        bestDistance = gap;
        best = list[i];
        ties = 1;
      } else if (gap === bestDistance) {
        ties += 1;
      }
    }
    var limit = Math.max(1, Math.ceil(query.length * 0.45));
    if (!best || bestDistance > limit || ties > 1) return null;
    return best;
  }

  function matchMany(text) {
    var words = String(text).toLowerCase().replace(/\bnumber\b/g, "no").replace(/['’.]/g, " ").split(/[^a-z0-9]+/).filter(Boolean);
    var found = [];
    var i = 0;
    while (i < words.length) {
      var hit = null;
      var take = 1;
      var max = Math.min(4, words.length - i);
      for (var n = max; n >= 1; n--) {
        var name = matchName(words.slice(i, i + n).join(" "));
        if (name) { hit = name; take = n; break; }
      }
      if (hit) found.push(hit);
      i += take;
    }
    return found;
  }

  // iOS Safari meminta izin mic ulang di setiap rec.start(), jadi jangan auto-restart di iOS.
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = !isIOS;
  rec.maxAlternatives = 5;

  var token = 0;
  var live = 0;
  var activeInput = null;
  var activeBtn = null;
  var added = {};

  function clearButton() {
    if (!activeBtn) return;
    activeBtn.classList.remove("on");
    activeBtn.textContent = "Suara";
    activeBtn.setAttribute("aria-pressed", "false");
    activeBtn = null;
    activeInput = null;
  }

  rec.onstart = function () { live = token; };
  rec.onend = function () {
    if (live !== token || !activeInput) return;
    if (isIOS) { clearButton(); return; }
    setTimeout(function () {
      if (live !== token || !activeInput) return;
      try { rec.start(); } catch (err) { clearButton(); }
    }, 150);
  };
  rec.onerror = function (event) {
    if (live !== token) return;
    if (event.error === "aborted") return;
    if (event.error === "no-speech" && !isIOS) return;
    clearButton();
  };
  function commit(name) {
    var key = fold(name);
    if (added[key]) return;
    added[key] = true;
    activeInput.value = name;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }
  // Pilih alternatif transkrip yang paling banyak cocok dengan nama hero.
  function bestFinal(result) {
    var best = { text: result[0].transcript, names: matchMany(result[0].transcript) };
    for (var k = 1; k < result.length; k++) {
      var names = matchMany(result[k].transcript);
      if (names.length > best.names.length) best = { text: result[k].transcript, names: names };
    }
    return best;
  }

  rec.onresult = function (event) {
    if (!activeInput) return;
    var finalText = "";
    var finalNames = [];
    var interim = "";
    for (var i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        var pick = bestFinal(event.results[i]);
        finalText += " " + pick.text;
        finalNames = finalNames.concat(pick.names);
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    finalText = finalText.trim();
    interim = interim.trim();
    var picking = activeInput.getAttribute("data-speech") === "pick";
    if (picking) {
      finalNames.forEach(commit);
      activeInput.value = interim;
      if (interim) activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // Interim hanya untuk tampilan; pencocokan nama pakai hasil final saja.
    if (interim) {
      activeInput.value = (finalText + " " + interim).trim();
    } else {
      activeInput.value = finalNames.length === 1 ? finalNames[0] : finalText;
    }
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
  };

  function listen(btn, input) {
    var mine = ++token;
    clearButton();
    activeBtn = btn;
    activeInput = input;
    added = {};
    btn.classList.add("on");
    btn.textContent = "Stop";
    btn.setAttribute("aria-pressed", "true");
    input.focus();
    try { rec.abort(); } catch (err) { /* belum mulai */ }
    setTimeout(function () {
      if (token !== mine) return;
      try {
        rec.start();
      } catch (err) {
        clearButton();
      }
    }, 120);
  }

  Array.prototype.forEach.call(inputs, function (input) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mic-btn";
    btn.textContent = "Suara";
    btn.setAttribute("aria-label", "Ucapkan nama hero");
    btn.setAttribute("aria-pressed", "false");
    input.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", function () {
      if (activeBtn === btn) {
        token += 1;
        try { rec.abort(); } catch (err) { /* sudah berhenti */ }
        clearButton();
        return;
      }
      listen(btn, input);
    });
  });
})();
