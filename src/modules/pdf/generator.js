import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import Papa from 'papaparse';
import { buildLayout, historicalYear, floatDate, xPosition, yPosition } from './coords.js';
import { buildDictionary, buildColors } from './dictionary.js';
import { drawLine, drawRect, drawString } from './drawing.js';
import { STEPS } from './steps.js';

/**
 * Renders the timeline PDF for one language/edition, honoring which steps
 * are enabled. Mirrors create_timeline() in 6000.py:
 *   initiate_counters -> import_dictionary -> import_colors -> create_canvas
 *   -> create_horizontal_axis -> create_adam_moses -> ... -> render_to_file
 *
 * @param {Map<string, string|ArrayBuffer>} files  from downloadAssets()
 * @param {string} langCode
 * @param {'digital'|'print'} edition
 * @param {Set<string>} enabledStepIds
 * @param {(msg:string, kind?:'ok'|'err')=>void} log
 * @returns {Promise<Uint8Array>}
 */
export async function generateTimelinePdf(files, langCode, edition, enabledStepIds, log) {
  const dict = buildDictionary(files.get('db/dictionary_reference.csv'), files.get(`db/dictionary_${langCode}.csv`), Papa);
  const color = buildColors(files.get('db/colors_rgb.csv'), Papa);
  const layout = buildLayout(edition);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);

  const regularBytes = files.get('python/fonts/aptos.ttf');
  const boldBytes = files.get('python/fonts/aptos-bold.ttf');
  const fontRegular = regularBytes ? await pdfDoc.embedFont(regularBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = boldBytes ? await pdfDoc.embedFont(boldBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx = { pdfDoc, page, layout, dict, color, fontRegular, fontBold, langCode, edition, log, files };

  const runners = {
    axis: () => drawHorizontalAxis(ctx),
    adamMoses: () => drawAdamMoses(ctx)
  };

  for (const step of STEPS) {
    if (!enabledStepIds.has(step.id)) {
      log?.(`skip (disabled): ${step.label}`);
      continue;
    }
    if (step.status !== 'done') {
      log?.(`not yet ported, skipping: ${step.label}  [${step.pyFn}()]`, 'err');
      continue;
    }
    log?.(`drawing: ${step.label}`, 'ok');
    runners[step.id](ctx);
  }

  return pdfDoc.save();
}

// ---- Port of create_horizontal_axis() -------------------------------------
function drawHorizontalAxis(ctx) {
  const { page, layout, dict, fontRegular } = ctx;
  const fontsizeLabel = 11;

  drawLine(page, layout, layout.x1, layout.y1, layout.x1 + layout.pageWidth - 2 * layout.borderLr, layout.y1, [0, 0, 0], 0.8);
  drawLine(page, layout, layout.x1, layout.y2, layout.x1 + layout.pageWidth - 2 * layout.borderLr, layout.y2, [0, 0, 0], 0.8);

  for (let i = 0; i < 61; i++) {
    const tickX = xPosition(layout, -4075.5) + (75 + 100 * i) * layout.dotsYear;
    drawLine(page, layout, tickX, layout.y1, tickX, layout.y1 - 2 * 2.834645669, [0, 0, 0], 0.8);
    drawLine(page, layout, tickX, layout.y2, tickX, layout.y2 + 2 * 2.834645669, [0, 0, 0], 0.8);

    const yearLabel = String(Math.abs(100 * i - 4000));
    drawString(page, layout, yearLabel, { font: fontRegular, size: fontsizeLabel, x: tickX, yTopDown: layout.y1 - 17, position: 'c' });
    drawString(page, layout, yearLabel, { font: fontRegular, size: fontsizeLabel, x: tickX, yTopDown: layout.y2 + 7, position: 'c' });
  }

  drawString(page, layout, dict['CE'] ?? 'CE', { font: fontRegular, size: fontsizeLabel, x: xPosition(layout, 2075) - 20, yTopDown: layout.y1 - 17, position: 'r' });
  drawString(page, layout, dict['BCE'] ?? 'BCE', { font: fontRegular, size: fontsizeLabel, x: xPosition(layout, -4075) + 20, yTopDown: layout.y1 - 17, position: 'l' });
}

// ---- Port of create_adam_moses() (Deluge line + patriarch boxes) ----------
// Faithful to the row-by-row logic in 6000.py; the fpdf2-specific quirks
// (NotoSans fallback for modifier-letter-prime glyphs, y-offset per index)
// are carried over as comments where they were skipped for this phase.
function drawAdamMoses(ctx) {
  const { page, layout, dict, color, fontBold, fontRegular, files, log } = ctx;

  // Deluge line, 2370 BCE
  const dateDeluge = xPosition(layout, -2370);
  drawLine(page, layout, dateDeluge, layout.y1, dateDeluge, layout.y2, [0, 0, 255], 1.0);
  drawString(page, layout, `${dict['Deluge'] ?? 'Deluge'} 2370 ${dict['BCE'] ?? 'BCE'}`, {
    font: fontRegular, size: 12, x: dateDeluge + 2, yTopDown: layout.y1 + 6, position: 'r', whiteBackground: true
  });

  const csvText = files.get('db/adam-moses.csv');
  if (!csvText) {
    log?.('db/adam-moses.csv missing from downloaded assets, skipping patriarch boxes', 'err');
    return;
  }
  const people = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);

  let fatherBorn = null;
  people.forEach((row, index) => {
    const born = -historicalYear(floatDate(row.born));
    const died = -historicalYear(floatDate(row.died));
    const person = dict[row.key] ?? row.key;
    const detailsR = `${born} ${dict['to'] ?? 'to'} ${died} ${dict['BCE'] ?? 'BCE'} - ${born - died} ${dict['years_age'] ?? 'yrs'}`;

    const xBox = xPosition(layout, floatDate(row.born));
    let yBox = layout.y1 + (index * 20.5 + 2);
    if (index > 18) yBox += 12.5; // after Terah
    if (index === 23) yBox += 12; // Moses

    const xBoxwidth = xPosition(layout, born) - xPosition(layout, died);
    const xText = xBox + xBoxwidth * 0.5;
    const co = color[row.key] ?? [150, 150, 150];

    drawRect(page, layout, xBox, yBox, xBoxwidth, 19, { fill: co, stroke: [0, 0, 0], strokeWidth: 0.5 });
    drawString(page, layout, person, { font: fontBold, size: 16, x: xText, yTopDown: yBox + 2, position: 'c', color: [255, 255, 255] });
    drawString(page, layout, detailsR, { font: fontRegular, size: 12, x: xBox + xBoxwidth + 2, yTopDown: yBox + 3.5, position: 'r', whiteBackground: true });

    if (index > 0 && index < 23 && fatherBorn !== null) {
      const fatherAge = `${fatherBorn - born} ${dict['years_age'] ?? 'yrs'}`;
      drawString(page, layout, fatherAge, { font: fontRegular, size: 9, x: xBox - 3, yTopDown: yBox + 1, position: 'l', whiteBackground: true });
    }
    fatherBorn = born;
  });
}

export const _internal = { drawHorizontalAxis, drawAdamMoses };
