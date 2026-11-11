/* ==========================================================================
   js/booklet.js — optional 3D booklet ("A little book of us").

   Adds one extra section before the schedule (or after the countdown), with an
   explicit "Open 3D invitation" button. The button is what loads the library
   and rasterises the pages — nothing happens before it is pressed.

   - Page order: front cover + one photo-only "Moments" page per configured
     `bookletPhotos` entry (all five by default). No schedule, no venue and no
     phone numbers: those stay in the normal page below, so the booklet is a
     pure album of the couple's photographs.
   - Every label on the section, the bar and the drawn pages follows the
     guest's language (js/i18n.js, English / ಕನ್ನಡ); switching language while
     the book is open rebuilds its pages in the new language.
   - LeafThrough is vendored, pinned (see vendor/README.md + LICENSE files):
       ../vendor/leafthrough/dist/index.js  (MIT, Dmytro Barylo)
       ../vendor/three/build/three.module.js (MIT, three.js authors)
     An import map in index.html maps the bare "three" import to the vendored
     copy. Both files are dynamic-imported here and only on demand.
   - Layout "auto": spread (min-width 768px + landscape) / single everywhere
     else. maxPixelRatio follows the device (capped at 3), preload 2, bleed on
     (the library's spill fits the real page size and, per its docs, never adds
     a horizontal scrollbar — a bleed:false container halves the pages' width),
     loop off, motion reducedMotion "auto". No page-scroll is ever locked.
   - Page canvases draw at 3× their 800-unit design width, so text and photos
     stay crisp on 2×/3× phone screens. Photos are contained (never cropped),
     drawn on whole pixels, and never upscaled past MAX_PHOTO_UPSCALE × their
     own natural size — a small source is shown smaller instead of blurring.
   - Closing (Close button / Escape) disposes the WebGL resources.
   - If anything fails, the guest gets a readable message and the plain photo
     as an alternative; essential text always lives in the DOM elsewhere.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- language + config helpers (same conventions as js/app.js) ---------- */
  const C = (typeof window !== "undefined" && window.WEDDING) || {};
  const I18N = window.WEDDING_I18N;
  const t = (path, vars) => (I18N ? I18N.t(path, vars) : "");
  const knNow = () => !!I18N && I18N.lang === "kn";
  const str = (v) => (typeof v === "string" ? v : "");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  /* ---------- content, with fallbacks but no invented facts ---------- */
  /* resolved at draw time, so a language switch redraws names too */
  const groomNow = () => t("groom").trim() || "Groom";
  const brideNow = () => t("bride").trim() || "Bride";
  const conjunctionNow = () => t("conjunction").trim() || "&";
  const coupleNamesNow = () => `${groomNow()} ${conjunctionNow()} ${brideNow()}`;
  /* the monogram is always Latin initials, whatever language is displayed */
  const groomEn = str(C.groom).trim() || "Groom";
  const brideEn = str(C.bride).trim() || "Bride";
  const tzName = str(C.timeZone).trim() || "Asia/Kolkata";

  const fmtDate = (iso, opts) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(knNow() ? "kn-IN" : "en-IN", { timeZone: tzName, ...(opts || {}) }); }
    catch { return ""; }
  };

  const dateISO = !Number.isNaN(Date.parse(str(C.countdownTo))) ? str(C.countdownTo)
    : (Array.isArray(C.events) && C.events[0] && C.events[0].startISO) || "";
  const heroDateNow = () => fmtDate(dateISO, { day: "numeric", month: "long", year: "numeric" });
  const introTopNow = () => t("intro.top").trim() || "You're invited";
  const taglineNow = () => t("tagline").trim();
  const monogram = ((groomEn[0] || "").toUpperCase() + "·" + (brideEn[0] || "").toUpperCase()).replace(/[^A-Z·]/g, "");
  const blessing = () => t("blessing").trim();
  /* one inside page per configured photo — a custom config can add or remove
     them; missing files are simply skipped, never a blank page */
  const bookletPhotos = (Array.isArray(C.bookletPhotos) ? C.bookletPhotos : [])
    .map((p) => str(p).trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!bookletPhotos.length && str(C.couplePhoto).trim()) bookletPhotos.push(str(C.couplePhoto).trim());

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- section markup, inserted before #schedule (fallbacks below) ---------- */
  const openLabel = () => t("booklet.open") || "A Glimpse Into Our Love Story ❤️";
  const photoPath = str(C.couplePhoto).trim();
  const section = document.createElement("section");
  section.className = "booklet-sec";
  section.id = "booklet";
  section.innerHTML = `
    <header class="sec-head">
      <p class="kicker">${esc(t("booklet.kicker") || "Leaf through")}</p>
      <h2>${esc(t("booklet.title") || "A little book of us")}</h2>
      <span class="orn" aria-hidden="true"><i></i><b></b><i></i></span>
    </header>
    <div class="bk-actions">
      <button type="button" class="btn bk-open" id="booklet-open">${esc(openLabel())}</button>
    </div>
    <div class="bk-stage" id="booklet-stage" hidden></div>
    <div class="bk-bar" id="booklet-bar" hidden>
      <button type="button" class="bk-btn" id="booklet-prev" aria-label="${esc(t("booklet.prevAria") || "Previous page")}">${esc(t("booklet.prev") || "← Prev")}</button>
      <span class="bk-count" id="booklet-count"></span>
      <button type="button" class="bk-btn" id="booklet-next" aria-label="${esc(t("booklet.nextAria") || "Next page")}">${esc(t("booklet.next") || "Next →")}</button>
      <button type="button" class="bk-btn" id="booklet-close" aria-label="${esc(t("booklet.closeAria") || "Close the 3D booklet")}">${esc(t("booklet.close") || "Close")}</button>
      <button type="button" class="bk-btn bk-lang" id="booklet-lang"></button>
    </div>
    <p class="bk-hint" id="booklet-hint" hidden></p>
    <div class="bk-status" id="booklet-status" role="status" hidden></div>
    <figure class="bk-fallback" id="booklet-fallback" hidden>
      ${photoPath ? `<img src="${esc(photoPath)}" width="1600" height="1068" loading="lazy" decoding="async" alt="${esc(groomEn)} and ${esc(brideEn)} together — printed page from the booklet">` : ""}
      <figcaption>${esc(coupleNamesNow())}${heroDateNow() ? " — " + esc(heroDateNow()) : ""}</figcaption>
    </figure>`;
  const invite = document.getElementById("invite");
  const scheduleSec = document.getElementById("schedule");
  const countdownSec = document.getElementById("countdown");
  if (scheduleSec && scheduleSec.parentNode) scheduleSec.parentNode.insertBefore(section, scheduleSec);
  else if (countdownSec && countdownSec.parentNode) countdownSec.after(section);
  else if (invite) invite.appendChild(section);
  else return;

  const $ = (s, r) => r.querySelector(s);
  const btn = $("#booklet-open", section);
  const stage = $("#booklet-stage", section);
  const bar = $("#booklet-bar", section);
  const countEl = $("#booklet-count", section);
  const prevBtn = $("#booklet-prev", section);
  const nextBtn = $("#booklet-next", section);
  const closeBtn = $("#booklet-close", section);
  const langBtn = $("#booklet-lang", section);
  const hint = $("#booklet-hint", section);
  const status = $("#booklet-status", section);
  const fallbackFig = $("#booklet-fallback", section);   /* stays hidden unless something fatal happens */

  /* ==========================================================================
     Canvas pages (800 × 1102 ≈ the 1.377 page aspect), default palette
     (cream / bordeaux / deep green — same tokens as css/style.css),
     the same families the page already loaded (Bricolage Grotesque + Manrope).)
     Drawn only on Open, after document.fonts.ready, so no FOUT and no
     flash of fallback glyphs.

     The backing store is rasterised at PAGE_RASTER× while every layout
     coordinate below stays in the 800-unit design space. On a 3× phone the
     page is ~390 CSS px wide (= ~1170 device px); on a 2× desktop the
     booklet's bleed makes each page ~677 CSS px (= ~1354 device px). The old
     1.6× raster (1280 px) was therefore being stretched, and small body text
     read as blur. 3× (2400 px) gives the texture real headroom for both, while
     the library's preload radius still keeps the number of live textures down.
     ========================================================================== */
  const PAGE_W = 800;
  const PAGE_H = Math.round(PAGE_W * 1.377);
  const PAGE_RASTER = 3;
  const T = {
    bg: "#f5dabf",          /* cream paper, a shade inside the page bg */
    panel: "#faecd9",       /* photo card */
    ink: "#0f3d3a",
    maroon: "#6c151e",      /* bordeaux */
    green: "#0f3d3a",       /* deep green */
    gold: "#0f3d3a",        /* legacy name — kicker/times text is deep green */
    goldSoft: "#6c151e",    /* legacy name — linework/folio is bordeaux */
    muted: "#4a5f5b"
  };
  const F_KN = "Noto Serif Kannada";
  const F_KN_BODY = "Noto Sans Kannada";
  const KN_STACK = `"${F_KN}", "Nirmala UI", "Tunga", "Noto Sans Kannada", serif`;
  const KN_BODY_STACK = `"${F_KN_BODY}", "Nirmala UI", "Tunga", "Noto Serif Kannada", sans-serif`;
  let F_DISP = "Bricolage Grotesque";
  let F_BODY = "system-ui, sans-serif";
  try {
    const cs = getComputedStyle(document.body);
    const first = (token, fb) => {
      const v = cs.getPropertyValue(token).trim();
      return v ? v.split(",")[0].replace(/["']/g, "").trim() : fb;
    };
    F_DISP = first("--f-display", "Georgia") || "Georgia";
    F_BODY = first("--f-body", "system-ui") || "system-ui";
  } catch { /* defaults stand */ }

  /* Canvas text must be drawn with a family that actually has Kannada glyphs,
     otherwise the browser picks an unpredictable fallback face. */
  const disp = (weight, px) => `${weight} ${px}px ${knNow() ? KN_STACK : `"${F_DISP}"`}`;
  const body = (weight, px) => `${weight} ${px}px ${knNow() ? KN_BODY_STACK : `"${F_BODY}"`}`;

  async function ensureFonts() {
    try {
      const blessingText = blessing();
      if (blessingText) await document.fonts.load(
        knNow() ? `700 48px "${F_KN}"` : `700 48px "${F_DISP}"`, blessingText
      ).catch(() => {});
      const reqs = [
        `500 60px "${F_DISP}"`, `600 60px "${F_DISP}"`, `700 60px "${F_DISP}"`,
        `400 26px "${F_BODY}"`, `500 26px "${F_BODY}"`, `700 26px "${F_BODY}"`
      ];
      if (knNow()) {
        reqs.push(
          `400 26px "${F_KN_BODY}"`, `500 26px "${F_KN_BODY}"`, `700 26px "${F_KN_BODY}"`,
          `600 60px "${F_KN}"`, `700 60px "${F_KN}"`
        );
      }
      await Promise.all(reqs.map((f) => document.fonts.load(f).catch(() => {})));
      await document.fonts.ready;
    } catch { /* canvas fallback faces are fine */ }
  }

  const page = () => {
    const cv = document.createElement("canvas");
    cv.width = Math.round(PAGE_W * PAGE_RASTER);
    cv.height = Math.round(PAGE_H * PAGE_RASTER);
    const ctx = cv.getContext("2d");
    ctx.scale(PAGE_RASTER, PAGE_RASTER);            /* draw in 800-unit coordinates */
    try { ctx.imageSmoothingQuality = "high"; } catch { /* older canvas: default is fine */ }
    return { cv, ctx };
  };

  const wrapLines = (ctx, text, maxW) => {
    const out = []; let line = "";
    for (const w of String(text).split(/\s+/).filter(Boolean)) {
      const joined = line ? line + " " + w : w;
      if (line && ctx.measureText(joined).width > maxW) { out.push(line); line = w; }
      else line = joined;
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  };
  const fillLines = (ctx, lines, cx, y, lineH) => {
    ctx.textAlign = "center";
    lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
    return y + lines.length * lineH;
  };
  /* letter-spaced, centred text (canvas can't letterSpace reliably everywhere).
     Kannada is drawn as one string: per-character drawing would split its
     matras from their consonants and the text would come out scrambled. */
  const spaced = (ctx, text, cx, y, ls) => {
    if (knNow()) {
      const prevAlign = ctx.textAlign;
      ctx.textAlign = "center";
      ctx.fillText(text, cx, y);
      ctx.textAlign = prevAlign;
      return;
    }
    const gap = ls;
    const chars = [...text];
    let w = 0;
    for (const ch of chars) w += ctx.measureText(ch).width + gap;
    w -= gap;
    let x = cx - w / 2;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = "left";
    for (const ch of chars) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + gap; }
    ctx.textAlign = prevAlign;
  };
  const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
  /* small eight-petal mandala (replaces the plain diamond in ornament lines) */
  const flower = (ctx, x, y, r) => {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = T.goldSoft;
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath(); ctx.ellipse(0, -r * 0.58, r * 0.2, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i * Math.PI) / 4 + Math.PI / 8);
      ctx.beginPath(); ctx.ellipse(0, -r * 0.4, r * 0.1, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const orn = (ctx, cx, y, half = 70) => {
    ctx.fillStyle = T.goldSoft;
    ctx.fillRect(cx - half - 8, y, half - 10, 1.4);
    ctx.fillRect(cx + 18, y, half - 10, 1.4);
    flower(ctx, cx, y + 1, 13);
  };
  const blessingLine = (ctx, cx, y, size, text) => {
    ctx.save();
    ctx.font = disp(700, size); ctx.fillStyle = T.maroon;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(text, cx, y);
    ctx.restore();
  };
  const folio = (ctx, cx, n) => {
    ctx.font = body(400, 20); ctx.fillStyle = T.goldSoft;
    spaced(ctx, `·  ${n}  ·`, cx, 1030, 4);
  };
  const paintBase = (ctx) => { ctx.fillStyle = T.bg; ctx.fillRect(0, 0, PAGE_W, PAGE_H); };
  const paintFrame = (ctx) => {
    ctx.strokeStyle = T.goldSoft;
    ctx.lineWidth = 1.5; ctx.strokeRect(22.5, 22.5, PAGE_W - 45, PAGE_H - 45);
    ctx.lineWidth = 0.75; ctx.strokeRect(34.5, 34.5, PAGE_W - 69, PAGE_H - 69);
  };

  function drawCover() {
    const { cv, ctx } = page();
    const groom = groomNow(), bride = brideNow();
    const introTop = introTopNow(), tagline = taglineNow(), heroDate = heroDateNow();
    const blessingText = blessing();
    paintBase(ctx); paintFrame(ctx);
    const cx = PAGE_W / 2;
    if (blessingText) blessingLine(ctx, cx, 128, 50, blessingText);
    ctx.strokeStyle = T.goldSoft; ctx.lineWidth = 1.5; circle(ctx, cx, 236, 72);
    ctx.lineWidth = 0.75; circle(ctx, cx, 236, 64);
    ctx.fillStyle = T.maroon; ctx.font = `700 46px "${F_DISP}"`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(monogram, cx, 238);
    ctx.textBaseline = "alphabetic";
    ctx.font = body(500, 26); ctx.fillStyle = T.green;
    spaced(ctx, introTop, cx, 372, 8);
    ctx.fillStyle = T.maroon; ctx.font = disp(700, 92); ctx.fillText(groom, cx, 500);
    ctx.fillStyle = T.green; ctx.font = disp(500, 64); ctx.fillText(conjunctionNow(), cx, 578);
    ctx.fillStyle = T.maroon; ctx.font = disp(700, 92); ctx.fillText(bride, cx, 664);
    if (tagline) {
      ctx.font = body(700, 28); ctx.fillStyle = T.ink;
      spaced(ctx, tagline, cx, 736, 6);
    }
    /* no venue anywhere in the booklet — the invitation below keeps it */
    orn(ctx, cx, 866, 74);
    if (heroDate) {
      ctx.font = disp(700, 36); ctx.fillStyle = T.green; ctx.fillText(heroDate, cx, 948);
    }
    return {
      src: cv,
      alt: `Front cover — ${groom} and ${bride}${heroDate ? ", " + heroDate : ""}`,
      text: [blessingText, introTop, coupleNamesNow(), tagline, heroDate]
        .filter(Boolean).join("\n\n")
    };
  }

  /* photo page — one per configured bookletPhotos entry. The picture is
     contained (never cropped) on whole pixels, full colour, and never drawn
     larger than MAX_PHOTO_UPSCALE × its own natural size: a small source is
     shown smaller instead of being stretched into a blur. */
  const MAX_PHOTO_UPSCALE = 2.5;                 /* texture px per source px */
  function drawMoment(photo, pageNo, title) {
    const { cv, ctx } = page();
    paintBase(ctx); paintFrame(ctx);
    const cx = PAGE_W / 2;
    ctx.textAlign = "center";
    ctx.font = body(700, 23); ctx.fillStyle = T.green;
    spaced(ctx, t("booklet.moments") || "Moments", cx, 132, 8);
    ctx.font = disp(700, 52); ctx.fillStyle = T.maroon;
    ctx.fillText(title || t("booklet.moments") || "Moments", cx, 200);
    orn(ctx, cx, 248, 74);

    const iw = photo ? photo.naturalWidth || 0 : 0;
    const ih = photo ? photo.naturalHeight || 0 : 0;
    const pad = 16;
    const by = 292;
    const maxW = 632, maxH = 956 - by;                         /* keep clear of the folio */
    const ratio = iw && ih ? iw / ih : 1.4981;
    let innerW = maxW - pad * 2;
    let innerH = innerW / ratio;
    if (innerH > maxH - pad * 2) {                             /* tall photo: shrink to fit */
      innerH = maxH - pad * 2;
      innerW = innerH * ratio;
    }
    /* source-resolution guard (see MAX_PHOTO_UPSCALE above) */
    if (iw && ih) {
      const capScale = Math.min(
        1,
        (iw * MAX_PHOTO_UPSCALE) / PAGE_RASTER / innerW,
        (ih * MAX_PHOTO_UPSCALE) / PAGE_RASTER / innerH
      );
      innerW *= capScale;
      innerH *= capScale;
    }
    const bw = Math.round(innerW + pad * 2);
    const bh = Math.round(innerH + pad * 2);
    const bx = Math.round(cx - bw / 2);
    ctx.fillStyle = T.panel; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = T.goldSoft; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    if (photo && iw && ih) {
      const s2 = Math.min(innerW / iw, innerH / ih);           /* contain, never crop */
      const dw = Math.round(iw * s2);
      const dh = Math.round(ih * s2);
      ctx.drawImage(photo,
        Math.round(cx - dw / 2),
        Math.round(by + pad + (innerH - dh) / 2),
        dw, dh);
    } else {
      ctx.strokeStyle = T.goldSoft; ctx.lineWidth = 1.25; circle(ctx, cx, by + bh / 2, 54);
      ctx.fillStyle = T.muted; ctx.font = disp(500, 34); ctx.textAlign = "center";
      ctx.fillText(monogram, cx, by + bh / 2 + 3);
    }

    /* photo-only page: no repeated names or date under every picture */
    orn(ctx, cx, Math.min(by + bh + 64, 984), 74);
    folio(ctx, cx, pageNo);
    return {
      src: cv,
      alt: `A photograph of ${groomNow()} and ${brideNow()} from their booklet`,
      text: [t("booklet.moments") || "Moments", title].filter(Boolean).join("\n\n")
    };
  }

  /* ---------- lazy load the pinned, vendored copies ---------- */
  async function loadLibrary() {
    const url = new URL("../vendor/leafthrough/dist/index.js", import.meta.url).href;
    return import(url);
  }

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /* ==========================================================================
     Mobile full-viewport overlay
     On phones (max-width 767px, or a coarse pointer with a short viewport —
     landscape phones) the booklet opens in a fixed, full-viewport overlay:
     the page's scroll is locked and restored on every close/fatal path, focus
     is trapped inside the dialog, and the rest of the page is made inert.
     The stage/bar/status/hint elements are MOVED into the overlay (they keep
     their ids and listeners), so the magazine is instantiated after the move
     and measures its real (overlay) size. Desktop never activates the overlay
     and keeps the unchanged inline spread.
     ========================================================================== */
  const MOBILE_Q = "(max-width: 767px), (pointer: coarse) and (max-height: 560px)";
  const mqMobile = typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_Q) : null;
  const isMobileBooklet = () => !!(mqMobile && mqMobile.matches);

  const LOCK = "bk-lock";
  let overlay = null;
  let overlayActive = false;
  let savedScrollY = 0;
  const prevInert = new Map();

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "bk-overlay";
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `${t("booklet.dialogAria") || "3D invitation booklet"} — ${coupleNamesNow()}`);
    overlay.hidden = true;
    document.body.appendChild(overlay);           /* a body child: immune to any ancestor transform */
    return overlay;
  }

  function trapTab(e) {
    if (!overlayActive || e.key !== "Tab") return;
    const focusables = Array.from(
      overlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.getClientRects().length > 0);
    if (!focusables.length) { e.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function lockPage() {
    savedScrollY = window.scrollY;
    document.documentElement.classList.add(LOCK);
    document.body.classList.add(LOCK);
    /* everything outside the overlay becomes inert; previous values are kept
       so the restore is exact */
    Array.from(document.body.children).forEach((el) => {
      if (el === overlay || prevInert.has(el)) return;
      prevInert.set(el, el.inert === true);
      el.inert = true;
    });
  }

  function unlockPage() {
    prevInert.forEach((was, el) => {
      if (el.isConnected) el.inert = was;
    });
    prevInert.clear();
    document.documentElement.classList.remove(LOCK);
    document.body.classList.remove(LOCK);
    /* put the page back exactly where the guest left it (matters on iOS, which
       can shift the scroll even while locked) */
    try { window.scrollTo({ top: savedScrollY, behavior: "instant" }); } catch { window.scrollTo(0, savedScrollY); }
  }

  function activateOverlay() {
    if (overlayActive) return;
    ensureOverlay();
    [stage, status, bar, hint].forEach((el) => overlay.appendChild(el));
    lockPage();
    overlay.hidden = false;
    overlay.addEventListener("keydown", trapTab);
    if (mqMobile) mqMobile.addEventListener("change", onModeChange);
    overlayActive = true;
  }

  function deactivateOverlay() {
    if (!overlayActive) return;
    overlay.removeEventListener("keydown", trapTab);
    if (mqMobile) mqMobile.removeEventListener("change", onModeChange);
    /* move everything back into the section, original order */
    [stage, bar, hint, status].forEach((el) => section.insertBefore(el, fallbackFig));
    overlayActive = false;
    unlockPage();
    overlay.hidden = true;
  }

  /* opened on a phone and the context changed to desktop (windowed browsers,
     emulation): close cleanly rather than continue in a mismatched layout —
     the guest can immediately reopen, which then uses the inline spread */
  function onModeChange() {
    if (state === "open") closeBooklet();
  }

  /* ==========================================================================
     Open / close lifecycle
     ========================================================================== */
  let magazine = null;
  let state = "idle";            /* idle | loading | open | closing */
  let builtLang = "";            /* language the current pages were drawn in */
  let rebuilding = false;

  const hintText = () => (magazine && magazine.plain
    ? (t("booklet.hintPlain") || "Tap the right side of the booklet to turn pages · the arrow keys work too")
    : (t("booklet.hint3d") || "Drag or tap a page to turn it · the arrow keys work too"));

  const setOpen = (open) => {
    stage.hidden = !open;
    bar.hidden = !open;
    hint.hidden = !open;
    /* the fixed language pill steps aside: the booklet bar carries its own */
    document.body.classList.toggle("bk-open", open);
  };
  const showStatus = (html) => { status.innerHTML = html; status.hidden = false; };
  const hideStatus = () => { status.hidden = true; status.replaceChildren(); };

  const countLabel = (d) => {
    const n = d.pageCount;
    const v = d.visiblePages && d.visiblePages.length ? d.visiblePages : [d.page];
    const first = v[0] + 1, last = v[v.length - 1] + 1;
    return first === last
      ? t("booklet.pageOf", { n: first, total: n }) || `Page ${first} of ${n}`
      : t("booklet.pagesOf", { first, last, total: n }) || `Pages ${first}–${last} of ${n}`;
  };
  const syncControls = (d) => {
    const visible = d.visiblePages && d.visiblePages.length ? d.visiblePages : [d.page];
    countEl.textContent = countLabel(d);
    prevBtn.disabled = visible[0] <= 0;
    nextBtn.disabled = visible[visible.length - 1] >= d.pageCount - 1;
  };

  function paintBar() {
    prevBtn.textContent = t("booklet.prev") || "← Prev";
    nextBtn.textContent = t("booklet.next") || "Next →";
    closeBtn.textContent = t("booklet.close") || "Close";
    prevBtn.setAttribute("aria-label", t("booklet.prevAria") || "Previous page");
    nextBtn.setAttribute("aria-label", t("booklet.nextAria") || "Next page");
    closeBtn.setAttribute("aria-label", t("booklet.closeAria") || "Close the 3D booklet");
    langBtn.textContent = t("ui.langSwitch") || "EN";
    langBtn.setAttribute("aria-label", t("booklet.langAria") || "Switch language");
    langBtn.setAttribute("lang", I18N && I18N.lang === "en" ? "kn" : "en");
    langBtn.setAttribute("aria-pressed", I18N && I18N.lang === "kn" ? "true" : "false");
    const title = section.querySelector(".sec-head h2");
    const titleText = t("booklet.title") || "A little book of us";
    if (title && title.textContent.trim() !== titleText.trim()) title.textContent = titleText;
    const kicker = section.querySelector(".sec-head .kicker");
    const kickerText = t("booklet.kicker") || "Leaf through";
    if (kicker && kicker.textContent.trim() !== kickerText.trim()) kicker.textContent = kickerText;
    const cap = fallbackFig.querySelector("figcaption");
    if (cap) cap.textContent = `${coupleNamesNow()}${heroDateNow() ? " — " + heroDateNow() : ""}`;
    if (overlay) overlay.setAttribute("aria-label", `${t("booklet.dialogAria") || "3D invitation booklet"} — ${coupleNamesNow()}`);
  }

  /* the section header picked up its folds before the language changed */
  function refreshSectionHead() {
    const title = section.querySelector(".sec-head h2");
    if (!title || !title.dataset.tgx) return;
    delete title.dataset.tgx;
    if (typeof window.__tgxInitNode === "function") window.__tgxInitNode(title);
  }

  function showPageLoadError() {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "bk-btn bk-retry";
    retry.textContent = t("booklet.retry") || "Try again";
    retry.addEventListener("click", () => {
      if (magazine) { hideStatus(); magazine.retry(); }
    });
    showStatus(t("booklet.pageLoadError") || "One or more pages of the booklet couldn't load — they may come back if the signal steadies. ");
    status.appendChild(retry);
  }

  function fatal(msg) {
    deactivateOverlay();   /* if the overlay is showing, restore scroll/inert/focus path too */
    setOpen(false);
    stopCentering();
    stage.classList.remove("is-open");
    status.textContent = msg;
    status.hidden = false;
    section.setAttribute("aria-busy", "false");
    btn.disabled = false;
    btn.textContent = openLabel();
    btn.hidden = false;
    fallbackFig.hidden = !fallbackFig.querySelector("img");
  }

  async function openBooklet() {
    if (state !== "idle") return;
    state = "loading";
    btn.disabled = true;
    btn.textContent = t("booklet.preparing") || "Preparing the booklet…";
    section.setAttribute("aria-busy", "true");
    showStatus(t("booklet.preparingPages") || "Preparing pages…");
    try {
      /* fonts, library and every photo — all before any rasterising */
      await ensureFonts();
      const [lib, extraPhotos] = await Promise.all([
        loadLibrary(),
        Promise.all(bookletPhotos.map(loadImage))
      ]);
      const LT = lib && lib.LeafThrough;
      if (typeof LT !== "function") throw new Error("LeafThrough didn't load");
      /* page order: cover, then one page per photo — nothing else */
      builtLang = I18N ? I18N.lang : "en";
      const configured = t("booklet.momentTitles");
      const titles = Array.isArray(configured) ? configured : [];
      const pages = [drawCover()];
      extraPhotos.filter(Boolean).forEach((p, idx) => {
        const title = str(titles[idx]).trim() || (idx === 0 ? (t("booklet.moments") || "Moments") : "");
        pages.push(drawMoment(p, pages.length + 1, title));
      });
      /* cream page edges, matching the redrawn palette (paper.backColor is a
         documented LeafThrough material option) */
      /* size the stage before the magazine measures it (display:none boxes are 0×0).
         On phones the stage lives in the full-viewport overlay while mounted —
         activate it first so the magazine measures its real size. */
      if (isMobileBooklet()) activateOverlay();
      setOpen(true);
      magazine = new LT(stage, {
        pages,
        pageAspect: 1.377,
        bleed: true,
        loop: false,
        /* render the WebGL canvas at the screen's real pixel density (the old
           1.5 cap upscaled every page on 2×/3× phones — the main source of the
           mobile blur). LeafThrough's own 15 MP budget still protects big screens. */
        /* never below 2: on a 1× laptop screen the pages are drawn at double size and
           the browser scales them down, which keeps small text crisp instead of soft */
        maxPixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
        preload: 2,
        /* crisp paper: matte, no grain speckle over the text, no ghosting from
           the reverse side on phones, and no surface wrinkles. The cream
           colour and the page-turn lighting still keep the paper look. */
        paper: {
          backColor: "#F5DABF",
          grain: false,
          showThrough: 0,
          inkGloss: 0,
          roughness: 1,
          metalness: 0,
          wrinkles: 0,
          bulge: 0.2
        },
        /* flatter, more even light on the open spread: the default sun is
           strong enough to print a brightness ramp across a page, which lowers
           text contrast. Warm ambient keeps the cream paper warm while the
           softer sun still shades the page turn. */
        lighting: {
          ambient: { intensity: 1.9, ground: "#cbbfa8" },
          sun: { intensity: 1.35 }
        },
        label: `${t("booklet.dialogAria") || "3D invitation booklet"} — ${coupleNamesNow()}`,
        motion: { reducedMotion: "auto" },
        onReady: () => {
          hideStatus();
          hint.textContent = hintText();
        },
        onPageChange: (d) => syncControls(d),
        onError: () => showPageLoadError()
      });
      state = "open";
      section.setAttribute("aria-busy", "false");
      btn.hidden = true;                 /* the booklet's own Close button takes over */
      stage.classList.add("is-open");    /* lets the pages sit straight on the band, not in a cream box */
      startCentering();
      /* inline (desktop/tablet) book: the stage grows above the button that was
         just pressed, so bring the whole spread into view instead of leaving
         its top edge above the viewport. */
      if (!overlayActive && !rebuilding && stage.scrollIntoView) {
        try {
          stage.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
        } catch { stage.scrollIntoView(); }
      }
      hideStatus();
      /* first paint of the controls (the pagechange event also refreshes these) */
      try {
        syncControls({ page: magazine.page || 0, visiblePages: magazine.visiblePages, pageCount: magazine.pageCount });
      } catch { /* the ready path fills it in */ }
      magazine.addEventListener("pagechange", (e) => syncControls(e.detail));
      magazine.addEventListener("error", showPageLoadError);
      document.addEventListener("keydown", onEsc);
      /* put keyboard attention on the magazine itself (the library binds keys while
         focused) — the guest can Tab straight to the control bar afterwards */
      try { magazine.element.focus({ preventScroll: true }); } catch { /* fine */ }
      /* the magazine's own element is focusable (the library sets tabindex), but
         guarantee the dialog contains focus; otherwise fall back to the dialog */
      if (overlayActive && !overlay.contains(document.activeElement)) overlay.focus({ preventScroll: true });
      /* the guest switched language while the pages were still being drawn */
      if (builtLang !== (I18N ? I18N.lang : "en")) setTimeout(rebuildBooklet, 0);
    } catch (err) {
      state = "idle";
      fatal(`${t("booklet.openError") || "The 3D booklet couldn't open on this device — the invitation below has every detail."} ${err && err.message ? "(" + err.message + ")" : ""}`);
    }
  }

  /* Rebuild the open book in the other language: same stage, same overlay,
     same page position semantics — the canvas pages are redrawn with the new
     labels instead of leaving a stale English/Kannada page on screen. */
  async function rebuildBooklet() {
    if (state !== "open" || !magazine) { paintBar(); return; }
    if (rebuilding) return;
    rebuilding = true;
    try {
      closeBtn.disabled = true;
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      stopCentering();
      document.removeEventListener("keydown", onEsc);
      try { magazine.dispose(); } catch { /* already gone */ }
      magazine = null;
      stage.replaceChildren();
      stage.classList.remove("is-open");
      state = "idle";
      await openBooklet();
    } finally {
      rebuilding = false;
      if (state === "open") closeBtn.disabled = false;
    }
  }

  /* A closed book is laid out like a spread: the cover sits on the right half and the left half stays
     empty (the same for a lone last page). The library keeps its "hit area" exactly over the page(s)
     showing, so the offset between that and the middle of the stage is how far to slide the book
     sideways to centre it. Runs whenever the hit area is re-placed or the stage is resized. */
  let centerObs = null, centerStarted = false;
  function centerBook() {
    if (!magazine) return;
    const el = magazine.element, hit = magazine.hitArea;
    if (!el || !hit) return;
    const left = parseFloat(hit.style.left), width = parseFloat(hit.style.width), full = el.clientWidth;
    if (!Number.isFinite(left) || !Number.isFinite(width) || !width || !full) return;
    const shift = Math.round(full / 2 - (left + width / 2));
    el.style.transform = shift ? `translateX(${shift}px)` : "";
    if (!centerStarted) {            /* first placement is instant; later moves glide */
      centerStarted = true;
      requestAnimationFrame(() => {
        if (el.isConnected && !reduceMotion) el.style.transition = "transform .6s cubic-bezier(.2,.7,.2,1)";
      });
    }
  }
  function startCentering() {
    stopCentering();
    centerStarted = false;
    centerBook();
    try {
      centerObs = new MutationObserver(centerBook);
      centerObs.observe(magazine.hitArea, { attributes: true, attributeFilter: ["style"] });
    } catch { centerObs = null; }
    window.addEventListener("resize", centerBook);
  }
  function stopCentering() {
    if (centerObs) { centerObs.disconnect(); centerObs = null; }
    window.removeEventListener("resize", centerBook);
  }

  function onEsc(e) { if (e.key === "Escape" && state === "open") closeBooklet(); }

  async function closeBooklet() {
    if (state !== "open") return;
    state = "closing";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    closeBtn.disabled = true;
    const book = magazine && magazine.element;
    const slide = book && book.style.transform ? book.style.transform + " " : "";
    stopCentering();
    if (book) book.style.transition = "none";
    let exitAnimation;
    if (book && book.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      exitAnimation = book.animate([
        { transform: slide + "perspective(1200px) rotateY(0deg) scale(1)", opacity: 1, transformOrigin: "15% 50%" },
        { transform: slide + "perspective(1200px) rotateY(-75deg) scale(.86)", opacity: 0, transformOrigin: "15% 50%" }
      ], { duration: 500, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
      try { await exitAnimation.finished; } catch { /* cancelled: still clean up */ }
    }
    if (magazine) {
      try { magazine.dispose(); } catch { /* already gone */ }
      magazine = null;
    }
    stage.replaceChildren();
    stage.classList.remove("is-open");
    if (exitAnimation) exitAnimation.cancel();
    closeBtn.disabled = false;
    deactivateOverlay();   /* moves the elements back + unlocks page scroll + restores saved Y */
    setOpen(false);
    hideStatus();
    state = "idle";
    section.setAttribute("aria-busy", "false");
    btn.disabled = false;
    btn.textContent = openLabel();
    btn.hidden = false;
    document.removeEventListener("keydown", onEsc);
    try { btn.focus({ preventScroll: true }); } catch { /* fine */ }
  }

  btn.addEventListener("click", openBooklet);
  closeBtn.addEventListener("click", closeBooklet);
  prevBtn.addEventListener("click", () => { if (state === "open" && magazine) magazine.prev(); });
  nextBtn.addEventListener("click", () => { if (state === "open" && magazine) magazine.next(); });
  langBtn.addEventListener("click", () => { if (I18N) I18N.toggle(); });

  /* language switch from anywhere (the booklet bar or the fixed page pill) */
  window.addEventListener("wedding:langchange", () => {
    paintBar();
    refreshSectionHead();
    btn.textContent = openLabel();
    if (state === "open") rebuildBooklet();
    else if (state === "idle") hint.textContent = hintText();
  });
  paintBar();

  /* clean page state if the module is ever torn down mid-session (defensive) */
  window.addEventListener("pagehide", () => {
    if (overlayActive) deactivateOverlay();
  });
})();
