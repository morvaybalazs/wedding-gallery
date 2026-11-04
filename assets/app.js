// Wedding gallery: carousel of every photo, chapter grid, full-screen viewer,
// Colour/B&W and No frame/Framed switches, downloads, and three languages.
// Photos come from photos.json (made by tools/build_photos.py); text from i18n.js.

const CHAPTERS = [
  { key: "ceremony", number: "i." },
  { key: "garden", number: "ii." },
];
const ZIP_BASE = "https://github.com/morvaybalazs/wedding-gallery/releases/latest/download/";
const ZIP_LABELS = { "colour": "zipColour", "bw": "zipBw", "framed-colour": "zipFramedColour", "framed-bw": "zipFramedBw" };
const PREVIEW_ID = "30"; // the photo shown on each "Download all" card
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';

const $ = (id) => document.getElementById(id);
const touch = matchMedia("(pointer: coarse)").matches;
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

/* ---------- Language ---------- */

const codes = LANGUAGES.map((l) => l.code);
let lang = (() => {
  const fromLink = new URLSearchParams(location.search).get("lang");
  if (codes.includes(fromLink)) return fromLink;
  const saved = store.get("gallery-lang");
  return codes.includes(saved) ? saved : "en";
})();

function t(key, ...args) {
  const value = STRINGS[lang][key] ?? STRINGS.en[key];
  return typeof value === "function" ? value(...args) : value;
}

function renderLanguages() {
  $("langs").innerHTML = LANGUAGES.map((l) => `
    <button type="button" data-lang="${l.code}" lang="${l.code}">
      <img src="${l.flag}" alt="" width="18" height="18"><span>${l.name}</span>
    </button>`).join("");
  $("langs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) setLanguage(b.dataset.lang);
  });
}

function setLanguage(code) {
  lang = code;
  store.set("gallery-lang", code);
  // Keep the choice in the address, so a copied link opens in the same language.
  const url = new URL(location.href);
  if (code === "en") url.searchParams.delete("lang"); else url.searchParams.set("lang", code);
  history.replaceState(null, "", url);
  applyLanguage();
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $("hint").textContent = t(touch ? "hintTouch" : "hintMouse");

  renderControls();
  document.querySelectorAll("[data-chapter]").forEach((head) => {
    head.querySelector("h2").textContent = t(head.dataset.chapter);
    head.querySelector(".n").textContent = t("photos", Number(head.dataset.count));
  });
  slides.forEach((s, i) => {
    s.querySelector(".slide-open").setAttribute("aria-label", t("open", i + 1, photos.length));
    s.querySelector(".card-dl span").textContent = t("download");
    s.querySelector(".card-dl").setAttribute("aria-label", t("downloadOne", i + 1));
  });
  document.querySelectorAll(".tile").forEach((b) => {
    const i = photos.indexOf(byId[b.dataset.id]) + 1;
    b.setAttribute("aria-label", t("open", i, photos.length));
  });
  document.querySelectorAll("img[data-id]").forEach((el) => { el.alt = t("alt", photos.indexOf(byId[el.dataset.id]) + 1); });
  buildZips();
  markCurrent();
  if (viewer.open) $("viewer-count").textContent = t("count", viewerIndex + 1, photos.length);
}

/* ---------- Colour / B&W and No frame / Framed ---------- */

const state = { tone: "colour", framed: false };
const savedView = store.get("gallery-view") || {};
if (savedView.tone === "bw") state.tone = "bw";
if (savedView.framed === true) state.framed = true;

const version = () => (state.framed ? "framed-" : "") + state.tone;
const src = (p, size, v = version()) => `photos/${v}/${size}/${p.id}.jpg`;
const ratio = (p) => { const [w, h] = p.v[version()]; return w / h; };

function renderControls() {
  document.querySelectorAll("[data-controls]").forEach((box) => {
    box.innerHTML = `
      <div class="seg" role="group" aria-label="${t("toneGroup")}">
        <button type="button" data-tone="colour">${t("colour")}</button>
        <button type="button" data-tone="bw">${t("bw")}</button>
      </div>
      <div class="seg" role="group" aria-label="${t("frameGroup")}">
        <button type="button" data-framed="false">${t("plain")}</button>
        <button type="button" data-framed="true">${t("framed")}</button>
      </div>`;
  });
  syncPressed();
}

function syncPressed() {
  document.querySelectorAll("[data-tone]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tone === state.tone));
  document.querySelectorAll("[data-framed]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.framed === String(state.framed)));
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tone], [data-framed]");
  if (!b) return;
  if (b.dataset.tone) state.tone = b.dataset.tone;
  if (b.dataset.framed) state.framed = b.dataset.framed === "true";
  store.set("gallery-view", state);
  applyVersion();
});

function applyVersion() {
  syncPressed();
  document.body.classList.toggle("is-framed", state.framed);

  document.querySelectorAll("img[data-id]").forEach((el) => {
    const p = byId[el.dataset.id];
    const next = src(p, el.dataset.size);
    if (el.getAttribute("src") !== next) {
      if (el.classList.contains("loaded")) {
        // Load the other version first, then swap in one go so nothing blinks.
        const pre = new Image();
        pre.src = next;
        pre.decode().catch(() => {}).then(() => { if (el.dataset.want === next) el.src = next; });
      } else {
        el.src = next;
      }
      el.dataset.want = next;
    }
    el.closest("[data-r]").style.setProperty("--r", ratio(p));
  });
  if (viewer.open) showInViewer(viewerIndex, false);
  layoutRows();
  requestAnimationFrame(centreEnds);
}

/* ---------- Shared bits ---------- */

let photos = [];
let byId = {};
let zipInfo = null;

function img(p, size, eager) {
  const el = document.createElement("img");
  el.alt = t("alt", photos.indexOf(p) + 1);
  el.decoding = "async";
  if (!eager) el.loading = "lazy";
  el.dataset.id = p.id;
  el.dataset.size = size;
  el.addEventListener("load", () => el.classList.add("loaded"));
  el.src = src(p, size);
  return el;
}

/* ---------- Carousel of every photo ---------- */

const carousel = $("carousel");
let slides = [];
let current = 0;
let autoplay;

function buildCarousel() {
  slides = photos.map((p, i) => {
    const card = document.createElement("div");
    card.className = "slide";
    card.dataset.r = "";
    card.style.setProperty("--r", ratio(p));

    const open = document.createElement("button");
    open.className = "slide-open";
    open.type = "button";
    open.append(img(p, "large", i < 2));
    open.addEventListener("click", () => {
      if (i === current) openViewer(i);
      else { stopAutoplay(); goTo(i); } // a tap on a peeking photo brings it to the centre first
    });

    const dl = document.createElement("button");
    dl.className = "card-dl";
    dl.type = "button";
    dl.innerHTML = `${ICON_DOWNLOAD}<span></span>`;
    dl.addEventListener("click", () => { stopAutoplay(); downloadPhoto(p); });

    card.append(open, dl);
    carousel.append(card);
    return card;
  });

  carousel.addEventListener("scroll", () => {
    cancelAnimationFrame(carousel._raf);
    carousel._raf = requestAnimationFrame(markCurrent);
  }, { passive: true });

  $("prev").addEventListener("click", () => { stopAutoplay(); goTo(current - 1); });
  $("next").addEventListener("click", () => { stopAutoplay(); goTo(current + 1); });
  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { stopAutoplay(); goTo(current + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { stopAutoplay(); goTo(current - 1); e.preventDefault(); }
  });
  ["pointerdown", "wheel", "touchstart"].forEach((type) => carousel.addEventListener(type, stopAutoplay, { passive: true }));
  addEventListener("resize", centreEnds);

  centreEnds();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    autoplay = setInterval(() => {
      if (!document.hidden && !viewer.open) goTo((current + 1) % slides.length);
    }, 5500);
  }
}

// Pad the strip so the first and last photos can sit in the centre.
function centreEnds() {
  if (!slides.length) return;
  const w = carousel.clientWidth;
  carousel.style.paddingLeft = `${Math.max(16, (w - slides[0].offsetWidth) / 2)}px`;
  carousel.style.paddingRight = `${Math.max(16, (w - slides[slides.length - 1].offsetWidth) / 2)}px`;
  goTo(current, true);
}

function markCurrent() {
  if (!slides.length) return;
  const mid = carousel.scrollLeft + carousel.clientWidth / 2;
  let best = 0, dist = Infinity;
  slides.forEach((s, i) => {
    const d = Math.abs(s.offsetLeft - carousel.offsetLeft + s.offsetWidth / 2 - mid);
    if (d < dist) { dist = d; best = i; }
  });
  current = best;
  slides.forEach((s, i) => s.classList.toggle("current", i === best));
  $("carousel-count").textContent = t("count", best + 1, slides.length);
  $("progress").style.width = `${((best + 1) / slides.length) * 100}%`;
  $("prev").disabled = best === 0;
  $("next").disabled = best === slides.length - 1;
  if (touch && navigator.canShare) blob(src(photos[best], "large")); // ready for an instant share
}

function goTo(i, instant) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  const s = slides[i];
  carousel.scrollTo({
    left: s.offsetLeft - carousel.offsetLeft + s.offsetWidth / 2 - carousel.clientWidth / 2,
    behavior: instant ? "instant" : "smooth",
  });
}

function stopAutoplay() { clearInterval(autoplay); }

/* ---------- Gallery grid ---------- */

function buildGallery() {
  const main = $("gallery");
  CHAPTERS.forEach((c) => {
    const list = photos.filter((p) => p.chapter === c.key);
    if (!list.length) return;
    const sec = document.createElement("section");
    sec.className = "chapter";
    sec.innerHTML = `<div class="chapter-head" data-chapter="${c.key}" data-count="${list.length}"><span class="num">${c.number}</span><h2></h2><span class="n"></span></div>`;
    const rows = document.createElement("div");
    rows.className = "rows";
    list.forEach((p) => {
      const b = document.createElement("button");
      b.className = "tile";
      b.type = "button";
      b.dataset.r = "";
      b.dataset.id = p.id;
      b.style.setProperty("--r", ratio(p));
      b.append(img(p, "thumb"));
      b.addEventListener("click", () => openViewer(photos.indexOf(p)));
      rows.append(b);
    });
    sec.append(rows);
    main.append(sec);
  });
  let lastWidth = 0;
  addEventListener("resize", () => {
    if (main.clientWidth !== lastWidth) { lastWidth = main.clientWidth; layoutRows(); }
  });
}

// Group tiles into rows near the target height; full rows stretch to the edge,
// the final row keeps the target height.
function layoutRows() {
  document.querySelectorAll(".rows").forEach((box) => {
    const tiles = [...box.querySelectorAll(".tile")];
    const style = getComputedStyle(box);
    const gap = parseFloat(style.getPropertyValue("--gap-now")) || 0;
    const target = parseFloat(style.getPropertyValue("--row")) || 260;
    const width = box.clientWidth;
    const heightFor = (group) => (width - gap * (group.length - 1)) / group.reduce((s, tile) => s + tile._r, 0);

    tiles.forEach((tile) => { tile._r = parseFloat(tile.style.getPropertyValue("--r")); });
    const rows = [];
    let group = [];
    tiles.forEach((tile) => {
      group.push(tile);
      const h = heightFor(group);
      if (h <= target) {
        const without = group.length > 1 ? heightFor(group.slice(0, -1)) : Infinity;
        if (Math.abs(without - target) < Math.abs(h - target)) {
          rows.push(group.slice(0, -1));
          group = [tile];
        } else {
          rows.push(group);
          group = [];
        }
      }
    });
    if (group.length) rows.push(group);

    box.replaceChildren(...rows.map((g, i) => {
      const row = document.createElement("div");
      const h = heightFor(g);
      const isLast = i === rows.length - 1 && h > target;
      row.className = isLast ? "row last" : "row";
      row.style.height = `${isLast ? target : h}px`;
      g.forEach((tile) => { tile.style.width = isLast ? `${tile._r * target}px` : ""; });
      row.append(...g);
      return row;
    }));
  });
}

/* ---------- Download all ---------- */

function buildZips() {
  if (!zipInfo) return;
  $("zips").innerHTML = Object.entries(ZIP_LABELS).filter(([key]) => zipInfo[key]).map(([key, label]) => `
    <a class="zip" href="${ZIP_BASE}${zipInfo[key].file}" download>
      <img src="${src(byId[PREVIEW_ID] || photos[0], "thumb", key)}" alt="" loading="lazy">
      <span class="zip-name">${t(label)}</span>
      <span class="zip-meta">${t("zipMeta", photos.length, zipInfo[key].mb)}</span>
      <span class="zip-go">${ICON_DOWNLOAD}${t("downloadZip")}</span>
    </a>`).join("");
  $("download-all").hidden = false;
}

/* ---------- Viewer ---------- */

const viewer = $("viewer");
const viewerImg = $("viewer-img");
const blobs = new Map(); // url -> Promise<Blob>, so sharing on a phone can start straight away
let viewerIndex = 0;

function openViewer(i) {
  stopAutoplay();
  document.documentElement.style.overflow = "hidden";
  viewer.showModal();
  showInViewer(i, false);
  $("close").focus();
}

function showInViewer(i, fade = true) {
  viewerIndex = (i + photos.length) % photos.length;
  const p = photos[viewerIndex];
  const url = src(p, "large");
  const swap = () => { viewerImg.src = url; viewerImg.alt = t("alt", viewerIndex + 1); };
  if (fade) {
    viewerImg.classList.add("fading");
    const pre = new Image();
    pre.onload = pre.onerror = () => { swap(); viewerImg.classList.remove("fading"); };
    pre.src = url;
  } else {
    swap();
  }
  $("viewer-count").textContent = t("count", viewerIndex + 1, photos.length);
  if (touch && navigator.canShare) blob(url);
  // Warm up the neighbours so the next photo appears instantly.
  [1, -1].forEach((d) => { new Image().src = src(photos[(viewerIndex + d + photos.length) % photos.length], "large"); });
}

function blob(url) {
  if (!blobs.has(url)) blobs.set(url, fetch(url).then((r) => r.blob()));
  return blobs.get(url);
}

async function downloadPhoto(p) {
  const url = src(p, "large");
  const n = String(photos.indexOf(p) + 1).padStart(2, "0");
  const name = `Niki-and-Balazs-${n}${state.tone === "bw" ? "-bw" : ""}${state.framed ? "-framed" : ""}.jpg`;

  // Phones: the share sheet offers "Save Image", which puts it in the photo library.
  if (touch && navigator.canShare) {
    try {
      const file = new File([await blob(url)], name, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if (err.name === "AbortError") return; // they closed the share sheet
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

function setupViewer() {
  $("close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("close", () => { document.documentElement.style.overflow = ""; });
  $("viewer-prev").addEventListener("click", () => showInViewer(viewerIndex - 1));
  $("viewer-next").addEventListener("click", () => showInViewer(viewerIndex + 1));
  $("download").addEventListener("click", () => downloadPhoto(photos[viewerIndex]));
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") showInViewer(viewerIndex + 1);
    if (e.key === "ArrowLeft") showInViewer(viewerIndex - 1);
  });

  // One-finger horizontal swipe changes photo; pinch-zoom is left to the browser.
  const stage = viewerImg.parentElement;
  let start = null;
  stage.addEventListener("touchstart", (e) => {
    start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (!start || (window.visualViewport && visualViewport.scale > 1.05)) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showInViewer(viewerIndex + (dx < 0 ? 1 : -1));
  });
}

/* ---------- Start ---------- */

renderLanguages();
fetch("photos.json")
  .then((r) => r.json())
  .then((data) => {
    photos = data.photos;
    byId = Object.fromEntries(photos.map((p) => [p.id, p]));
    zipInfo = data.zips || null;
    document.body.classList.toggle("is-framed", state.framed);
    buildGallery();
    buildCarousel();
    setupViewer();
    applyLanguage();
    applyVersion();
  });
