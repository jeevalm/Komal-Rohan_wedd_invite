# Vendored libraries (pinned, no package manager needed)

This site ships several third-party libraries as plain static files so it can be
deployed by copying the folder — there is no `package.json` or build step.

## leafthrough 0.1.8 (MIT)

- Source: https://github.com/dmtrbrl/leafthrough
- Fetched exactly from the published npm tarball `leafthrough@0.1.8`
  (`npm pack leafthrough@0.1.8`); the `dist/` files and `LICENSE` were copied
  unmodified.
- License: MIT — Copyright (c) 2026 Dmytro Barylo — see `vendor/leafthrough/LICENSE`.
- Files:
  - `vendor/leafthrough/dist/index.js` (imports `"three"` bare + `./chunk-MJSK3A5O.js`)
  - `vendor/leafthrough/dist/chunk-MJSK3A5O.js`

Because `dist/index.js` imports the bare specifier `"three"`, the page needs an
import map pointing it at the vendored copy:

```html
<script type="importmap">
{ "imports": { "three": "./vendor/three/build/three.module.js" } }
</script>
```

## three.js 0.186.1 (MIT)

- Source: https://github.com/mrdoob/three.js
- Fetched exactly from the published npm tarball `three@0.186.1`; the two build
  modules and `LICENSE` were copied unmodified.
- License: MIT — Copyright © 2010-2026 three.js authors — see `vendor/three/LICENSE`.
- Files:
  - `vendor/three/build/three.module.js` (imports `./three.core.js` relatively)
  - `vendor/three/build/three.core.js`

Only these two files of the three build are needed; nothing else under `vendor/`
is loaded.

## How the pages use them

`js/booklet.js` imports `../vendor/leafthrough/dist/index.js` lazily (only once
the guest taps "Open 3D invitation"), and `index.html` must include both the
import map above (before any module scripts) and the `<script type="module">`
tag for `js/booklet.js`.
