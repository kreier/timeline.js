// Direct port of the coordinate math in 6000.py (lines ~11-116).
// Kept as pure functions of an explicit `layout` object instead of Python
// module-level globals, so multiple renders (digital/print, different
// languages) never leak state into each other.

export const MM = 2.834645669; // 1mm in pt, matches 6000.py's `mm`

/**
 * Build the layout constants for one edition ("digital" | "print").
 * Mirrors create_canvas() in 6000.py.
 */
export function buildLayout(edition, scale = 1.0) {
  const borderTb = 7 * MM * scale;
  const borderLr = edition === 'print' ? 60 * MM * scale : 10 * MM * scale;
  const pageWidth = 4 * 297 * MM * scale + 2 * borderLr; // 4x A4 landscape
  const pageHeight = 210 * MM * scale;

  const drawingWidth = pageWidth - 2 * borderLr;
  const drawingHeight = pageHeight - 2 * borderTb;

  const x1 = borderLr;
  const y1 = borderTb;
  const x2 = x1 + drawingWidth;
  const y2 = y1 + drawingHeight;

  // area spans 4075 BCE to 2075 CE = 6150 years
  const dotsYear = drawingWidth / 6150;

  return { edition, scale, borderTb, borderLr, pageWidth, pageHeight, x1, y1, x2, y2, dotsYear };
}

/** Astronomical year -> historical label year. Port of year(date_float). */
export function historicalYear(dateFloat) {
  const astronYear = Math.floor(dateFloat);
  if (astronYear >= 1) return astronYear;
  return astronYear - 1; // e.g. astron 0 -> 1 BCE, astron -538 -> 539 BCE
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Parse "YYYY-MM-DD" or "BCEYYYY-MM-DD" into a continuous astronomical-year
 * float, exactly like float_date() in 6000.py.
 */
export function floatDate(str) {
  let isBce = false;
  let s = str;
  if (s.startsWith('BCE')) {
    isBce = true;
    s = s.slice(3);
  }
  const [labelYearStr, monthStr, dayStr] = s.split('-');
  const labelYear = parseInt(labelYearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const astronYear = isBce ? 1 - labelYear : labelYear;
  const daysInYear = isLeap(astronYear) ? 366 : 365;
  const refY = isLeap(astronYear) ? 2000 : 2001;

  const dayOfYear = Math.round(
    (Date.UTC(refY, month - 1, day) - Date.UTC(refY, 0, 1)) / 86400000
  );

  return astronYear + dayOfYear / daysInYear;
}

/** Port of x_position(). `layout` carries x1/dotsYear/leftToRight state. */
export function xPosition(layout, dateFloat, leftToRight = true) {
  let d = dateFloat;
  if (d < 0) d += 1; // no year zero: shift BCE dates left by one year
  if (leftToRight) {
    return layout.x1 + (4075 + d) * layout.dotsYear;
  }
  return layout.x1 + (2075 - d) * layout.dotsYear;
}

/** Port of y_position(). 46 rows of 12pt line height. */
export function yPosition(layout, rowY) {
  return layout.y1 + rowY * 12 * layout.scale;
}
