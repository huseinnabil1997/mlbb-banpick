// Latar Ban & Pick: art hero rekomendasi pick #1 di atas, memudar ke gradien warnanya.
// Art: data/hero-art.js (URL painting dari API mobilelegends.com). Warna gradien diambil dari art
// (atau ikon kalau art gagal), dicampur ke navy supaya teks tetap terbaca. Fallback: navy polos.
// Hanya membaca DOM hasil render (#out-pick); logika rekomendasi tidak disentuh.
(function () {
  "use strict";
  var out = document.getElementById("out-pick");
  if (!out || !window.MutationObserver) return;
  var root = document.documentElement, current = null, cache = {};
  var ART = window.HERO_ART || {}, ICONS = window.HERO_ICONS || {};
  var byIcon = {};
  Object.keys(ICONS).forEach(function (id) { byIcon[ICONS[id]] = id; });
  document.body.classList.add("hero-bg");

  // Dua lapis art untuk crossfade.
  var art = document.createElement("div");
  art.className = "hero-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = '<div class="hero-art-layer"></div><div class="hero-art-layer"></div><div class="hero-art-fade"></div>';
  document.body.insertBefore(art, document.body.firstChild);
  var layers = art.querySelectorAll(".hero-art-layer"), front = 0;
  function showArt(url) {
    if (!url) { layers[0].classList.remove("on"); layers[1].classList.remove("on"); return; }
    var pre = new Image();
    pre.onload = function () {
      if (current !== url) return;
      var next = 1 - front;
      layers[next].style.backgroundImage = 'url("' + url + '")';
      layers[next].classList.add("on");
      layers[front].classList.remove("on");
      front = next;
    };
    pre.onerror = function () { if (current === url) showArt(null); };
    pre.src = url;
  }

  // Campur warna ke navy (#0d1424) supaya tetap gelap dan teks terang terbaca.
  var NAVY = [13, 20, 36];
  function dark(c, keep) {
    return "rgb(" + c.map(function (v, i) { return Math.round(NAVY[i] + (v - NAVY[i]) * keep); }).join(",") + ")";
  }
  function colorsOf(img) {
    var size = 24, cv = document.createElement("canvas");
    cv.width = cv.height = size;
    var ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    var px = ctx.getImageData(0, 0, size, size).data, buckets = {};
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max < 30 || min > 235) continue; // abaikan hitam/putih
      var key = (r >> 5) + "," + (g >> 5) + "," + (b >> 5);
      var bk = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0, sat: 0 });
      bk.n++; bk.r += r; bk.g += g; bk.b += b; bk.sat += max - min;
    }
    var list = Object.keys(buckets).map(function (k) {
      var bk = buckets[k];
      return { c: [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n], w: bk.n * (1 + bk.sat / bk.n / 128) };
    }).sort(function (a, b) { return b.w - a.w; });
    if (!list.length) return null;
    var first = list[0].c, second = first;
    for (var j = 1; j < list.length; j++) {
      var c = list[j].c, d = Math.abs(c[0] - first[0]) + Math.abs(c[1] - first[1]) + Math.abs(c[2] - first[2]);
      if (d > 90) { second = c; break; }
    }
    return [dark(first, 0.42), dark(second, 0.3)];
  }
  function apply(cols) {
    if (cols) {
      root.style.setProperty("--hero-bg-1", cols[0]);
      root.style.setProperty("--hero-bg-2", cols[1]);
    } else {
      root.style.removeProperty("--hero-bg-1");
      root.style.removeProperty("--hero-bg-2");
    }
  }
  function loadColors(src, alt) {
    if (cache[src] !== undefined) { if (cache[src] || !alt) return apply(cache[src]); return loadColors(alt); }
    var probe = new Image();
    probe.crossOrigin = "anonymous"; // server gambar mengirim Access-Control-Allow-Origin: *
    probe.onload = function () {
      var cols = null;
      try { cols = colorsOf(probe); } catch (err) { cols = null; }
      cache[src] = cols;
      if (key !== keyNow()) return;
      if (cols || !alt) apply(cols); else loadColors(alt);
    };
    probe.onerror = function () { cache[src] = null; if (key !== keyNow()) return; if (alt) loadColors(alt); else apply(null); };
    var key = keyNow();
    probe.src = src;
  }
  function keyNow() { return current; }
  function heroIdOf(card) {
    var img = card && card.querySelector(".bp-ico img");
    return img ? byIcon[img.getAttribute("src")] || null : null;
  }
  function update() {
    var card = out.querySelector(".bp-card");
    var id = heroIdOf(card);
    var img = card && card.querySelector(".bp-ico img");
    var artUrl = id && ART[id] ? ART[id] : null;
    var iconUrl = img ? img.getAttribute("src") : null;
    var key = artUrl || iconUrl;
    if (key === current) return;
    current = key;
    showArt(artUrl);
    if (!key) { apply(null); return; }
    loadColors(key, artUrl && iconUrl !== artUrl ? iconUrl : null);
  }
  new MutationObserver(update).observe(out, { childList: true, subtree: true });
  update();
})();
