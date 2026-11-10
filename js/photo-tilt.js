/* ============================================================================
   js/photo-tilt.js — a subtle scroll-driven 3D tilt for the couple photo.
   Progressive enhancement only: the semantic <img> stays in the DOM exactly as
   the base stylesheet renders it, and it is only visually hidden (still laid
   out, still accessible, still the no-JS / no-WebGL fallback) once the overlay
   canvas has proven — with one identical first frame — that it can take over.

   Design rules honoured here:
   - Zero new dependencies: three.js is dynamically imported from the existing
     import map (with the vendored file as a direct fallback), and only once the
     photo is actually at hand — never while the page is still gated, locked,
     booklet-covered, tab-hidden or the photo is offscreen.
   - Honours prefers-reduced-motion live (canvas removed, photo restored on a
     toggle in either direction), Data Saver, slow effective connection types
     and low-memory devices — in those cases the plain photo is untouched.
   - Renders only on change: scroll/resize wake a requestAnimationFrame loop
     that eases toward the scroll-derived pose for a finite settle time, then
     fully stops. Offscreen, hidden tab, booklet open or a locked body stop it.
   - Native scrolling — passive listeners only; the page moves exactly as much
     as the guest scrolls it and nothing announces that from underneath.
   - The overlay canvas is positioned over the displayed photo rectangle inside
     the frame (it never covers the frame's border or padding). The tilt is
     geometry-safe: per frame the module computes the largest plane scale whose
     worst projected excursion still fits the canvas, so the plane (and the
     photo it carries) is never clipped, and at rest the scale is exactly 1 —
     the swap from <img> to canvas is invisible.
   - Responsive variants are handled by observers on both .photo and the img:
     geometry, camera, DPR and the texture crop all follow the live displayed
     rectangle and the image's currentSrc natural size — nothing assumes
     particular pixel dimensions or the photo's DOM position.
   - Failures degrade immediately and silently: module load, WebGL setup,
     context loss, decode errors — all lead to the same restore of the static
     photo. A script error here can leave the site exactly as it was.
   ========================================================================== */
(() => {
  "use strict";
  if (window.__photoTilt) return; /* guard against double injection */

  const ATTR = "data-photo-3d";
  const CANVAS_CLASS = "photo-tilt-canvas";
  const CAMERA_FOV = 50;
  const MAX_OFFSET_PX = 8;                    /* hard ceiling for the offset pair */
  const ROT = { desktop: 3.3, mobile: 4.7 };  /* degrees — stays in the subtle 3–5 band */
  const ROT_TILT_SHARE = 0.5;                 /* screen-vertical share of that swing */
  const DRIFT = { dx: -6, dy: 2.5 };          /* px drift at full tilt (worst pair ≤ 6.5 px) */
  const EASE_MS = 120;                        /* exponential ease time constant */
  const EPS_ROT = 0.0008;                     /* radians */
  const EPS_PX = 0.05;
  const SCALE_FLOOR = 0.82;                   /* safety floor for the plane scale */

  const reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const controllers = [];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const deg2rad = (d) => (d * Math.PI) / 180;

  function setState(photo, value) {
    photo.setAttribute(ATTR, value);
  }

  /* the invitation must actually be on screen before anything is fetched */
  function invitationVisible() {
    const intro = document.getElementById("intro");
    return !intro || intro.classList.contains("leaving") || document.body.classList.contains("opened");
  }

  /* the site keeps the page from moving until the invitation is opened */
  function bodyScrollLocked() {
    return Boolean(document.getElementById("intro")) && !document.body.classList.contains("opened");
  }

  function bookletOpen() {
    const stage = document.getElementById("booklet-stage");
    return Boolean(stage && !stage.hidden);
  }

  function deviceAllowsEffect() {
    if (!("IntersectionObserver" in window) || !window.matchMedia || typeof ResizeObserver === "undefined") return false;
    const conn = navigator.connection;
    if (conn && (conn.saveData || /^(slow-)?2g$/i.test(conn.effectiveType || ""))) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    return true;
  }

  /* narrow viewports get a slightly larger swing so the tilt reads clearly on a
     small photo, yet every size stays inside the same restrained band */
  function tiltAmplitude() {
    const k = clamp((760 - window.innerWidth) / 400, 0, 1);
    return deg2rad(ROT.desktop + (ROT.mobile - ROT.desktop) * k);
  }

  function dprCap() {
    /* match the screen's real pixel density — the old 1.25 cap on phones
       upscaled the photo and was a visible source of mobile blur */
    return Math.min(3, window.devicePixelRatio || 1);
  }

  function setupPhoto(photo) {
    const img = photo.querySelector("img");
    if (!img) return null;
    setState(photo, "pending");

    let state = "pending";
    let built = false;
    let inView = false;
    let roHandle = 0;
    let tickHandle = 0, lastT = 0;
    let Three = null;        /* the dynamically imported module, once loaded */
    let threePromise = null;
    let canvas = null, renderer = null, scene = null, camera = null, mesh = null;
    let material = null, geometry = null, texture = null, photoSource = null, fullPhoto = null;
    let frame = { w: 1, h: 1, left: 0, top: 0 };  /* overlay rectangle inside .photo */
    let fit = { w: 1, h: 1 };                     /* photo plane size, world = css px */
    let camDist = 1;
    let cur = { rx: 0, ry: 0, dx: 0, dy: 0 };

    /* single place where phase + attribute move together (the attribute is the
       public debug hook, the variable is what the logic reads) */
    const finish = (v) => { state = v; setState(photo, v); };

    /* ------------ measurements (adapt to any size, any variant) ------------ */

    function displayedObjectFit() {
      try { return getComputedStyle(img).objectFit === "cover" ? "cover" : "contain"; }
      catch { return "contain"; }
    }

    function measure() {
      const pRect = photo.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      if (iRect.width < 2 || iRect.height < 2 || pRect.width < 2) return false;
      frame.w = iRect.width;
      frame.h = iRect.height;
      /* absolute positioning anchors to .photo's padding box, the img rect to its
         border box — exclude the frame border so the overlay is px-exact */
      let pb = { left: 0, top: 0 };
      try {
        const cs = getComputedStyle(photo);
        pb.left = parseFloat(cs.borderLeftWidth) || 0;
        pb.top = parseFloat(cs.borderTopWidth) || 0;
      } catch { /* keep 0 */ }
      frame.left = iRect.left - pRect.left - pb.left;
      frame.top = iRect.top - pRect.top - pb.top;
      /* natural/currentSrc dimensions, whatever variant the browser chose */
      const hasNatural = img.naturalWidth > 0 && img.naturalHeight > 0;
      const ta = hasNatural ? img.naturalWidth / img.naturalHeight : frame.w / frame.h;
      if (displayedObjectFit() === "cover") {
        fit.w = frame.w; fit.h = frame.h;
      } else {
        const ra = frame.w / frame.h;
        if (ta > ra) { fit.w = frame.w; fit.h = frame.w / ta; }
        else { fit.h = frame.h; fit.w = frame.h * ta; }
      }
      camDist = (frame.h / 2) / Math.tan(deg2rad(CAMERA_FOV / 2));
      return true;
    }

    /* replicate the displayed crop (object-fit: cover themes only) by baking the
       same centred sub-rectangle into the plane's UVs */
    function coverCrop() {
      const ta = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      const ra = fit.w / fit.h;
      if (ta > ra) {
        const repX = ra / ta;
        return { repX, repY: 1, offX: (1 - repX) / 2, offY: 0 };
      }
      const repY = ta / ra;
      return { repX: 1, repY, offX: 0, offY: (1 - repY) / 2 };
    }

    /* ------------------------------ pose math ------------------------------ */

    function planeScaleFor(t) {
      const ghx = fit.w / 2, ghy = fit.h / 2;
      const availX = Math.max(1, frame.w / 2 - Math.abs(t.dx));
      const availY = Math.max(1, frame.h / 2 - Math.abs(t.dy));
      const cx = Math.cos(t.rx), sx = Math.sin(t.rx);
      const cy = Math.cos(t.ry), sy = Math.sin(t.ry);
      const samples = [
        [ghx, ghy], [ghx, -ghy], [-ghx, ghy], [-ghx, -ghy],
        [ghx, 0], [-ghx, 0], [0, ghy], [0, -ghy]
      ];
      let worstX = 0, worstY = 0;
      for (let i = 0; i < samples.length; i++) {
        const px = samples[i][0], py = samples[i][1];
        const z1 = -px * sy;            /* after the screen-horizontal swing */
        const y2 = py * cx - z1 * sx;   /* then the screen-vertical swing */
        const z2 = py * sx + z1 * cy;
        const persp = camDist / (camDist - z2);
        const ex = Math.abs(px * persp) / availX;
        const ey = Math.abs(y2 * persp) / availY;
        if (ex > worstX) worstX = ex;
        if (ey > worstY) worstY = ey;
      }
      const needX = worstX > 0 ? 1 / worstX : 1;
      const needY = worstY > 0 ? 1 / worstY : 1;
      return clamp(Math.min(needX, needY), SCALE_FLOOR, 1);
    }

    /* photo progress through the viewport: −1 entering from below, 0 centred, 1 leaving above */
    function computeTarget() {
      const r = img.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const centre = r.top + r.height / 2;
      const p = clamp((2 * (centre - vh / 2)) / Math.max(1, vh + r.height), -1, 1);
      const amp = tiltAmplitude();
      return {
        rx: -p * amp * ROT_TILT_SHARE,
        ry: p * amp,
        dx: clamp(p * DRIFT.dx, -6, 6),
        dy: clamp(p * DRIFT.dy, -2.5, 2.5)
      };
    }

    function render() {
      mesh.rotation.x = cur.rx;
      mesh.rotation.y = cur.ry;
      mesh.position.set(cur.dx, cur.dy, 0);
      mesh.scale.setScalar(planeScaleFor(cur));
      renderer.render(scene, camera);
    }

    /* ---------------------------- build / teardown ------------------------- */

    function rebuildGeometry() {
      const next = new Three.PlaneGeometry(fit.w, fit.h);
      if (displayedObjectFit() === "cover") {
        const crop = coverCrop();
        const uv = next.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, crop.offX + uv.getX(i) * crop.repX, crop.offY + uv.getY(i) * crop.repY);
        }
      }
      if (geometry) geometry.dispose();
      geometry = next;
      if (mesh) mesh.geometry = geometry;
    }

    function applyCanvasLayout() {
      canvas.style.left = frame.left.toFixed(2) + "px";
      canvas.style.top = frame.top.toFixed(2) + "px";
      canvas.style.width = frame.w.toFixed(2) + "px";
      canvas.style.height = frame.h.toFixed(2) + "px";
      renderer.setPixelRatio(Math.min(dprCap(), window.devicePixelRatio || 1));
      renderer.setSize(frame.w, frame.h, false);
      camera.aspect = frame.w / frame.h;
      camera.updateProjectionMatrix();
    }

    function activate(threeModule) {
      Three = threeModule;
      if (!measure()) throw new Error("photo rectangle not measurable");
      canvas = document.createElement("canvas");
      canvas.className = CANVAS_CLASS;
      canvas.setAttribute("aria-hidden", "true");
      photo.appendChild(canvas);
      renderer = new Three.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: dprCap() > 1.26,  /* phones skip it — low power over smoothing */
        depth: false,
        stencil: false,
        powerPreference: "low-power"
      });
      renderer.setClearColor(0x000000, 0);
      scene = new Three.Scene();
      camera = new Three.PerspectiveCamera(CAMERA_FOV, frame.w / frame.h, 1, camDist + 200);
      camera.position.z = camDist;
      /* The img element can carry layout width/height attributes that disagree
         with the current variant's natural size (responsive variants swap the
         src), which breaks WebGL's upload of the element itself. Uploading a
         neutral offscreen copy of the decoded bitmap sidesteps that entirely. */
      photoSource = document.createElement("canvas");
      refreshPhotoSource();
      texture = new Three.Texture(photoSource); /* verbatim currentSrc bitmap */
      texture.colorSpace = Three.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      material = new Three.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
      mesh = new Three.Mesh(new Three.PlaneGeometry(fit.w, fit.h), material);
      scene.add(mesh);
      rebuildGeometry();
      applyCanvasLayout();
      built = true;
      attachListeners();
      cur = { rx: 0, ry: 0, dx: 0, dy: 0 };
      render();                  /* first frame: flat, scale 1 — same as the img */
      finish("ready");           /* CSS may now let the img step aside visually */
      requestTick();
    }

    function detach() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      img.removeEventListener("load", onImgLoad);
      if (canvas) canvas.removeEventListener("webglcontextlost", onContextLost);
      if (canvas && canvas.parentNode) canvas.remove();
      if (renderer) { try { renderer.dispose(); } catch { /* context already gone */ } }
      if (geometry) geometry.dispose();
      if (material) material.dispose();
      if (texture) texture.dispose();
      canvas = null; renderer = null; scene = null; camera = null;
      mesh = null; material = null; geometry = null; texture = null; photoSource = null;
      fullPhoto = null;
    }

    function destroy() {
      cancelAnimationFrame(tickHandle);
      tickHandle = 0; lastT = 0;
      detach();
      built = false;
      /* the CSS hook only hides the img while data-photo-3d="ready", so giving
         the attribute another value brings the plain photo straight back */
      if (state === "ready") finish("fallback");
    }

    /* Copy the decoded photo into a neutral offscreen canvas for the GPU upload.
       Important: when the <img> uses srcset with width descriptors, its
       naturalWidth is density-corrected (e.g. 335 CSS px for a 1600 px file), so
       drawing the element would bake a tiny blurry bitmap. Loading currentSrc as
       a plain Image (no srcset) exposes the real pixels; until that arrives, the
       element's own bitmap keeps the first frame filled. */
    function drawPhotoSource(src) {
      const w = src && src.naturalWidth ? src.naturalWidth : 0;
      const h = src && src.naturalHeight ? src.naturalHeight : 0;
      if (!(w > 0 && h > 0)) return false;
      try {
        photoSource.width = w;
        photoSource.height = h;
        photoSource.getContext("2d").drawImage(src, 0, 0, w, h);
        return true;
      } catch {
        photoSource = img; /* direct element upload still works when sizes agree */
        return false;
      }
    }

    function refreshPhotoSource() {
      if (!photoSource || photoSource === img) return; /* already on element mode */
      const url = img.currentSrc || img.src;
      if (fullPhoto && fullPhoto.src === url) {
        if (fullPhoto.complete && fullPhoto.naturalWidth > 0) drawPhotoSource(fullPhoto);
        else drawPhotoSource(img);       /* still loading: keep the frame filled */
        return;
      }
      drawPhotoSource(img);                 /* immediate, may be density-corrected */
      if (!url) return;
      fullPhoto = new Image();
      fullPhoto.decoding = "async";
      fullPhoto.onload = () => {
        if (!built || fullPhoto.src !== url) return;
        if (drawPhotoSource(fullPhoto) && texture) {
          texture.needsUpdate = true;
          layoutChanged();
        }
      };
      fullPhoto.src = url;
    }

    /* ------------------------------ behaviour ------------------------------ */

    function attachListeners() {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      img.addEventListener("load", onImgLoad);
      canvas.addEventListener("webglcontextlost", onContextLost);
    }

    function onScroll() { requestTick(); }
    function onResize() { layoutChanged(); }
    function onVisibility() { if (!document.hidden) requestTick(); }

    function onImgLoad() {
      /* a responsive variant was picked: same element, new currentSrc */
      if (!built) return;
      refreshPhotoSource();
      if (texture) texture.needsUpdate = true;
      layoutChanged();
    }

    function onReduceChange() {
      if (reduceMQ.matches) {
        if (built) destroy();
        finish("reduced");
      } else if (state === "reduced") {
        finish("pending");
        maybeStart();
      }
    }

    function onContextLost(e) {
      try { e.preventDefault(); } catch { /* nothing to undo */ }
      destroy();
      finish("fallback");
    }

    /* size changes from the frame, the variant swap or a viewport rotation */
    function layoutChanged() {
      if (!built) return;
      try {
        if (!measure()) {
          destroy();
          finish("sleep");
          return;
        }
        applyCanvasLayout();
        rebuildGeometry();
        requestTick();
      } catch {
        destroy();
        finish("fallback");
      }
    }

    /* -------- dynamic import: never before the photo is actually at hand -------- */

    function getThree() {
      if (!threePromise) {
        threePromise = import("three")
          .catch(() => import("../vendor/three/build/three.module.js"))
          .catch(() => null);
      }
      return threePromise;
    }

    function imgReady() {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
      return new Promise((resolve) => {
        const done = (ok) => {
          img.removeEventListener("load", onLoaded);
          img.removeEventListener("error", onFailed);
          resolve(ok);
        };
        const onLoaded = () => done(img.naturalWidth > 0);
        const onFailed = () => done(false);
        img.addEventListener("load", onLoaded);
        img.addEventListener("error", onFailed);
      });
    }

    function maybeStart() {
      if (state !== "pending" || !inView) return;
      if (bodyScrollLocked() || !invitationVisible()) return;
      start();
    }

    function restart() {
      finish("pending");
      maybeStart();
    }

    async function start() {
      if (state !== "pending") return;
      if (!deviceAllowsEffect()) { finish("unsupported"); return; }
      if (reduceMQ && reduceMQ.matches) { finish("reduced"); return; }
      finish("loading");
      const loaded = await imgReady();
      if (state !== "loading") return;
      if (!loaded) { finish("error"); return; }  /* no blank screen: plain photo stays */
      const threeModule = await getThree();
      if (state !== "loading") return;
      if (!threeModule) { finish("fallback"); return; }
      try {
        activate(threeModule);
      } catch (err) {
        window.__photoTiltErr = String(err && err.stack || err);
        destroy();
        finish("fallback");
      }
    }

    /* --------------- scheduling: only on change, finite settling --------------- */

    function tick(ts) {
      tickHandle = 0;
      if (!built) return;
      if (document.hidden || !inView || bookletOpen() || bodyScrollLocked()) { lastT = 0; return; }
      const dt = lastT ? clamp(ts - lastT, 4, 80) : 16;
      lastT = ts;
      const tgt = computeTarget();
      const k = 1 - Math.exp(-dt / EASE_MS);
      cur.rx += (tgt.rx - cur.rx) * k;
      cur.ry += (tgt.ry - cur.ry) * k;
      cur.dx += (tgt.dx - cur.dx) * k;
      cur.dy += (tgt.dy - cur.dy) * k;
      render();
      const settled =
        Math.abs(tgt.rx - cur.rx) < EPS_ROT &&
        Math.abs(tgt.ry - cur.ry) < EPS_ROT &&
        Math.abs(tgt.dx - cur.dx) < EPS_PX &&
        Math.abs(tgt.dy - cur.dy) < EPS_PX;
      if (settled) { lastT = 0; return; }   /* fully at rest → stop drawing */
      tickHandle = requestAnimationFrame(tick);
    }

    function requestTick() {
      if (!built || tickHandle || document.hidden || !inView || bookletOpen() || bodyScrollLocked()) return;
      tickHandle = requestAnimationFrame(tick);
    }

    /* page-lifetime: live reduced-motion switch — works even while the effect
       never activated, so a toggle-off starts it and a toggle-on stops it */
    if (reduceMQ) {
      if (typeof reduceMQ.addEventListener === "function") reduceMQ.addEventListener("change", onReduceChange);
      else if (typeof reduceMQ.addListener === "function") reduceMQ.addListener(onReduceChange);
    }

    /* ---------------- page-lifetime observers (single, no teardown) ------------- */

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (entry.isIntersecting) maybeStart();
      }
      if (inView) {
        requestTick();
      } else if (tickHandle) {
        cancelAnimationFrame(tickHandle);
        tickHandle = 0; lastT = 0;
      }
    }, { rootMargin: "20% 0px 20% 0px" });
    io.observe(photo);

    /* the invitation gate can flip long after the observer last fired */
    const mo = new MutationObserver(() => {
      maybeStart();
      requestTick();
    });
    if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ["class", "hidden"] });

    /* follows both the frame box and the photo bitmap across variant changes */
    const watchResize = (target) => {
      new ResizeObserver(() => {
        if (roHandle) return;
        roHandle = requestAnimationFrame(() => {
          roHandle = 0;
          try {
            if (built) { layoutChanged(); return; }
            if (state === "sleep" && inView) restart();
          } catch { /* stay on the plain photo */ }
        });
      }).observe(target);
    };
    watchResize(photo);
    watchResize(img);

    return {
      /* debug/testing hook: force one synchronous render (e.g. for pixel readback) */
      renderOnce() { if (built) { try { render(); } catch { /* fallback handles it */ } } },
      describe() {
        return {
          state,
          built,
          inView,
          canvas: canvas ? {
            width: frame.w, height: frame.h,
            left: frame.left, top: frame.top,
            pixelRatio: renderer ? renderer.getPixelRatio() : 0,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            currentSrc: img.currentSrc || img.src
          } : null,
          fit: { ...fit },
          source: fullPhoto && fullPhoto.naturalWidth ? {
            width: fullPhoto.naturalWidth, height: fullPhoto.naturalHeight
          } : null,
          devicePixelCap: dprCap(),
          intensity: tiltAmplitude(),
          pose: { ...cur },
          maxOffsetPx: MAX_OFFSET_PX
        };
      }
    };
  }

  function boot() {
    document.querySelectorAll(".photo").forEach((photo) => {
      const controller = setupPhoto(photo);
      if (controller) controllers.push(controller);
    });
    window.__photoTilt = {
      version: "1.0.0",
      /* debug hooks, e.g. __photoTilt.photos()[0].state / .pose / .canvas */
      photos: () => controllers.map((c) => c.describe()),
      /* force one synchronous render, e.g. for pixel readback in tests */
      render: (i = 0) => { const c = controllers[i]; if (c && c.renderOnce) c.renderOnce(); }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
