# timeline.js

Browser-based generator for the [kreier/timeline](https://github.com/kreier/timeline) PDF
(an overview of human history, 4075 BCE &ndash; 2075 CE). Downloads the same CSVs, fonts,
and images the Python `python/6000.py` script uses, and draws the PDF client-side with
[pdf-lib](https://pdf-lib.js.org/), no server or Python runtime required.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build     # outputs to dist/
npm run preview   # serve the production build locally
```

Deploys automatically to GitHub Pages on push to `main` via
`.github/workflows/deploy.yml`. **If you rename the repo, update `base` in
`vite.config.js` to match** (`/<repo-name>/`) &mdash; a mismatch here is the #1 cause of a
blank page on Pages, the same issue diagnosed on `jwlibrary-merge-web`.

## Architecture

```
src/
  main.js                  UI wiring for the 3-step workflow
  styles.css
  modules/
    assets.js               downloads db/*.csv, fonts/*.ttf, images/* from
                             raw.githubusercontent.com/kreier/timeline
    pdf/
      coords.js              port of year()/float_date()/x_position()/y_position()
      dictionary.js           port of import_dictionary()/import_colors()
      drawing.js              pdf-lib helpers; converts fpdf2's top-left/
                               y-down coordinate system to pdf-lib's
                               bottom-left/y-up system once, centrally
      steps.js                registry: one entry per create_*() function
                               in 6000.py, in call order, with a `status`
                               field ("done" | "stub")
      generator.js            orchestrator: loads fonts, runs enabled+done
                               steps, returns PDF bytes
```

### Porting status

Every layer in `create_timeline()` (6000.py) has a matching entry in
`src/modules/pdf/steps.js`. Two are fully ported as a working example of the
whole pipeline (CSV row &rarr; layout math &rarr; pdf-lib draw call):

- `create_horizontal_axis` &rarr; `axis`
- `create_adam_moses` &rarr; `adamMoses`

The rest (`create_reference_events`, `create_judges`, `create_kings`,
`create_periods`, `create_daniel2`, ...) are registered and show up as
disabled checkboxes labelled "not yet ported" until their `runners[...]`
implementation is added to `generator.js` and their `status` flipped to
`'done'` in `steps.js`. Porting one is mechanical: read the Python function,
replace `pdf.rect/line/cell` calls with `drawRect/drawLine/drawString` from
`drawing.js`, replace `x_position()/y_position()` with the same-named
functions from `coords.js`.

### Known gaps vs. the Python version (by design, for this phase)

- **Text shaping / RTL** (Arabic, Hebrew, Persian, Khmer, Sinhala): fpdf2 uses
  HarfBuzz; there's no equivalent wired up yet. Start with LTR languages.
- **CJK / Cuneiform fonts**: not yet fetched or embedded; only the Aptos +
  NotoSans core set is downloaded by default.
- **SVG embedding** (Daniel 2 image, `pictures_svg.csv`): pdf-lib doesn't
  rasterize SVG natively; plan is to rasterize via `<canvas>` + `drawImage`
  before embedding, or precompute PNGs.
- **Baseline/metrics fidelity**: `drawString()` in `drawing.js` approximates
  the text baseline (`0.8 * fontSize`) rather than reading real font ascent
  metrics; fine for a first visual pass, worth tightening later.

## Data-structure notes (generator-agnostic direction)

The CSVs in `kreier/timeline/db/` are consumed as-is right now (same
columns, same `key`-based joins against `dictionary_*.csv` and
`colors_rgb.csv`). If/when the source project's data model changes to be
generator-agnostic, the only files that should need touching on this side are
`assets.js` (fetch paths) and `dictionary.js`/`generator.js` (column names) -
`coords.js` and `drawing.js` have no CSV-shape knowledge at all.
