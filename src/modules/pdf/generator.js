import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import Papa from 'papaparse';
import { buildLayout, historicalYear, floatDate, xPosition, yPosition, MM } from './coords.js';
import { buildDictionary, buildColors } from './dictionary.js';
import { drawLine, drawRect, drawPolygon, drawString, drawImage, toPdfY, rgbColor } from './drawing.js';
import { STEPS } from './steps.js';

/**
 * Main entry point: Renders the timeline PDF for one language/edition,
 * executing enabled steps in the exact order of 6000.py.
 */
export async function generateTimelinePdf(files, langCode, edition, enabledStepIds, log) {
  const dict = buildDictionary(files.get('db/dictionary_reference.csv') || '', files.get(`db/dictionary_${langCode}.csv`) || '', Papa);
  const color = buildColors(files.get('db/colors_rgb.csv') || '', Papa);
  const layout = buildLayout(edition);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);

  // Fonts setup
  const regularBytes = files.get('python/fonts/aptos.ttf');
  const boldBytes = files.get('python/fonts/aptos-bold.ttf');
  const notoSansBytes = files.get('python/fonts/NotoSans.ttf');
  const notoSansBoldBytes = files.get('python/fonts/NotoSans-bold.ttf');
  const cuneiformBytes = files.get('python/fonts/NotoCuneiform.ttf');

  const fontRegular = regularBytes ? await pdfDoc.embedFont(regularBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = boldBytes ? await pdfDoc.embedFont(boldBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNoto = notoSansBytes ? await pdfDoc.embedFont(notoSansBytes, { subset: true }) : fontRegular;
  const fontNotoBold = notoSansBoldBytes ? await pdfDoc.embedFont(notoSansBoldBytes, { subset: true }) : fontBold;
  const fontCuneiform = cuneiformBytes ? await pdfDoc.embedFont(cuneiformBytes, { subset: true }) : fontRegular;

  // Language script metadata
  let leftToRight = true;
  let direction = 'r';
  let directionRl = 'l';
  let directionFactor = 1;
  let fontsizeRegular = 10;
  let fontsizeAMoses = 16;
  let yOffset = 0;

  const supportedCsv = files.get('db/supported_languages.csv');
  if (supportedCsv) {
    const langRows = Papa.parse(supportedCsv, { header: true }).data;
    const lRow = langRows.find((r) => r.key === langCode);
    if (lRow) {
      if (lRow.direction === 'RTL') {
        leftToRight = false;
        direction = 'l';
        directionRl = 'r';
        directionFactor = -1;
      }
      if (lRow.fontsize) fontsizeRegular = Number(lRow.fontsize);
      if (lRow.fontsize_AM) fontsizeAMoses = Number(lRow.fontsize_AM);
      if (lRow.y_offset) yOffset = Number(lRow.y_offset) * layout.scale;
    }
  }

  const ctx = {
    pdfDoc,
    page,
    layout,
    dict,
    color,
    fontRegular,
    fontBold,
    fontNoto,
    fontNotoBold,
    fontCuneiform,
    langCode,
    edition,
    leftToRight,
    direction,
    directionRl,
    directionFactor,
    fontsizeRegular,
    fontsizeAMoses,
    yOffset,
    log,
    files,
    embeddedImages: new Map()
  };

  const runners = {
    axis: () => drawHorizontalAxis(ctx),
    adamMoses: () => drawAdamMoses(ctx),
    refEvents: () => drawReferenceEvents(ctx),
    eventObjects: () => drawEventObjects(ctx),
    judges: () => drawJudges(ctx),
    kings: () => drawKings(ctx),
    prophets: () => drawProphets(ctx),
    books: () => drawBooks(ctx),
    people: () => drawPeople(ctx),
    objects: () => drawObjects(ctx),
    periods: () => drawPeriods(ctx),
    caesars: () => drawCaesars(ctx),
    tribulation: () => drawTribulation(ctx),
    terahFamily: () => drawTerahFamilyTree(ctx),
    pictures: () => includePictures(ctx),
    picturesSvg: () => includePicturesSvg(ctx),
    daniel2: () => drawDaniel2(ctx),
    timestamp: () => drawTimestamp(ctx)
  };

  for (const step of STEPS) {
    if (!enabledStepIds.has(step.id)) {
      log?.(`skip (disabled): ${step.label}`);
      continue;
    }
    log?.(`drawing: ${step.label}`, 'ok');
    try {
      await runners[step.id]?.();
    } catch (err) {
      log?.(`error in ${step.label}: ${err.message}`, 'err');
      console.error(err);
    }
  }

  return pdfDoc.save();
}

// --------------------------------------------------------------------------
// 1. Horizontal Axis & Century Ticks
// --------------------------------------------------------------------------
function drawHorizontalAxis(ctx) {
  const { page, layout, dict, fontRegular } = ctx;
  const fontsizeLabel = 11;

  drawLine(page, layout, layout.x1, layout.y1, layout.x1 + layout.pageWidth - 2 * layout.borderLr, layout.y1, [0, 0, 0], 0.8);
  drawLine(page, layout, layout.x1, layout.y2, layout.x1 + layout.pageWidth - 2 * layout.borderLr, layout.y2, [0, 0, 0], 0.8);

  for (let i = 0; i < 61; i++) {
    const tickX = xPosition(layout, -4075.5) + (75 + 100 * i) * layout.dotsYear * ctx.directionFactor;
    drawLine(page, layout, tickX, layout.y1, tickX, layout.y1 - 2 * MM * layout.scale, [0, 0, 0], 0.8);
    drawLine(page, layout, tickX, layout.y2, tickX, layout.y2 + 2 * MM * layout.scale, [0, 0, 0], 0.8);

    // smaller ticks
    for (let l = -40; l < 0; l += 10) {
      const tickS = tickX + l * layout.dotsYear * ctx.directionFactor;
      drawLine(page, layout, tickS, layout.y1, tickS, layout.y1 - 1 * MM * layout.scale, [0, 0, 0], 0.4);
      drawLine(page, layout, tickS, layout.y2, tickS, layout.y2 + 1 * MM * layout.scale, [0, 0, 0], 0.4);
    }
    for (let l = 10; l <= 50; l += 10) {
      const tickS = tickX + l * layout.dotsYear * ctx.directionFactor;
      drawLine(page, layout, tickS, layout.y1, tickS, layout.y1 - 1 * MM * layout.scale, [0, 0, 0], 0.4);
      drawLine(page, layout, tickS, layout.y2, tickS, layout.y2 + 1 * MM * layout.scale, [0, 0, 0], 0.4);
    }

    const yearLabel = String(Math.abs(100 * i - 4000));
    drawString(page, layout, yearLabel, { font: fontRegular, size: fontsizeLabel, x: tickX, yTopDown: layout.y1 - 17, position: 'c' });
    drawString(page, layout, yearLabel, { font: fontRegular, size: fontsizeLabel, x: tickX, yTopDown: layout.y2 + 7, position: 'c' });
  }

  drawString(page, layout, dict['CE'] ?? 'CE', { font: fontRegular, size: fontsizeLabel, x: xPosition(layout, 2075) - 20, yTopDown: layout.y1 - 17, position: 'r' });
  drawString(page, layout, dict['BCE'] ?? 'BCE', { font: fontRegular, size: fontsizeLabel, x: xPosition(layout, -4075) + 20, yTopDown: layout.y1 - 17, position: 'l' });
}

// --------------------------------------------------------------------------
// 2. Adam -> Moses (Patriarchs & Deluge)
// --------------------------------------------------------------------------
function drawAdamMoses(ctx) {
  const { page, layout, dict, color, fontBold, fontRegular, files, log } = ctx;

  // Deluge line at 2370 BCE
  const dateDeluge = xPosition(layout, -2370);
  drawLine(page, layout, dateDeluge, layout.y1, dateDeluge, layout.y2, [0, 0, 255], 1.0);
  drawString(page, layout, `${dict['Deluge'] ?? 'Deluge'} 2370 ${dict['BCE'] ?? 'BCE'}`, {
    font: fontRegular, size: 12, x: dateDeluge + 2, yTopDown: layout.y1 + 6, position: 'r', whiteBackground: true
  });

  const csvText = files.get('db/adam-moses.csv');
  if (!csvText) {
    log?.('db/adam-moses.csv missing', 'err');
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
    drawString(page, layout, person, { font: fontBold, size: ctx.fontsizeAMoses, x: xText, yTopDown: yBox + 2, position: 'c', color: [255, 255, 255] });
    drawString(page, layout, detailsR, { font: fontRegular, size: 12, x: xBox + xBoxwidth + 2 * ctx.directionFactor, yTopDown: yBox + 3.5, position: ctx.direction, whiteBackground: true });

    if (index > 0 && index < 23 && fatherBorn !== null) {
      const fatherAge = `${fatherBorn - born} ${dict['years_age'] ?? 'yrs'}`;
      drawString(page, layout, fatherAge, { font: fontRegular, size: 9, x: xBox - 3 * ctx.directionFactor, yTopDown: yBox + 1, position: ctx.directionRl, whiteBackground: true });
    }
    fatherBorn = born;
  });
}

// --------------------------------------------------------------------------
// Event helper function
// --------------------------------------------------------------------------
function drawEvent(ctx, key, date, ys, ye, yt, wl, pos) {
  const { page, layout, dict, fontRegular } = ctx;
  let textPos = pos;
  if (!ctx.leftToRight) {
    textPos = pos === 'l' ? 'r' : 'l';
  }
  const xLine = xPosition(layout, date);
  let xTxt = xLine + 4;
  const yTxt = yPosition(layout, yt) - 9;
  let xAdd = 2;
  if (textPos === 'l') {
    xTxt = xLine - 4;
    xAdd = -xAdd;
  }

  drawString(page, layout, dict[key] ?? key, {
    font: fontRegular,
    size: ctx.fontsizeRegular,
    x: xTxt,
    yTopDown: yTxt,
    position: textPos,
    whiteBackground: true
  });

  drawLine(page, layout, xLine, yPosition(layout, ys) - 1, xLine, yPosition(layout, ye) - 1, [20, 20, 30], Number(wl));

  const trianglePoints = [
    [xLine, yTxt + 3],
    [xLine + xAdd, yTxt + 5],
    [xLine, yTxt + 7]
  ];
  drawPolygon(page, layout, trianglePoints, { fill: [0, 0, 0], stroke: [20, 20, 30], strokeWidth: 0.5 });
}

// --------------------------------------------------------------------------
// 3. Reference Events
// --------------------------------------------------------------------------
function drawReferenceEvents(ctx) {
  const csvText = ctx.files.get('db/events.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  for (const row of rows) {
    drawEvent(ctx, row.key, floatDate(row.date), Number(row.y_start), Number(row.y_end), Number(row.y_text), Number(row.width), row.position);
  }
}

// --------------------------------------------------------------------------
// 4. Events & Objects
// --------------------------------------------------------------------------
function drawEventObjects(ctx) {
  const csvText = ctx.files.get('db/events_objects.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  for (const row of rows) {
    drawEvent(ctx, row.key, floatDate(row.date), Number(row.y_start), Number(row.y_end), Number(row.y_text), Number(row.width), row.position);
  }
}

// --------------------------------------------------------------------------
// 5. Judges of Israel
// --------------------------------------------------------------------------
function drawJudges(ctx) {
  const { page, layout, dict, color, fontRegular } = ctx;
  const csvText = ctx.files.get('db/judges.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);

  const coJudge = color['judges'] ?? [160, 210, 160];
  const coOpp = color['oppression'] ?? [200, 100, 100];

  for (const row of rows) {
    const start = floatDate(row.start);
    const end = floatDate(row.end);
    const xBox = xPosition(layout, start);
    const yBox = yPosition(layout, Number(row.row_y)) - 13;
    const xBoxwidth = xPosition(layout, end) - xPosition(layout, start);

    // peaceful period
    drawRect(page, layout, xBox, yBox, xBoxwidth, 2, { fill: coJudge, stroke: [0, 0, 0], strokeWidth: 0.2 });

    // oppression period before
    const oppression = Number(row.oppression || 0);
    const xOppression = xPosition(layout, start - oppression);
    const xOppWidth = xBox - xOppression;
    drawRect(page, layout, xOppression, yBox, xOppWidth, 2, { fill: coOpp, stroke: [0, 0, 0], strokeWidth: 0.2 });

    const judge = dict[row.key] ?? row.key;
    drawString(page, layout, judge, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox + xBoxwidth * 0.5, yTopDown: yBox + 4, position: 'c', whiteBackground: true });
  }
}

// --------------------------------------------------------------------------
// 6. Kings of Israel & Judah
// --------------------------------------------------------------------------
function drawKings(ctx) {
  const { page, layout, dict, color, fontRegular } = ctx;
  const csvText = ctx.files.get('db/kings.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);

  rows.forEach((row, index) => {
    const start = floatDate(row.start);
    const end = floatDate(row.end);
    let born = start;
    let detailBorn = '';

    if (floatDate(row.born) < 0) {
      born = floatDate(row.born);
      detailBorn = `, ${dict['became_king'] ?? 'became king'} ${Math.round(start - born)} ${dict['age_kings'] ?? 'yrs'}`;
    }

    let detail = `${dict[row.key] ?? row.key} (`;
    const y = Number(row.years || 0);
    const m = Number(row.months || 0);
    const d = Number(row.days || 0);

    if (y > 0) detail += `${y} ${y > 1 ? (dict['years'] ?? 'years') : (dict['year'] ?? 'year')} `;
    if (m > 0) detail += `${m} ${m > 1 ? (dict['months'] ?? 'months') : (dict['month'] ?? 'month')} `;
    if (d > 0) detail += `${d} ${dict['days'] ?? 'days'} `;

    detail += `${-historicalYear(start)}-${-historicalYear(end)})${detailBorn}`;

    const xBox = xPosition(layout, start);
    const xBorn = xPosition(layout, born);
    const yBox = yPosition(layout, Number(row.row_y)) - 10;
    const xBoxwidth = xPosition(layout, end) - xPosition(layout, start);

    // T-graph before becoming king
    drawLine(page, layout, xBorn, yBox + 6, xBox, yBox + 6, [0, 0, 0], 0.3);
    drawLine(page, layout, xBorn, yBox + 1, xBorn, yBox + 11, [0, 0, 0], 0.3);

    // reign box
    const co = color[row.key] ?? [200, 180, 140];
    drawRect(page, layout, xBox, yBox, xBoxwidth, 12, { fill: co, stroke: [0, 0, 0], strokeWidth: 0.3 });

    if (index < 23) {
      drawString(page, layout, detail, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox + xBoxwidth + 2 * ctx.directionFactor, yTopDown: yBox + 1, position: ctx.direction, whiteBackground: true });
    } else {
      drawString(page, layout, detail, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox - 2 * ctx.directionFactor, yTopDown: yBox + 1, position: ctx.directionRl, whiteBackground: true });
    }
  });
}

// --------------------------------------------------------------------------
// Timebar Helper for Prophets, Books, People, Objects
// --------------------------------------------------------------------------
function fadedColor(r, g, b, percent) {
  return [
    Math.round(255 - percent * (255 - r)),
    Math.round(255 - percent * (255 - g)),
    Math.round(255 - percent * (255 - b))
  ];
}

function timebar(ctx, x, y, width, co, exact) {
  const { page, layout } = ctx;
  let xBox = x;
  let w = width;
  if (w < 0) {
    xBox += w;
    w = -w;
  }
  drawRect(page, layout, xBox, y, w, 4, { fill: co });
  if (exact) return;

  const fadeSteps = 15;
  for (let i = 0; i < fadeSteps; i++) {
    const cl = fadedColor(co[0], co[1], co[2], (i + 1) / fadeSteps);
    drawRect(page, layout, xBox + (3 * i) / fadeSteps - 0.1, y, 1, 4, { fill: cl });
    drawRect(page, layout, xBox + w - (3 * i) / fadeSteps, y, 1, 4, { fill: cl });
  }
}

function textWithTimebar(ctx, text, rowY, yearStart, yearEnd, co, exact) {
  const { page, layout, fontRegular } = ctx;
  const xBox = xPosition(layout, yearStart);
  const yBox = yPosition(layout, rowY) - 9;
  const xBoxwidth = xPosition(layout, yearEnd) - xPosition(layout, yearStart);

  timebar(ctx, xBox, yBox - 6, xBoxwidth, co, exact);
  drawString(page, layout, text, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox, yTopDown: yBox, position: ctx.direction, whiteBackground: true });
}

// --------------------------------------------------------------------------
// 7. Prophets
// --------------------------------------------------------------------------
function drawProphets(ctx) {
  const csvText = ctx.files.get('db/prophets.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  const co = ctx.color['prophets'] ?? [180, 160, 220];
  for (const row of rows) {
    textWithTimebar(ctx, ctx.dict[row.key] ?? row.key, Number(row.row_y), floatDate(row.start), floatDate(row.end), co, false);
  }
}

// --------------------------------------------------------------------------
// 8. Bible Books
// --------------------------------------------------------------------------
function drawBooks(ctx) {
  const csvText = ctx.files.get('db/books.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  const co = ctx.color['books'] ?? [140, 180, 240];
  for (const row of rows) {
    textWithTimebar(ctx, ctx.dict[row.key] ?? row.key, Number(row.row_y), floatDate(row.start), floatDate(row.end), co, false);
  }
}

// --------------------------------------------------------------------------
// 9. Other Historical People
// --------------------------------------------------------------------------
function drawPeople(ctx) {
  const csvText = ctx.files.get('db/people.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  const co = ctx.color['people'] ?? [220, 190, 140];
  for (const row of rows) {
    const exact = row.exact === 'y';
    textWithTimebar(ctx, ctx.dict[row.key] ?? row.key, Number(row.row_y), floatDate(row.start), floatDate(row.end), co, exact);
  }
}

// --------------------------------------------------------------------------
// 10. Objects & Artifacts
// --------------------------------------------------------------------------
function drawObjects(ctx) {
  const { page, layout, fontCuneiform, fontRegular } = ctx;
  const csvText = ctx.files.get('db/objects.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  const co = ctx.color['objects'] ?? [210, 160, 140];
  const cunei = new Set(['gilgamesh', 'ur3', 'hammurabi']);

  for (const row of rows) {
    if (cunei.has(row.key)) {
      const xBoxwidth = xPosition(layout, floatDate(row.end)) - xPosition(layout, floatDate(row.start));
      timebar(ctx, xPosition(layout, floatDate(row.start)), yPosition(layout, Number(row.row_y)) - 15, xBoxwidth, co, false);
      const text = ctx.dict[row.key] ?? row.key;
      drawString(page, layout, text, { font: fontCuneiform, size: 9, x: xPosition(layout, floatDate(row.start)), yTopDown: yPosition(layout, Number(row.row_y)) - 8, position: ctx.direction, whiteBackground: true });
    } else {
      textWithTimebar(ctx, ctx.dict[row.key] ?? row.key, Number(row.row_y), floatDate(row.start), floatDate(row.end), co, false);
    }
  }
}

// --------------------------------------------------------------------------
// 11. Periods / Empires / Dynasties
// --------------------------------------------------------------------------
function drawPeriods(ctx) {
  const { page, layout, dict, color, fontBold, fontRegular } = ctx;
  const csvText = ctx.files.get('db/periods.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);

  for (const row of rows) {
    const start = floatDate(row.start);
    const end = floatDate(row.end);
    const key = row.key;
    const xBox = xPosition(layout, start);
    let yBox = yPosition(layout, Number(row.row_y)) - 9;
    let xBoxwidth = xPosition(layout, end) - xPosition(layout, start);

    if (row.key === 'millenium' && ctx.edition === 'print') {
      xBoxwidth = xPosition(layout, end + 230) - xPosition(layout, start);
    }

    const co = color[key] ?? [180, 180, 180];
    const hasBorder = row.border && row.border.trim() !== '' && row.border !== '0';

    drawRect(page, layout, xBox, yBox - 1, xBoxwidth, 12, {
      fill: co,
      stroke: hasBorder ? [0, 0, 0] : undefined,
      strokeWidth: 0.3
    });

    // Fading at end
    if (row.end_fade && row.end_fade.trim() !== '' && floatDate(row.end_fade) > floatDate(row.end)) {
      const fadeWidth = xPosition(layout, floatDate(row.end_fade)) - xPosition(layout, floatDate(row.end));
      const fadeSteps = 25;
      for (let i = 0; i < fadeSteps; i++) {
        const cl = fadedColor(co[0], co[1], co[2], (i + 1) / fadeSteps);
        drawRect(page, layout, xBox + xBoxwidth + (fadeWidth * i) / fadeSteps, yBox - 1, fadeWidth / fadeSteps + 0.2, 12, { fill: cl });
      }
    }

    // Fading at start
    if (row.start_fade && row.start_fade.trim() !== '' && floatDate(row.start_fade) < floatDate(row.start)) {
      const fadeWidth = xPosition(layout, floatDate(row.start)) - xPosition(layout, floatDate(row.start_fade));
      const xStartFade = xPosition(layout, floatDate(row.start_fade));
      const fadeSteps = 25;
      for (let i = 0; i < fadeSteps; i++) {
        const cl = fadedColor(co[0], co[1], co[2], (fadeSteps - i) / fadeSteps);
        drawRect(page, layout, xStartFade + (fadeWidth * i) / fadeSteps, yBox - 1, fadeWidth / fadeSteps + 0.2, 12, { fill: cl });
      }
    }

    // Center text
    if (row.text_center && row.text_center.trim() !== '') {
      const detailC = dict[row.text_center] ?? row.text_center;
      let textsize = ctx.fontsizeRegular;
      while (fontBold.widthOfTextAtSize(detailC, textsize) > Math.abs(xBoxwidth) && textsize > 4) {
        textsize -= 1;
      }
      drawString(page, layout, detailC, { font: fontBold, size: textsize, x: xBox + xBoxwidth * 0.5, yTopDown: yBox + 1, position: 'c', color: [255, 255, 255] });
    }

    // Text left & right
    if (row.text_left && row.text_left.trim() !== '') {
      drawString(page, layout, dict[row.text_left] ?? row.text_left, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox - 2 * ctx.directionFactor, yTopDown: yBox + 1, position: ctx.directionRl, whiteBackground: true });
    }
    if (row.text_right && row.text_right.trim() !== '') {
      drawString(page, layout, dict[row.text_right] ?? row.text_right, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox + xBoxwidth + 2 * ctx.directionFactor, yTopDown: yBox + 1, position: ctx.direction, whiteBackground: true });
    }
  }
}

// --------------------------------------------------------------------------
// 12. Roman Caesars
// --------------------------------------------------------------------------
function drawCaesars(ctx) {
  const { page, layout, dict, color, fontRegular } = ctx;
  const csvText = ctx.files.get('db/caesars.csv');
  if (!csvText) return;
  const rows = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
  const co = color['caesars'] ?? [210, 190, 120];

  for (const row of rows) {
    const born = floatDate(row.born);
    const start = floatDate(row.start);
    const end = floatDate(row.end);

    let detail = `${dict[row.key] ?? row.key} `;
    if (start < 0) detail += `${Math.round(-start + 1)} ${dict['BCE'] ?? 'BCE'} - `;
    else detail += `${Math.round(start)}-`;

    if (end < 0) detail += ` ${Math.round(-end + 1)} ${dict['BCE'] ?? 'BCE'}`;
    else detail += `${Math.round(end)} ${dict['CE'] ?? 'CE'}`;

    const xBox = xPosition(layout, start);
    const xBorn = xPosition(layout, born);
    const yBox = yPosition(layout, Number(row.row_y)) - 10;
    const xBoxwidth = xPosition(layout, end) - xPosition(layout, start);

    drawLine(page, layout, xBorn, yBox + 6, xBox, yBox + 6, [0, 0, 0], 0.3);
    drawLine(page, layout, xBorn, yBox + 1, xBorn, yBox + 11, [0, 0, 0], 0.3);

    drawRect(page, layout, xBox, yBox, xBoxwidth, 12, { fill: co, stroke: [0, 0, 0], strokeWidth: 0.3 });
    drawString(page, layout, detail, { font: fontRegular, size: ctx.fontsizeRegular, x: xBox + xBoxwidth + 2 * ctx.directionFactor, yTopDown: yBox + 2, position: ctx.direction });
  }
}

// --------------------------------------------------------------------------
// 13. Great Tribulation / Time of the End
// --------------------------------------------------------------------------
function drawTribulation(ctx) {
  const { page, layout, dict, color, fontRegular } = ctx;
  const tribulationLine = 23.25;
  const refY = yPosition(layout, tribulationLine);

  drawString(page, layout, dict['tribulation'] ?? 'Great Tribulation', {
    font: fontRegular,
    size: ctx.fontsizeRegular,
    x: xPosition(layout, 2027),
    yTopDown: refY - 1,
    position: ctx.directionRl,
    whiteBackground: true
  });

  const co1 = color['tribulation1'] ?? [230, 80, 80];
  const co2 = color['tribulation2'] ?? [210, 50, 50];
  const co3 = color['tribulation3'] ?? [180, 30, 30];

  drawRect(page, layout, xPosition(layout, 2030), refY, xPosition(layout, 2035) - xPosition(layout, 2030), 10, { fill: co1 });
  drawRect(page, layout, xPosition(layout, 2053), refY, xPosition(layout, 2060) - xPosition(layout, 2053), 10, { fill: co1 });

  for (let falter = 0; falter < 3; falter++) {
    const xf = xPosition(layout, 2035 + 6 * falter);
    const yf = refY - 1.64;
    const d = ctx.directionFactor;

    const p1 = [
      [xf, yf + 1.64],
      [xf + 1.64 * d, yf],
      [xf + 1.64 * d, yf + 10],
      [xf, yf + 11.64]
    ];
    drawPolygon(page, layout, p1, { fill: co2 });

    const p2 = [
      [xf + 3.3 * d, yf + 1.64],
      [xf + 1.64 * d, yf],
      [xf + 1.64 * d, yf + 10],
      [xf + 3.3 * d, yf + 11.64]
    ];
    drawPolygon(page, layout, p2, { fill: co3 });
  }
}

// --------------------------------------------------------------------------
// 14. Terah's Family Tree + Footnotes
// --------------------------------------------------------------------------
function drawTerahFamilyTree(ctx) {
  const { page, layout, dict, color, fontRegular } = ctx;
  const linesCsv = ctx.files.get('db/terah-lines.csv');
  const familyCsv = ctx.files.get('db/terah-family.csv');
  const footnotesCsv = ctx.files.get('db/terah-footnotes.csv');

  if (linesCsv) {
    const lines = Papa.parse(linesCsv, { header: true }).data.filter((r) => r.start);
    const shiftLines = -0.33;
    for (const row of lines) {
      const isMarried = row.type === 'married';
      const col = isMarried ? [13, 155, 13] : [0, 0, 0];
      const lw = isMarried ? 1.0 : 0.3;
      const x1 = xPosition(layout, -Number(row.start));
      const y1 = yPosition(layout, Number(row.start_row) + shiftLines);
      const x2 = xPosition(layout, -Number(row.end));
      const y2 = yPosition(layout, Number(row.end_row) + shiftLines);
      drawLine(page, layout, x1, y1, x2, y2, col, lw * layout.scale);
    }
  }

  if (familyCsv) {
    const terah = Papa.parse(familyCsv, { header: true }).data.filter((r) => r.key);
    const red = color['terah_red'] ?? [180, 40, 40];
    const blue = color['terah_blue'] ?? [30, 40, 180];

    for (const row of terah) {
      const person = dict[row.key] ?? row.key;
      const x = xPosition(layout, -Number(row.left));
      const y = yPosition(layout, Number(row.row)) - 9;
      const col = row.color === 'red' ? red : blue;
      drawString(page, layout, person, {
        font: fontRegular,
        size: 10 * layout.scale,
        x,
        yTopDown: y,
        position: 'c',
        whiteBackground: true,
        color: col
      });
    }
  }

  if (footnotesCsv) {
    const footnotes = Papa.parse(footnotesCsv, { header: true }).data.filter((r) => r.key);
    const fsize = ctx.fontsizeRegular - 2;
    for (const row of footnotes) {
      const textFn = dict[`${row.key}_fn`] ?? `${row.key}_fn`;
      drawString(page, layout, textFn, {
        font: fontRegular,
        size: fsize,
        x: xPosition(layout, Number(row.year)),
        yTopDown: yPosition(layout, Number(row.row)),
        position: 'r',
        whiteBackground: true
      });
    }
  }
}

// --------------------------------------------------------------------------
// 15. Raster Images
// --------------------------------------------------------------------------
async function includePictures(ctx) {
  const { layout, fontRegular } = ctx;
  const csvText = ctx.files.get('db/pictures.csv');
  if (!csvText) return;
  const pictures = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);

  for (const row of pictures) {
    const location = `images/${row.key}`;
    let localX = xPosition(layout, Number(row.x));
    const localY = yPosition(layout, Number(row.y));
    const w = Number(row.width) * MM * layout.scale;
    const h = Number(row.height) * MM * layout.scale;

    if (row.year && row.year !== '0') {
      drawString(ctx.page, layout, String(row.year), {
        font: fontRegular,
        size: 5.9,
        x: localX,
        yTopDown: localY,
        position: ctx.direction,
        whiteBackground: true
      });
    }

    if (!ctx.leftToRight) {
      localX -= w;
    }

    await drawImage(ctx, location, localX, localY - (h - 0.4 * layout.scale), w, h);
  }
}

// --------------------------------------------------------------------------
// 16. SVG Images & World Population
// --------------------------------------------------------------------------
async function includePicturesSvg(ctx) {
  const { page, layout, dict, color, fontRegular } = ctx;
  const csvText = ctx.files.get('db/pictures_svg.csv');
  if (csvText) {
    const picturesSvg = Papa.parse(csvText, { header: true }).data.filter((r) => r.key);
    for (const row of picturesSvg) {
      const location = `images/${row.key}.svg`;
      let localX = xPosition(layout, Number(row.x));
      let localY = yPosition(layout, Number(row.y));

      if (row.key === 'world_population') {
        localX = xPosition(layout, -4090);
        localY = yPosition(layout, 45.3);
      }

      if (row.year && row.year !== '0') {
        drawString(page, layout, String(row.year), {
          font: fontRegular,
          size: 5.9,
          x: localX,
          yTopDown: localY - 1,
          position: ctx.direction,
          whiteBackground: true
        });
      }

      const w = Number(row.width || 20) * layout.scale;
      const h = Number(row.height || 20) * layout.scale;

      if (!ctx.leftToRight) {
        localX -= w;
      }

      // Try drawing embedded SVG/raster if available
      await drawImage(ctx, location, localX, localY - h - 1.2, w, h);
    }
  }

  // World Population Text & Source
  const popX = xPosition(layout, -4075);
  const popY = 33;
  const popColor = color['world_population'] ?? [25, 25, 160];

  drawString(page, layout, dict['world_population'] ?? 'World Population', {
    font: fontRegular,
    size: 10,
    x: popX,
    yTopDown: yPosition(layout, popY),
    position: ctx.direction,
    color: popColor
  });

  drawString(page, layout, 'source: https://www.worldometers.info/world-population/#table-historical', {
    font: fontRegular,
    size: 4,
    x: popX,
    yTopDown: yPosition(layout, popY + 1),
    position: ctx.direction,
    color: [25, 25, 160]
  });
}

// --------------------------------------------------------------------------
// 17. Daniel 2 Statue & World Powers
// --------------------------------------------------------------------------
async function drawDaniel2(ctx) {
  const { page, layout, dict, color, fontBold, fontRegular } = ctx;
  const leftX = -4075;
  const shiftUpward = 70 * MM * layout.scale;
  const d2Height = 96 * MM * layout.scale;
  const d2Width = (d2Height / 748) * 240;

  const kingdoms = ['Babylon', 'Medopersia', 'Greece', 'Rome', 'Angloamerica'];
  const years = ['607BCE', '', '539BCE', '537BCE', '', '331BCE', '', '63BCE', '70CE', '1914CE', '', ''];
  const yearlines = [2, 3, 2, 2, 3];
  let currentYearline = 0;

  const co = color['daniel2'] ?? [180, 140, 50];

  for (let index = 0; index < kingdoms.length; index++) {
    const kingdom = kingdoms[index];
    const yLine = layout.y2 - shiftUpward - d2Height * (0.91 - index * 0.212);

    drawLine(page, layout, xPosition(layout, leftX + 226), yLine, xPosition(layout, leftX), yLine, co, 0.4);

    drawString(page, layout, dict[`${kingdom}_c`] ?? `${kingdom}_c`, {
      font: fontBold,
      size: 12,
      x: xPosition(layout, leftX),
      yTopDown: yLine + 2,
      position: ctx.direction,
      color: co
    });

    drawString(page, layout, dict[kingdom] ?? kingdom, {
      font: fontRegular,
      size: 8,
      x: xPosition(layout, leftX),
      yTopDown: yLine + 15.4,
      position: ctx.direction,
      color: [50, 50, 50]
    });

    let currentYearstring = '';
    if (years[currentYearline] && years[currentYearline] !== '') {
      currentYearstring = dict[years[currentYearline]] ?? years[currentYearline];
    }
    const indent = fontRegular.widthOfTextAtSize(currentYearstring, 6) + 3;

    for (let yl = 0; yl < yearlines[index]; yl++) {
      let yearstr = ' ';
      if (years[currentYearline] && years[currentYearline] !== '') {
        yearstr = dict[years[currentYearline]] ?? years[currentYearline];
      }
      drawString(page, layout, yearstr, {
        font: fontRegular,
        size: 6,
        x: xPosition(layout, leftX),
        yTopDown: yLine + 25.2 + 8 * yl,
        position: ctx.direction,
        color: [50, 50, 50]
      });

      const lineD2Key = `daniel2_${currentYearline + 1}`;
      drawString(page, layout, dict[lineD2Key] ?? '', {
        font: fontRegular,
        size: 6,
        x: xPosition(layout, leftX) + indent * ctx.directionFactor,
        yTopDown: yLine + 25.2 + 8 * yl,
        position: ctx.direction,
        color: [50, 50, 50]
      });
      currentYearline++;
    }
  }

  // Draw Daniel 2 statue image
  let d2X = xPosition(layout, leftX + 176);
  if (!ctx.leftToRight) {
    d2X -= d2Width;
  }
  await drawImage(ctx, 'images/daniel2_fiverr2.svg', d2X, layout.y2 - shiftUpward - d2Height, d2Width, d2Height);
}

// --------------------------------------------------------------------------
// 18. QR Code, Timestamp & Credits
// --------------------------------------------------------------------------
async function drawTimestamp(ctx) {
  const { page, layout, fontRegular, langCode } = ctx;
  const qrX = -4075;
  const qrY = 3.8;
  const qrSize = 15 * MM * layout.scale;

  // Draw QR code image
  const qrFile = `images/qr-${langCode}.png`;
  let imgX = xPosition(layout, qrX);
  if (!ctx.leftToRight) {
    imgX -= qrSize;
  }
  await drawImage(ctx, qrFile, imgX, yPosition(layout, qrY), qrSize, qrSize);

  // Footer text
  const dateStr = new Date().toISOString().slice(0, 10);
  const footerText = `timeline.js v6.06 – created ${dateStr} – https://github.com/kreier/timeline – license: Apache 2.0 – images: CC BY-SA`;
  drawString(page, layout, footerText, {
    font: fontRegular,
    size: 5,
    x: xPosition(layout, -4075),
    yTopDown: layout.y2 - 6,
    position: ctx.direction,
    color: [70, 70, 70]
  });

  // Vertical text rotated next to QR code
  try {
    const textLabel = `timeline ${langCode}`;
    const textX = xPosition(layout, qrX) + (ctx.leftToRight ? qrSize + 2 : -4);
    const textY = toPdfY(layout, yPosition(layout, qrY + 1.2));
    page.drawText(textLabel, {
      x: textX,
      y: textY,
      size: 5,
      font: fontRegular,
      rotate: degrees(ctx.leftToRight ? -90 : 90),
      color: rgbColor([80, 80, 80])
    });
  } catch (e) {
    // Non-critical rotation fallback
  }
}

export const _internal = {
  drawHorizontalAxis,
  drawAdamMoses,
  drawReferenceEvents,
  drawEventObjects,
  drawJudges,
  drawKings,
  drawProphets,
  drawBooks,
  drawPeople,
  drawObjects,
  drawPeriods,
  drawCaesars,
  drawTribulation,
  drawTerahFamilyTree,
  includePictures,
  includePicturesSvg,
  drawDaniel2,
  drawTimestamp
};
