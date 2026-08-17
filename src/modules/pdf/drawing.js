import { rgb } from 'pdf-lib';

// fpdf2 (used by 6000.py) places the origin top-left with y growing
// downward. pdf-lib, like the underlying PDF spec, places the origin
// bottom-left with y growing upward. Every draw call below takes a
// "top-down" y (exactly what the Python code computes) and converts it once,
// here, so the rest of the port can keep reading like the original.

export function toPdfY(layout, yTopDown) {
  return layout.pageHeight - yTopDown;
}

export function rgbColor([r, g, b]) {
  return rgb(r / 255, g / 255, b / 255);
}

export function drawLine(page, layout, x1, y1td, x2, y2td, color, width = 1) {
  page.drawLine({
    start: { x: x1, y: toPdfY(layout, y1td) },
    end: { x: x2, y: toPdfY(layout, y2td) },
    thickness: width,
    color: rgbColor(color)
  });
}

export function drawRect(page, layout, x, yTopDown, w, h, { fill, stroke, strokeWidth = 0.5 } = {}) {
  // fpdf2's rect(x, y, w, h) anchors at the TOP-left corner and grows down;
  // pdf-lib's drawRectangle anchors at the BOTTOM-left corner and grows up.
  page.drawRectangle({
    x,
    y: toPdfY(layout, yTopDown) - h,
    width: w,
    height: h,
    color: fill ? rgbColor(fill) : undefined,
    borderColor: stroke ? rgbColor(stroke) : undefined,
    borderWidth: stroke ? strokeWidth : 0
  });
}

/**
 * Port of drawString() in 6000.py. `position` is "r" | "l" | "c", matching
 * the original: draw starting to the right, ending to the left of x, or
 * centered on x. `yTopDown` is the top of the text's line box, as in Python.
 */
export function drawString(page, layout, text, { font, size, x, yTopDown, color = [0, 0, 0], position = 'r', whiteBackground = false }) {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, size);
  let xStart;
  if (position === 'l') xStart = x - width;
  else if (position === 'c') xStart = x - width / 2;
  else xStart = x;

  if (whiteBackground) {
    drawRect(page, layout, xStart, yTopDown, width, size, { fill: [255, 255, 255], stroke: [255, 255, 255] });
  }

  // Baseline approximation: fpdf2 vertically centers text inside a
  // `size`-tall cell; pdf-lib draws from the glyph baseline. 0.8*size is a
  // reasonable stand-in for the font's ascent until real metrics are wired
  // in per font (TODO for higher-fidelity phase).
  page.drawText(text, {
    x: xStart,
    y: toPdfY(layout, yTopDown) - size * 0.8,
    size,
    font,
    color: rgbColor(color)
  });
}
