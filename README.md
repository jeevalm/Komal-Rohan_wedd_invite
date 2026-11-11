# Wedding Invitation — Rohan & Komal

One folder of plain HTML/CSS/JS. No frameworks, no dependencies, no build. All content
lives in a single config file; the design reads it and renders everything.

- **Couple:** Rohan & Komal
- **Families:** Mahendrakar (bride) & Ummannanavar (groom) — the invitation line names both
- **Design (default theme):** cream / bordeaux / deep-green palette with alternating full-bleed
  sections, bold tightly-tracked uppercase headings in **Bricolage Grotesque (500/600/700)** and
  **Manrope** body text; only the weights actually used are loaded.
- **Compact single-screen hero (desktop):** on wide screens the hero is a two-column
  arrangement (photo left, names + labels right) so photo, names, date and venue all fit
  inside the first screen (1440×900 down to 1366×768). On phones it collapses to a compact
  stacked layout — landscape photo on top, the names on one line (`ROHAN & KOMAL`) with
  tightened, readable labels — and may simply grow on very small or zoomed viewports
  (nothing is ever clipped or hidden). The old "View schedule" shortcut is gone: the guest
  scrolls on to the countdown, the 3D booklet and then the schedule.
- **Scroll typography:** `js/typography.js` + `css/typography.css` implement two native,
  dependency-free effects — a one-shot per-character `rotateX` fold for headings and a
  scroll-linked per-word opacity reveal for invitation copy. Inspired by Codrops
  "Some More on Scroll Typography Animations"
  ([article](https://tympanus.net/codrops/2023/02/22/some-more-on-scroll-typography-animations/))
  and adapted from the MIT-licensed source repo
  [codrops/OnScrollTypographyAnimations](https://github.com/codrops/OnScrollTypographyAnimations)
  (no copied assets, no GSAP, no smooth-scroll library, no scroll hijacking; split glyphs are
  `aria-hidden` and the original text is preserved via `aria-label`; `prefers-reduced-motion`
  disables everything and keeps all text fully visible).
- **Dates:** Engagement — 3 December 2026, 7:00 pm · Marriage — 4 December 2026, 10:30 am · Reception — 4 December 2026, 7:30 pm (all `Asia/Kolkata`)
- **Venue (all events):** Jagajyothi Cultural Centre, Masuru, Karnataka 581210
- **Directions:** <https://maps.app.goo.gl/uBuS3KwDwVHrGcgN7>
- **Photo:** `couplePhoto.webp` at the project root (1080×1350 portrait, shown uncropped in
  the hero). Edit `couplePhoto` in `config.js` to use a different image.
- **Extra booklet photos:** `bookletPhoto-1.jpeg` … `bookletPhoto-5.jpeg` are the five
  images shown as "Moments" pages inside the 3D booklet (one page each); edit, reorder or
  remove entries in the `bookletPhotos` array in `config.js` to change them.

## 1. Run it locally

From this folder, serve it (opening `index.html` directly from disk will work for viewing,
but a local server is better for testing):

```bash
 python -m http.server 8001 --bind 127.0.0.1
# then open http://127.0.0.1:8001/
```


## 
## 2. Make it yours — edit `config.js` only

Names, tagline, lines, photo, music, countdown target, events, contacts, and footer —
all in **`config.js`**. Everything else is automatic.

### Contact numbers

`contacts[]` in `config.js` already holds the family numbers; update them there if they change.

## 2b. English / ಕನ್ನಡ

The invitation ships in two languages with one button.

- `language: "en"` in `config.js` sets the language a first-time guest sees (`"kn"` for Kannada).
- A single `EN` / `ಕನ್ನಡ` pill sits at the top-right of every screen; the booklet's control
  bar carries the same switch while the book is open (on phones the pill is in the booklet's
  top-right corner, so the bar stays on one row).
- The choice is remembered in `localStorage` (`wedding-lang`); `index.html?lang=kn` opens
  straight into Kannada and is handy for sharing.
- **English text stays in the top-level fields** of `config.js` (`groom`, `tagline`,
  `intro`, `events[]`, `contacts[]`, `footer`…). **Kannada text lives in the `kn:` block at
  the bottom of the same file** — names, intro, tagline, invitation line, hero place,
  countdown title, `events[]` (badge/name/venue/city), `contacts[]` labels, footer, UI labels
  (`ui.*`) and booklet labels (`booklet.*`, including `momentTitles`).
- Anything left out of the `kn` block falls back to the English field, so a half-translated
  config can never render an empty label.
- Dates and times are re-formatted with `kn-IN` / `en-IN`, so weekday and month names change
  with the language. The Kannada copy is a first draft intended for you to refine — edit it
  directly in `config.js`; no code changes are needed.
- While the booklet is open, switching language redraws its pages in the new language.
  Kannada canvas text is drawn as whole strings (never letter-spaced or split
  character-by-character), which keeps its conjuncts and matras intact.

## 3. Themes

Set `theme` in `config.js`, or preview without editing via a URL query:

- `heritage` (default) — cream paper with alternating bordeaux/deep-green bands, bordeaux
  & deep-green typography, tightly-tracked bold uppercase sans headings + sans body.
  A calm default: fewer web fonts, no ambient particle canvas, quick dismissible intro.
- `index.html?theme=western` — saloon-door intro, terracotta
- `index.html?theme=editorial` — black & white magazine cover
- `index.html?theme=boho` — sage + blush, wax seal

Any unknown theme string (config or query) falls back to `heritage`.

## 4. Behaviour notes

- **Intro** is dismissible: click/tap anywhere, use its button, or press `Escape`. No
  multi-second forced gate; keyboard focus moves to the names heading after opening.
- **Countdown** runs in `Asia/Kolkata` and counts down to the marriage
  (4 December 2026, 10:30 am). It shows a "Today is the day" message once passed.
- **Hero photo** is rendered with its intrinsic `width`/`height` (1600×1068, ~400:267),
  so it displays at the correct landscape ratio without cropping; it scales
  responsively and carries an accessible `alt`.
- **Directions / contact** buttons: per-event Google Maps directions (same shared link)
  and phone links, on every event card and in the contact section on all screens (the old
  mobile sticky action bar was removed; guests scroll ~one screen at most on phones).
  Contact numbers are shown in a filled highlight pill so they are easy to spot and tap.
- **Mobile scroll feedback:** phone browsers hide the native scrollbar, so the page adds a
  thin progress line at the top edge plus a "Scroll" cue at the foot of the hero; neither
  replaces, hides or hijacks the native scroll behaviour.
- Respects `prefers-reduced-motion` (no scan animations, no particles); scroll-reveal
  content is never left invisible if the observer doesn't run.

## 4b. Optional 3D booklet ("A little book of us")

`js/booklet.js` adds one extra section (before the schedule) with an explicit
**Open 3D invitation** button. The button is what loads everything — until it is
pressed the 3D booklet costs nothing.

- **Pages** are canvases drawn on the spot from `config.js` content and photos in the default
  palette (cream paper, bordeaux/deep-green type, Bricolage Grotesque + Manrope, cream page
  edges via `paper.backColor`): a front cover (monogram + names + tagline + date), then one
  photo-only "Moments" page per entry in `bookletPhotos` (all five by default:
  `bookletPhoto-1.jpeg` … `bookletPhoto-5.jpeg`, short titles from
  `kn.booklet.momentTitles` / `booklet.momentTitles`). There is no schedule, venue, family or
  phone page — those stay in the invitation below, so the booklet is a pure album of the
  couple's photographs. Pages are rasterised only after the page's fonts are ready, at 3× the
  800-unit design width (2400px) so text and photos stay crisp on high-density phone screens
  and on the desktop spread.
- **Photos are never blurred or cropped**: each one is drawn *contained* (its whole frame
  visible) on whole pixels from its full-resolution source, with high-quality smoothing, and
  is never stretched past `MAX_PHOTO_UPSCALE` (2.5× its own natural pixel size). Every
  configured photo (≥ 1600 px wide, or ~600 px for the two portraits) therefore renders at or
  below its native resolution on both the single-page phone layout and the desktop spread.
- **Leaks nothing into the plain page**: the inline (desktop) booklet never locks page scroll and never
  autoplays (the library's `motion: { reducedMotion: "auto" }` follows the guest's
  `prefers-reduced-motion`), `maxPixelRatio` follows the screen's real density (capped
  at 3) and `preload: 2` to keep it light.
- **Responsive by the library's own breakpoint**: a two-page spread on
  desktop/large-landscape screens, single portrait pages on phones; stage size
  and `Prev / page count / Next / Close` controls (all ≥ 44px touch targets) are
  in `css/booklet.css`. Arrow keys work while the booklet is focused, `Escape`
  closes it.
- **On phones it opens full-viewport**: instead of opening inline, phones
  (`max-width: 767px`, or a coarse pointer with a short viewport — landscape)
  get a fixed `100dvh` overlay with safe-area padding (`.bk-overlay`). The page's
  scroll is locked and restored on every close or fatal path, the rest of the
  page is made `inert`, focus is trapped inside the dialog (`role="dialog"` /
  `aria-modal`), and resizing/rotating while open is handled cleanly (a switch
  to a desktop context closes the overlay so it can reopen as the inline
  spread). Desktop behaviour is unchanged.
- **Clean closing**: Close disposes the WebGL resources; if anything fails, the
  guest sees a readable message and the plain photo as an alternative (the page
  itself always keeps all details, so nothing is lost without the booklet).
- **Photo tilt (`js/photo-tilt.js` + `css/photo-tilt.css`)**: a subtle, native
  scroll-driven 3D tilt on the couple photo (three.js from the same import map —
  no new dependencies). Pure progressive enhancement: the real `<img>` stays the
  no-JS/no-WebGL fallback and is only visually replaced once the overlay canvas
  has proven it renders an identical first frame; it follows the live displayed
  rectangle and the image's `currentSrc` (so the responsive WebP variants work),
  and pauses whenever the tab is hidden, the photo is offscreen, the body is
  scroll-locked or the booklet overlay is open. `prefers-reduced-motion`, Data
  Saver, slow connections and low-memory devices always get the plain photo.
- **Vendored & licensed**: exact pinned copies of `leafthrough@0.1.8` (MIT,
  Dmytro Barylo) and the two modules of `three@0.186.1` (MIT) live under
  `vendor/` — no package manager or build step; see `vendor/README.md` and the
  `LICENSE` files. Because LeafThrough imports the bare specifier `three`,
  `index.html` carries a small `importmap` pinning it to the vendored copy.
- **To remove it**: delete the `css/booklet.css` link, the `importmap` +
  `js/booklet.js` script block in `index.html`, and the `vendor/` folder plus
  `js/booklet.js` / `css/booklet.css`.

## 5. Put it online

Drag the folder to <https://app.netlify.com/drop> or use GitHub Pages / Vercel — the site
is fully static. Test on a phone first; most guests will open it there.

### Social / link previews

The page ships with a title, description, and a monogram SVG favicon (also used when
sharing). A local SVG favicon is **not** used as the link-preview image by chat apps —
if you want a photo preview there, add a real hosted image (`og:image`) yourself;
none is invented here.

## 6. Latest changes

- **English / ಕನ್ನಡ toggle** (`js/i18n.js`): one pill, all copy and dates switch;
  the configured language is used on each page load and `?lang=kn` deep-links into Kannada.
  See section 2b.
- **Booklet is now a photo album**: cover + one page per `bookletPhotos` entry (6 pages by
  default) — no schedule, venue, family or phone page. Switching language while it is open
  rebuilds the pages; photos are contained on whole pixels and never over-upscaled.
- **Hero shortcut removed**: no "View schedule" button; the flow is hero → countdown →
  3D booklet → schedule.
- **Kannada typography**: Noto Sans/Serif Kannada, word-level (not glyph-level) scroll
  effects and whole-string canvas drawing so conjuncts and matras stay intact.
- **Localized blessing** on the intro screen, the hero and the booklet cover: English uses
  `blessing` and Kannada uses `kn.blessing` in `config.js`.
- **Phone icons** on the contact buttons.
- **Mandala ornament** replaces the diamond in all dividers (CSS mask in `css/style.css`; canvas flower in `js/booklet.js`).
- **Booklet:** cover/spread are centred (`centerBook()` in `js/booklet.js`), pages sit directly on the maroon band, the
  "Booklet open" button is hidden while open, and opening scrolls the spread into view.
- **Reception date** corrected to 4 December 2026, 7:30 pm in `config.js`.
- **Celebration cards** use larger text; the empty band between countdown and booklet is removed.
