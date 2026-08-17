// Downloads source files for timeline.js directly from kreier/timeline repo raw content.
// Everything lands in an in-memory store keyed by relative path (e.g. "db/colors_rgb.csv",
// "fonts/aptos.ttf", "images/qr-en.png").

const RAW_BASE = 'https://raw.githubusercontent.com/kreier/timeline/main';

export const STATIC_DICTIONARIES = [
  'db/dictionary_reference.csv'
];

export const STATIC_DATA_CSV = [
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

export const STATIC_FONTS = [
  'python/fonts/aptos.ttf',
  'python/fonts/aptos-bold.ttf',
  'python/fonts/NotoSans.ttf',
  'python/fonts/NotoSans-bold.ttf'
];

export const FIXED_IMAGES = (langCode) => [
  `images/qr-${langCode}.png`,
  'images/daniel2_fiverr2.svg',
  'images/daniel2_fiverr2_rtl.svg'
];

export function getExpectedAssets(langCode) {
  return {
    dictionaries: [
      ...STATIC_DICTIONARIES,
      `db/dictionary_${langCode}.csv`
    ],
    data: [...STATIC_DATA_CSV],
    fonts: [...STATIC_FONTS],
    images: [...FIXED_IMAGES(langCode)]
  };
}

async function fetchText(path, log, onFileProgress) {
  onFileProgress?.({ path, status: 'loading' });
  const url = `${RAW_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    onFileProgress?.({ path, status: 'err', error: `HTTP ${res.status}` });
    throw new Error(`${path} -> HTTP ${res.status}`);
  }
  const text = await res.text();
  log?.(`ok: ${path}`, 'ok');
  onFileProgress?.({ path, status: 'ok', size: text.length });
  return text;
}

async function fetchBinary(path, log, onFileProgress) {
  onFileProgress?.({ path, status: 'loading' });
  const url = `${RAW_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    onFileProgress?.({ path, status: 'err', error: `HTTP ${res.status}` });
    throw new Error(`${path} -> HTTP ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  log?.(`ok: ${path}`, 'ok');
  onFileProgress?.({ path, status: 'ok', size: buffer.byteLength });
  return buffer;
}

/**
 * Reads supported_languages.csv (already downloaded) to find the extra
 * script font this language needs.
 */
function fontsForLanguage(supportedLanguagesCsvText, langCode, Papa) {
  if (!supportedLanguagesCsvText) return [];
  const rows = Papa.parse(supportedLanguagesCsvText, { header: true }).data;
  const row = rows.find((r) => r.key === langCode);
  const fontname = row?.fontname?.trim();
  if (!fontname) return [];
  return [`python/fonts/${fontname}.ttf`, `python/fonts/${fontname}-bold.ttf`];
}

/**
 * Downloads dictionary/colors/layout CSVs, core fonts, QR + Daniel-2
 * images, and all images referenced in pictures.csv / pictures_svg.csv.
 *
 * @param {string} langCode
 * @param {(msg:string, kind?:'ok'|'err')=>void} log
 * @param {object} Papa
 * @param {(info: {category: string, path: string, status: string, size?: number, error?: string}) => void} onProgress
 * @returns {Promise<{files: Map<string, string|ArrayBuffer>, langCode: string}>}
 */
export async function downloadAssets(langCode, log, Papa, onProgress) {
  const files = new Map();

  // 1. Dictionaries
  const dictPaths = [...STATIC_DICTIONARIES, `db/dictionary_${langCode}.csv`];
  for (const p of dictPaths) {
    try {
      const content = await fetchText(p, log, (info) => onProgress?.({ category: 'dictionaries', ...info }));
      files.set(p, content);
    } catch (e) {
      log?.(`err: ${p} (${e.message})`, 'err');
    }
  }

  // 2. Data CSVs
  for (const p of STATIC_DATA_CSV) {
    try {
      const content = await fetchText(p, log, (info) => onProgress?.({ category: 'data', ...info }));
      files.set(p, content);
    } catch (e) {
      log?.(`err: ${p} (${e.message})`, 'err');
    }
  }

  // 3. Fonts
  const langFonts = fontsForLanguage(files.get('db/supported_languages.csv'), langCode, Papa);
  const allFonts = [...STATIC_FONTS, ...langFonts];
  for (const p of allFonts) {
    try {
      const buffer = await fetchBinary(p, log, (info) => onProgress?.({ category: 'fonts', ...info }));
      files.set(p, buffer);
    } catch (e) {
      log?.(`skip: ${p} (${e.message})`, 'err');
      onProgress?.({ category: 'fonts', path: p, status: 'skip', error: e.message });
    }
  }

  // 4. Fixed Images
  const fixedImages = FIXED_IMAGES(langCode);
  for (const p of fixedImages) {
    try {
      const buffer = await fetchBinary(p, log, (info) => onProgress?.({ category: 'images', ...info }));
      files.set(p, buffer);
    } catch (e) {
      log?.(`skip: ${p} (${e.message})`, 'err');
      onProgress?.({ category: 'images', path: p, status: 'skip', error: e.message });
    }
  }

  // 5. Dynamic Images from pictures.csv / pictures_svg.csv
  for (const csvKey of ['db/pictures.csv', 'db/pictures_svg.csv']) {
    const csvContent = files.get(csvKey);
    if (!csvContent) continue;
    const rows = Papa.parse(csvContent, { header: true }).data;
    for (const row of rows) {
      if (!row.key) continue;
      const path = csvKey.endsWith('svg.csv') ? `images/${row.key}.svg` : `images/${row.key}`;
      if (files.has(path)) continue;
      try {
        const buffer = await fetchBinary(path, log, (info) => onProgress?.({ category: 'images', ...info }));
        files.set(path, buffer);
      } catch (e) {
        log?.(`skip: ${path} (${e.message})`, 'err');
        onProgress?.({ category: 'images', path: p, status: 'skip', error: e.message });
      }
    }
  }

  return { files, langCode };
}
