// Ports of import_dictionary() and import_colors() from 6000.py.

/**
 * Builds the {key: text} lookup used everywhere in 6000.py as `dict[...]`.
 * English reference values are loaded first, then overwritten by whatever
 * the target-language file provides (same order as the Python version, so a
 * partially-translated language silently falls back to English per key).
 */
export function buildDictionary(referenceCsvText, languageCsvText, Papa) {
  const dict = {};
  for (const row of Papa.parse(referenceCsvText, { header: true }).data) {
    if (row.key) dict[row.key] = row.english ?? ' ';
  }
  for (const row of Papa.parse(languageCsvText, { header: true }).data) {
    if (row.key) dict[row.key] = row.text ?? ' ';
  }
  return dict;
}

/**
 * Builds the {key: [r,g,b]} lookup, port of import_colors("rgb").
 */
export function buildColors(colorsCsvText, Papa) {
  const color = {};
  for (const row of Papa.parse(colorsCsvText, { header: true }).data) {
    if (!row.key) continue;
    color[row.key] = [Number(row.R), Number(row.G), Number(row.B)];
  }
  return color;
}

/**
 * Row from supported_languages.csv for one language, port of the lookup at
 * the top of create_canvas().
 */
export function languageRow(supportedLanguagesCsvText, langCode, Papa) {
  const rows = Papa.parse(supportedLanguagesCsvText, { header: true }).data;
  const row = rows.find((r) => r.key === langCode);
  if (!row) throw new Error(`Language "${langCode}" not found in supported_languages.csv`);
  return row;
}
