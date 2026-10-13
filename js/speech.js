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
    if (right.indexOf(left) === 0 || left.indexOf(right) === 0) return Math.abs(left.length - right.length);
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
    if (name.indexOf(query) === 0 || query.indexOf(name) === 0) return Math.abs(name.length - query.length) * 0.4;
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

  var rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;

  var token = 0;
  var live = 0;
  var activeInput = null;
  var activeBtn = null;

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
    if (live !== token) return;
    clearButton();
  };
  rec.onerror = function () {
    if (live !== token) return;
    clearButton();
  };
  rec.onresult = function (event) {
    if (!activeInput) return;
    var text = "";
    var isFinal = false;
    for (var i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    text = text.trim();
    var picked = isFinal ? matchName(text) : null;
    activeInput.value = picked || text;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    if (picked && activeInput.getAttribute("data-speech") === "pick") {
      activeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
  };

  function listen(btn, input) {
    var mine = ++token;
    clearButton();
    activeBtn = btn;
    activeInput = input;
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
