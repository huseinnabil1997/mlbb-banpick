(function () {
  "use strict";
  // Engine di repo ini Web Speech API (SpeechRecognition / webkitSpeechRecognition), bukan Whisper.
  // API ini tidak punya initial_prompt, jadi daftar hero dipakai setelah transkrip final
  // lewat fuzzy match Levenshtein + kamus alias.
  var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  var inputs = document.querySelectorAll("input[data-speech]");
  if (!Ctor || !inputs.length) return;
  var Match = window.HeroMatch;

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
    return Match ? Match.fold(value) : String(value).toLowerCase();
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
    if (window.HeroPicker && window.HeroPicker.addByName) {
      window.HeroPicker.addByName(name);
      return;
    }
    activeInput.value = name;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  function showUncertain(heard, part) {
    var detail = {
      query: part && part.query ? part.query : heard,
      heard: heard,
      candidates: part && part.candidates ? part.candidates : []
    };
    if (window.HeroPicker && window.HeroPicker.showCandidates) {
      window.HeroPicker.showCandidates(detail);
      return;
    }
    activeInput.value = "";
    activeInput.dispatchEvent(new CustomEvent("speech-candidates", { bubbles: true, detail: detail }));
  }

  function bestFinal(result) {
    var names = heroNames();
    var aliasMap = window.HERO_ALIASES || {};
    var best = { text: result[0].transcript, parts: Match ? Match.matchMany(result[0].transcript, names, aliasMap) : [] };
    for (var k = 1; k < result.length; k++) {
      var parts = Match ? Match.matchMany(result[k].transcript, names, aliasMap) : [];
      var hits = parts.filter(function (part) { return part.kind === "match"; }).length;
      var bestHits = best.parts.filter(function (part) { return part.kind === "match"; }).length;
      if (hits > bestHits) best = { text: result[k].transcript, parts: parts };
    }
    return best;
  }

  rec.onresult = function (event) {
    if (!activeInput) return;
    var finalText = "";
    var parts = [];
    var interim = "";
    for (var i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        var pick = bestFinal(event.results[i]);
        finalText += " " + pick.text;
        parts = parts.concat(pick.parts);
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    finalText = finalText.trim();
    interim = interim.trim();
    var picking = activeInput.getAttribute("data-speech") === "pick";
    if (picking && finalText) {
      var uncertain = null;
      parts.forEach(function (part) {
        if (part.kind === "match") commit(part.name);
        else if (part.kind === "uncertain" && !uncertain) uncertain = part;
      });
      if (uncertain || !parts.length) showUncertain(finalText, uncertain);
      else if (interim) {
        activeInput.value = interim;
        activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    if (!finalText && interim) {
      activeInput.value = interim;
      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (interim) activeInput.value = (finalText + " " + interim).trim();
    else if (parts.length === 1 && parts[0].kind === "match") activeInput.value = parts[0].name;
    else activeInput.value = finalText;
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
