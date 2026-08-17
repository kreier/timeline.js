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
  return rgb(
    Math.max(0, Math.min(1, r / 255)),
    Math.max(0, Math.min(1, g / 255)),
    Math.max(0, Math.min(1, b / 255))
  );
}

export function drawLine(page, layout, x1, y1td, x2, y2td, color = [0, 0, 0], width = 1) {
  page.drawLine({
    start: { x: x1, y: toPdfY(layout, y1td) },
    end: { x: x2, y: toPdfY(layout, y2td) },
    thickness: width,
    color: rgbColor(color)
  });
}

export function drawRect(page, layout, x, yTopDown, w, h, { fill, stroke, strokeWidth = 0.5 } = {}) {
  if (w <= 0 || h <= 0) return;
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
 * Draw a polygon from an array of [x, yTopDown] coordinates.
 * Generates an SVG path and calls page.drawSvgPath.
 */
export function drawPolygon(page, layout, points, { fill, stroke, strokeWidth = 0.5 } = {}) {
  if (!points || points.length < 3) return;

  const pdfY = (ytd) => toPdfY(layout, ytd);
  const pathData = points
    .map(([px, pytd], idx) => {
      const py = pdfY(pytd);
      return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
    })
    .join(' ') + ' Z';

  try {
    page.drawSvgPath(pathData, {
      x: 0,
      y: 0,
      color: fill ? rgbColor(fill) : undefined,
      borderColor: stroke ? rgbColor(stroke) : undefined,
      borderWidth: stroke ? strokeWidth : 0
    });
  } catch (e) {
    // Fallback: draw connecting lines
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      drawLine(page, layout, p1[0], p1[1], p2[0], p2[1], stroke || fill || [0, 0, 0], strokeWidth);
    }
  }
}

/**
 * Port of drawString() in 6000.py. `position` is "r" | "l" | "c", matching
 * the original: draw starting to the right, ending to the left of x, or
 * centered on x. `yTopDown` is the top of the text's line box, as in Python.
 */
export function drawString(page, layout, text, { font, size, x, yTopDown, color = [0, 0, 0], position = 'r', whiteBackground = false }) {
  if (!text || String(text).trim() === '') return;
  const str = String(text);
  const width = font.widthOfTextAtSize(str, size);
  let xStart;
  if (position === 'l') xStart = x - width;
  else if (position === 'c') xStart = x - width / 2;
  else xStart = x;

  if (whiteBackground) {
    drawRect(page, layout, xStart, yTopDown, width, size, { fill: [255, 255, 255], stroke: [255, 255, 255] });
  }

  page.drawText(str, {
    x: xStart,
    y: toPdfY(layout, yTopDown) - size * 0.8,
    size,
    font,
    color: rgbColor(color)
  });
}

/**
 * Embeds and caches a JPG or PNG in pdf-lib.
 */
export async function getOrEmbedImage(ctx, path) {
  if (!ctx.embeddedImages) {
    ctx.embeddedImages = new Map();
  }
  if (ctx.embeddedImages.has(path)) {
    return ctx.embeddedImages.get(path);
  }

  const data = ctx.files.get(path);
  if (!data) return null;

  try {
    let embedded = null;
    const lower = path.toLowerCase();
    if (lower.endsWith('.png')) {
      embedded = await ctx.pdfDoc.embedPng(data);
    } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      embedded = await ctx.pdfDoc.embedJpg(data);
    }
    if (embedded) {
      ctx.embeddedImages.set(path, embedded);
      return embedded;
    }
  } catch (e) {
    ctx.log?.(`Could not embed image ${path}: ${e.message}`, 'err');
  }
  return null;
}

/**
 * Draws an embedded JPG/PNG image onto the page.
 */
export async function drawImage(ctx, path, x, yTopDown, width, height) {
  const img = await getOrEmbedImage(ctx, path);
  if (!img) return false;

  ctx.page.drawImage(img, {
    x,
    y: toPdfY(ctx.layout, yTopDown) - height,
    width,
    height
  });
  return true;
}
