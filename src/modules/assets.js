// Downloads the same source files 6000.py reads from ../db, ../fonts and
// ../images, straight from the kreier/timeline repo's raw content. Everything
// lands in an in-memory store keyed by the path it has in the original repo
// (e.g. "db/colors_rgb.csv", "fonts/aptos.ttf", "images/qr-en.png"), so the
// PDF-generation code can stay ignorant of where bytes came from.

const RAW_BASE = 'https://raw.githubusercontent.com/kreier/timeline/main';

// Static files needed regardless of language, mirrors the fixed imports at
// the top of 6000.py / create_canvas() / include_pictures*().
const STATIC_CSV = [
  'db/dictionary_reference.csv',
  'db/colors_rgb.csv',
  'db/supported_languages.csv',
  'db/adam-moses.csv',
  'db/events.csv',
  'db/events_objects.csv',
  'db/judges.csv',
  'db/kings.csv',
  'db/prophets.csv',
  'db/books.csv',
  'db/people.csv',
  'db/objects.csv',
  'db/periods.csv',
  'db/pictures.csv',
  'db/pictures_svg.csv'
];

const STATIC_FONTS = [
  'python/fonts/aptos.ttf',
  'python/fonts/aptos-bold.ttf',
  'python/fonts/NotoSans.ttf',
  'python/fonts/NotoSans-bold.ttf'
  // NotoCuneiform.ttf and per-language script fonts are pulled in on demand,
  // see fontsForLanguage() below - mirrors the "glyphs" branch in
  // create_canvas() in 6000.py which only loads a script font when the
  // language's row in supported_languages.csv asks for one.
];

async function fetchText(path, log) {
  const url = `${RAW_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  log?.(`ok: ${path}`, 'ok');
  return res.text();
}

async function fetchBinary(path, log) {
  const url = `${RAW_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  log?.(`ok: ${path}`, 'ok');
  return res.arrayBuffer();
}

/**
 * Reads supported_languages.csv (already downloaded) to find the extra
 * script font this language needs, matching the branch in create_canvas():
 *   if df.at[row_index[0], 'fontname'] == " ": use Aptos
 *   else: load fonts/<fontname>.ttf (+ "-bold" if it exists)
 */
function fontsForLanguage(supportedLanguagesCsvText, langCode, Papa) {
  const rows = Papa.parse(supportedLanguagesCsvText, { header: true }).data;
  const row = rows.find((r) => r.key === langCode);
  const fontname = row?.fontname?.trim();
  if (!fontname) return [];
  return [`python/fonts/${fontname}.ttf`, `python/fonts/${fontname}-bold.ttf`];
}

/**
 * Downloads dictionary/colors/layout CSVs, core fonts, the QR + Daniel-2
 * images, and (after parsing pictures.csv/pictures_svg.csv) every image
 * referenced there - the same set 6000.py touches for one language.
 *
 * @param {string} langCode  e.g. "en", "de", "vi"
 * @param {(msg:string, kind?:'ok'|'err')=>void} log
 * @returns {Promise<{files: Map<string, string|ArrayBuffer>, langCode:string}>}
 */
export async function downloadAssets(langCode, log, Papa) {
  const files = new Map();

  const csvPaths = [...STATIC_CSV, `db/dictionary_${langCode}.csv`];
  for (const p of csvPaths) {
    files.set(p, await fetchText(p, log));
  }

  const langFonts = fontsForLanguage(files.get('db/supported_languages.csv'), langCode, Papa);
  for (const p of [...STATIC_FONTS, ...langFonts]) {
    try {
      files.set(p, await fetchBinary(p, log));
    } catch (e) {
      // Bold variants for a script font sometimes don't exist (6000.py falls
      // back to the regular weight in that case) - don't hard-fail the batch.
      log?.(`skip: ${p} (${e.message})`, 'err');
    }
  }

  // QR + Daniel 2 images (create_qr_code / create_daniel2 in 6000.py)
  const fixedImages = [
    `images/qr-${langCode}.png`,
    'images/daniel2_fiverr2.svg',
    'images/daniel2_fiverr2_rtl.svg'
  ];
  for (const p of fixedImages) {
    try {
      files.set(p, await fetchBinary(p, log));
    } catch (e) {
      log?.(`skip: ${p} (${e.message})`, 'err');
    }
  }

  // Images enumerated in pictures.csv / pictures_svg.csv (include_pictures*)
  for (const csvKey of ['db/pictures.csv', 'db/pictures_svg.csv']) {
    const rows = Papa.parse(files.get(csvKey), { header: true }).data;
    for (const row of rows) {
      if (!row.key) continue;
      const path = csvKey.endsWith('svg.csv') ? `images/${row.key}.svg` : `images/${row.key}`;
      if (files.has(path)) continue;
      try {
        files.set(path, await fetchBinary(path, log));
      } catch (e) {
        log?.(`skip: ${path} (${e.message})`, 'err');
      }
    }
  }

  return { files, langCode };
}
