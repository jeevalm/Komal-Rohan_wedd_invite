/* ============================================================
   js/typography.js — scroll typography for the default design.

   Native, dependency-free adaptations of two effects from Codrops
   "Some More on Scroll Typography Animations" (Feb 2023)
   https://tympanus.net/codrops/2023/02/22/some-more-on-scroll-typography-animations/
   and its MIT-licensed source repo
   https://github.com/codrops/OnScrollTypographyAnimations
   (effect 16: scroll-linked per-word reveal; effects 19/20: one-shot
   per-character rotateX fold). No GSAP, no smooth-scroll library,
   no scroll hijack, no pinning — mobile-safe.

   Behaviour rules kept here:
   - Progressive enhancement: nothing is hidden until this module
     splits an element; if it fails to load or to run, every heading
     and paragraph stays fully visible, plain text.
   - Screen readers: split glyphs are aria-hidden decorative spans;
     the original string is preserved via aria-label on the element.
   - prefers-reduced-motion: this module exits immediately — nothing
     is split, nothing hides, no listeners are added.
   - rAF discipline: the scroll-linked word reveal recomputes inside
     a single requestAnimationFrame callback that is only scheduled
     from scroll/resize events (plus one update after init). No
     continuous loop, no timers.
   - One-shot fold: IntersectionObserver adds the "play" class once
     per heading and then unobserves.
   - Late-inserted content (the optional booklet section builds
     itself after app.js) is picked up by a MutationObserver; the
     data-tgx marker keeps settled elements from being re-split.
   ============================================================ */
(function () {
  "use strict";

  /* Reduced motion: leave every heading and paragraph untouched. */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!document.body) return;

  /* Kannada is split into words, never into glyphs: separating a matra or a
     conjunct (ಕ್ಷ, ಳ, ರ್…) into its own inline-block span breaks its shaping. */
  const isKn = () => document.documentElement.lang === "kn";

  const foldSelector =
    ".names .n1, .names .n2, .names .amp, .sec-head h2, .card h3, .count h2, footer .sig";
  const wordsSelector = ".eyebrow";

  /* ---------- effect 1: one-shot character fold (Codrops 19/20) ---------- */

  const foldIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("tgx-play");
        foldIO.unobserve(en.target);
      }
    });
  }, { threshold: 0.2 });

  /* Replace an element's children with a visually-hidden-when-folded
     wrapper of per-character spans (alternating rotateX direction). */
  function foldSplit(el, text, margin) {
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    const frag = document.createDocumentFragment();
    const kn = isKn();
    let i = 0;
    for (const part of text.split(/(\s+)/)) {
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(" "));
        continue;
      }
      const word = document.createElement("span");
      word.className = "tgx-fold-word";
      if (kn) {
        /* one span per word: the whole cluster stays intact */
        const s = document.createElement("span");
        s.className = "tgx-ch" + (i % 2 ? " tgx-dn" : "");
        s.textContent = part;
        s.style.setProperty("--d", (i * 26 + margin) + "ms");
        word.appendChild(s);
        i++;
      } else {
        for (const ch of part) {
          const s = document.createElement("span");
          s.className = "tgx-ch" + (i % 2 ? " tgx-dn" : "");
          s.textContent = ch;
          s.style.setProperty("--d", (i * 26 + margin) + "ms");
          word.appendChild(s);
          i++;
        }
      }
      frag.appendChild(word);
    }
    wrap.appendChild(frag);
    el.replaceChildren(wrap);
  }

  function initFold(el) {
    if (el.dataset.tgx || el.closest("#intro")) return;
    const text = el.textContent;
    if (!text.trim()) return;
    el.dataset.tgx = "fold";
    el.setAttribute("aria-label", text.replace(/\s+/g, " ").trim());
    foldSplit(el, text, 0);
    foldIO.observe(el);
  }

  /* The hero names are three word spans inside one h1; fold each word,
     then give the h1 an explicit accessible name so it stays announced
     normally (and keeps its existing focus behaviour untouched). */
  function foldNames(names) {
    const parts = [];
    names.querySelectorAll(".n1, .n2, .amp").forEach((el) => {
      if (!el.dataset.tgx && el.textContent.trim()) {
        initFold(el);
        parts.push(el.getAttribute("aria-label"));
      } else if (el.dataset.tgx) {
        parts.push(el.getAttribute("aria-label"));
      }
    });
    if (parts.length) names.setAttribute("aria-label", parts.join(" "));
    /* the per-span slideUp no longer applies once the fold owns it */
  }

  /* ---------- effect 2: scroll-linked word reveal (Codrops 16) ---------- */

  const wordRecs = [];
  let wordScheduled = false;

  function initWords(el) {
    if (el.dataset.tgx || el.closest("#intro")) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    /* re-initialising an element in another language: drop its stale record
       (the old spans are detached by el.replaceChildren below) */
    const stale = wordRecs.findIndex((r) => r.el === el);
    if (stale > -1) wordRecs.splice(stale, 1);
    el.dataset.tgx = "words";
    el.setAttribute("aria-label", text);
    const words = text.split(" ");
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    const spans = [];
    words.forEach((w, i) => {
      const s = document.createElement("span");
      s.className = "tgx-w";
      s.textContent = w;
      wrap.appendChild(s);
      if (i < words.length - 1) wrap.appendChild(document.createTextNode(" "));
      spans.push(s);
    });
    el.replaceChildren(wrap);
    wordRecs.push({ el: el, spans: spans });
  }

  function updateWords() {
    wordScheduled = false;
    if (!wordRecs.length) return;
    const vh = window.innerHeight || 1;
    const startLine = vh * 0.9;   /* reveal begins when the block is 90% down the viewport */
    const endLine = vh * 0.32;    /* and finishes once it rides up to a third of it */
    for (const rec of wordRecs) {
      const rect = rec.el.getBoundingClientRect();
      if (rect.bottom < -40 || rect.top > vh + 40) continue;
      let p = (startLine - rect.top) / Math.max(1, startLine - endLine);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      const n = rec.spans.length;
      for (let i = 0; i < n; i++) {
        let wp = p * (n + 1) - i;
        wp = wp < 0.12 ? 0.12 : wp > 1 ? 1 : wp;
        rec.spans[i].style.setProperty("--wp", wp.toFixed(3));
      }
    }
  }

  function scheduleWords() {
    if (wordScheduled) return;
    wordScheduled = true;
    requestAnimationFrame(updateWords);
  }

  /* ---------- init ---------- */

  function init(root) {
    if (!root.querySelectorAll) return;

    root.querySelectorAll(".names").forEach(foldNames);
    root.querySelectorAll(foldSelector).forEach((el) => {
      if (!el.dataset.tgx) {
        initFold(el);
      }
    });
    root.querySelectorAll(wordsSelector).forEach(initWords);
    scheduleWords();
  }

  init(document.body);

  /* js/app.js calls this after it swaps a label into the reader's language,
     so the new string keeps the same scroll animation. */
  window.__tgxInitNode = function (el) {
    if (!el || !el.matches || el.closest("#intro")) return;
    if (el.matches(".names .n1, .names .n2, .names .amp")) {
      if (!el.dataset.tgx) initFold(el);
      const names = el.closest(".names");
      if (names) foldNames(names);
    } else if (el.matches(wordsSelector)) {
      initWords(el);
    } else if (el.matches(foldSelector)) {
      if (!el.dataset.tgx) initFold(el);
    }
    scheduleWords();
  };

  /* Late-inserted sections (the optional booklet) get the same treatment. */
  if ("MutationObserver" in window) {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if ((node.matches && node.matches(foldSelector + "," + wordsSelector)) ||
                node.querySelector(foldSelector + "," + wordsSelector)) {
              init(node);
            }
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("scroll", scheduleWords, { passive: true });
  window.addEventListener("resize", scheduleWords, { passive: true });
  updateWords();
})();
