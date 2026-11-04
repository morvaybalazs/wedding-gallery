// Wedding gallery: carousel of every photo, chapter grid, full-screen viewer,
// Colour/B&W and Plain/Framed switches, and downloads.
// Photos come from photos.json (made by tools/build_photos.py).

const CHAPTERS = [
  { key: "ceremony", number: "i.", title: "The ceremony" },
  { key: "garden", number: "ii.", title: "In the garden" },
];
const ZIP_BASE = "https://github.com/morvaybalazs/wedding-gallery/releases/latest/download/";
const ZIP_LABELS = {
  "colour": "Colour",
  "bw": "Black & white",
  "framed-colour": "Framed colour",
  "framed-bw": "Framed black & white",
};
const PREVIEW_ID = "30"; // the photo shown on each "Download all" card

const state = { tone: "colour", framed: false };
let photos = [];
let byId = {};
let viewerIndex = 0;

try {
  const saved = JSON.parse(localStorage.getItem("gallery-view") || "{}");
  if (saved.tone === "bw") state.tone = "bw";
  if (saved.framed === true) state.framed = true;
} catch {}

const $ = (id) => document.getElementById(id);
const version = () => (state.framed ? "framed-" : "") + state.tone;
const src = (p, size, v = version()) => `photos/${v}/${size}/${p.id}.jpg`;
const ratio = (p) => { const [w, h] = p.v[version()]; return w / h; };
const touch = matchMedia("(pointer: coarse)").matches;
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';

function img(p, size, eager) {
  const el = document.createElement("img");
  el.alt = `Wedding photo ${photos.indexOf(p) + 1}`;
  el.decoding = "async";
  if (!eager) el.loading = "lazy";
  el.dataset.id = p.id;
  el.dataset.size = size;
  el.addEventListener("load", () => el.classList.add("loaded"));
  el.src = src(p, size);
  return el;
}

/* ---------- Colour / B&W and Plain / Framed ---------- */

function renderControls() {
  document.querySelectorAll("[data-controls]").forEach((box) => {
    box.innerHTML = `
      <div class="seg" role="group" aria-label="Colour or black and white">
        <button type="button" data-tone="colour">Colour</button>
        <button type="button" data-tone="bw">Black &amp; white</button>
      </div>
      <div class="seg" role="group" aria-label="With or without a frame">
        <button type="button" data-framed="false">Plain</button>
        <button type="button" data-framed="true">Framed</button>
      </div>`;
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tone], [data-framed]");
    if (!b) return;
    if (b.dataset.tone) state.tone = b.dataset.tone;
    if (b.dataset.framed) state.framed = b.dataset.framed === "true";
    try { localStorage.setItem("gallery-view", JSON.stringify(state)); } catch {}
    applyVersion();
  });
}

function applyVersion() {
  document.querySelectorAll("[data-tone]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tone === state.tone));
  document.querySelectorAll("[data-framed]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.framed === String(state.framed)));
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
    open.setAttribute("aria-label", `Open photo ${i + 1} of ${photos.length} full screen`);
    open.append(img(p, "large", i < 2));
    open.addEventListener("click", () => {
      if (i === current) openViewer(i);
      else { stopAutoplay(); goTo(i); } // a tap on a peeking photo brings it to the centre first
    });

    const dl = document.createElement("button");
    dl.className = "card-dl";
    dl.type = "button";
    dl.innerHTML = `${ICON_DOWNLOAD}<span>Download</span>`;
    dl.setAttribute("aria-label", `Download photo ${i + 1}`);
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
  ["pointerdown", "wheel", "touchstart"].forEach((t) => carousel.addEventListener(t, stopAutoplay, { passive: true }));
  addEventListener("resize", centreEnds);

  centreEnds();
  markCurrent();
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
  const mid = carousel.scrollLeft + carousel.clientWidth / 2;
  let best = 0, dist = Infinity;
  slides.forEach((s, i) => {
    const d = Math.abs(s.offsetLeft - carousel.offsetLeft + s.offsetWidth / 2 - mid);
    if (d < dist) { dist = d; best = i; }
  });
  current = best;
  slides.forEach((s, i) => s.classList.toggle("current", i === best));
  $("carousel-count").textContent = `${String(best + 1).padStart(2, "0")} / ${slides.length}`;
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
    sec.innerHTML = `<div class="chapter-head"><span class="num">${c.number}</span><h2>${c.title}</h2><span class="n">${list.length} photographs</span></div>`;
    const rows = document.createElement("div");
    rows.className = "rows";
    list.forEach((p) => {
      const b = document.createElement("button");
      b.className = "tile";
      b.type = "button";
      b.dataset.r = "";
      b.setAttribute("aria-label", `Open photo ${photos.indexOf(p) + 1} of ${photos.length} full screen`);
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
    const heightFor = (group) => (width - gap * (group.length - 1)) / group.reduce((s, t) => s + t._r, 0);

    tiles.forEach((t) => { t._r = parseFloat(t.style.getPropertyValue("--r")); });
    const rows = [];
    let group = [];
    tiles.forEach((t) => {
      group.push(t);
      const h = heightFor(group);
      if (h <= target) {
        const without = group.length > 1 ? heightFor(group.slice(0, -1)) : Infinity;
        if (Math.abs(without - target) < Math.abs(h - target)) {
          rows.push(group.slice(0, -1));
          group = [t];
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
      g.forEach((t) => { t.style.width = isLast ? `${t._r * target}px` : ""; });
      row.append(...g);
      return row;
    }));
  });
}

/* ---------- Download all ---------- */

function buildZips(zips) {
  if (!zips) return;
  $("zips").innerHTML = Object.entries(ZIP_LABELS).filter(([key]) => zips[key]).map(([key, label]) => `
    <a class="zip" href="${ZIP_BASE}${zips[key].file}" download>
      <img src="${src(byId[PREVIEW_ID] || photos[0], "thumb", key)}" alt="" loading="lazy">
      <span class="zip-name">${label}</span>
      <span class="zip-meta">${photos.length} photos · ${zips[key].mb} MB</span>
      <span class="zip-go">${ICON_DOWNLOAD}Download zip</span>
    </a>`).join("");
  $("download-all").hidden = false;
}

/* ---------- Viewer ---------- */

const viewer = $("viewer");
const viewerImg = $("viewer-img");
const blobs = new Map(); // url -> Promise<Blob>, so sharing on a phone can start straight away

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
  const swap = () => { viewerImg.src = url; viewerImg.alt = `Wedding photo ${viewerIndex + 1}`; };
  if (fade) {
    viewerImg.classList.add("fading");
    const pre = new Image();
    pre.onload = pre.onerror = () => { swap(); viewerImg.classList.remove("fading"); };
    pre.src = url;
  } else {
    swap();
  }
  $("viewer-count").textContent = `${viewerIndex + 1} of ${photos.length}`;
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

fetch("photos.json")
  .then((r) => r.json())
  .then((data) => {
    photos = data.photos;
    byId = Object.fromEntries(photos.map((p) => [p.id, p]));
    document.body.classList.toggle("is-framed", state.framed);
    renderControls();
    buildGallery();
    buildCarousel();
    buildZips(data.zips);
    setupViewer();
    applyVersion();
  });
