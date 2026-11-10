/* ==========================================================================
   js/i18n.js — English / ಕನ್ನಡ layer for the invitation.

   - English text comes from the top-level fields of config.js (nothing changes
     for a config that ignores this file). Kannada comes from the config's `kn`
     block; every missing Kannada key quietly falls back to English, so the site
     can never render an empty label.
   - Dates and times are re-formatted with `kn-IN` / `en-IN`, so weekday and
     month names change with the language.
   - `window.WEDDING_I18N.t("booklet.title")` reads a nested key, with optional
     `{placeholders}`. `lang` is live.
   - Switching language persists in localStorage ("wedding-lang-v2"), supports
     `?lang=kn` links, sets <html lang> (browser font shaping + screen readers)
     and fires a `wedding:langchange` event that app.js / booklet.js listen to.
   ========================================================================== */
(() => {
  "use strict";

  const C = (typeof window !== "undefined" && window.WEDDING) || {};
  const str = (v) => (typeof v === "string" ? v : "");
  const trim = (v) => str(v).trim();

  const LANGS = ["en", "kn"];
  const STORE_KEY = "wedding-lang-v2";
  const KN = C.kn && typeof C.kn === "object" ? C.kn : {};
  const TZ = trim(C.timeZone) || "Asia/Kolkata";

  /* ---------- nested lookup ---------- */
  const at = (obj, path) => path.split(".").reduce(
    (o, k) => (o == null ? undefined : o[k]), obj
  );

  /* ---------- English UI defaults (not part of config.js) ---------- */
  const UI_EN = {
    pageTitle: "Wedding Invitation",
    countdown: "Countdown",
    days: "days", hours: "hours", mins: "mins", secs: "secs",
    today: "Today is the day",
    timeRemaining: "Time remaining",
    schedule: "Schedule",
    celebrations: "The celebrations",
    directions: "Directions",
    scroll: "Scroll",
    scrollAria: "Scroll to see the rest of the invitation",
    playMusic: "Play music",
    pauseMusic: "Pause music",
    langSwitch: "ಕನ್ನಡ",
    langAria: "Switch to Kannada"
  };

  const BOOKLET_EN = {
    kicker: "Leaf through",
    title: "A little book of us",
    open: "Open 3D invitation",
    preparing: "Preparing the booklet…",
    preparingPages: "Preparing pages…",
    prev: "← Prev", next: "Next →", close: "Close",
    moments: "Moments",
    momentTitles: ["A little of us", "More of us", "Little moments", "Everyday us", "Just the two of us"],
    hint3d: "Drag or tap a page to turn it · the arrow keys work too",
    hintPlain: "Tap the right side of the booklet to turn pages · the arrow keys work too",
    retry: "Try again",
    pageLoadError: "One or more pages of the booklet couldn't load — they may come back if the signal steadies. ",
    openError: "The 3D booklet couldn't open on this device — the invitation below has every detail.",
    pageOf: "Page {n} of {total}",
    pagesOf: "Pages {first}–{last} of {total}",
    prevAria: "Previous page",
    nextAria: "Next page",
    closeAria: "Close the 3D booklet",
    dialogAria: "3D invitation booklet",
    langAria: "Switch to Kannada"
  };

  /* ---------- per-language dictionaries ---------- */
  const en = {
    groom: trim(C.groom) || "Groom",
    bride: trim(C.bride) || "Bride",
    intro: {
      top: trim(C.intro && C.intro.top) || "You're invited",
      tap: trim(C.intro && C.intro.tap) || "Open invitation",
      bottom: trim(C.intro && C.intro.bottom)
    },
    tagline: trim(C.tagline),
    invitationLine: trim(C.invitationLine) || "The wedding of",
    heroPlace: trim(C.heroPlace),
    countdownTitle: trim(C.countdownTitle) || "Counting down",
    events: (Array.isArray(C.events) ? C.events : []).map((e) => ({
      badge: trim(e && e.badge),
      name: trim(e && e.name),
      venue: trim(e && e.venue),
      city: trim(e && e.city)
    })),
    contacts: (Array.isArray(C.contacts) ? C.contacts : []).map((c) => ({
      label: trim(c && c.label)
    })),
    footer: trim(C.footer),
    ui: UI_EN,
    booklet: BOOKLET_EN
  };

  /* Kannada is kept raw: t() falls back field by field, so a half-filled
     `kn` block still renders a complete, readable invitation. */
  const kn = KN;

  const dict = { en, kn };

  /* ---------- current language ---------- */
  let stored = "";
  try { stored = localStorage.getItem(STORE_KEY) || ""; } catch { /* private mode */ }
  const query = new URLSearchParams(location.search).get("lang");
  const configured = trim(C.language).toLowerCase();
  let lang = LANGS.includes(query) ? query
    : LANGS.includes(stored) ? stored
      : LANGS.includes(configured) ? configured : "en";

  /* ---------- translation ---------- */
  function t(path, vars) {
    let v = at(dict[lang], path);
    if (v === undefined || v === null || v === "") v = at(dict.en, path);
    if (v === undefined || v === null) return "";
    if (typeof v !== "string") return v;
    if (vars) {
      v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    }
    return v;
  }

  const locale = () => (lang === "kn" ? "kn-IN" : "en-IN");
  const date = (iso, opts) => {
    try { return new Date(iso).toLocaleDateString(locale(), { timeZone: TZ, ...(opts || {}) }); }
    catch { return ""; }
  };
  const time = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString(locale(), {
        timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true
      });
    } catch { return ""; }
  };

  /* ---------- switching ---------- */
  function applyDocumentLang() {
    document.documentElement.lang = lang;
    if (document.body) document.body.classList.toggle("lang-kn", lang === "kn");
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORE_KEY, lang); } catch { /* private mode */ }
    applyDocumentLang();
    window.dispatchEvent(new CustomEvent("wedding:langchange", { detail: { lang } }));
  }

  const toggle = () => set(lang === "en" ? "kn" : "en");
  const other = () => (lang === "en" ? "kn" : "en");

  applyDocumentLang();

  window.WEDDING_I18N = {
    get lang() { return lang; },
    get other() { return other(); },
    languages: LANGS.slice(),
    t, date, time, set, toggle
  };
})();
