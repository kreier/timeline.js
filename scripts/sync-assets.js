import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

const RAW_BASE = 'https://raw.githubusercontent.com/kreier/timeline/main';
const API_COMMIT_URL = 'https://api.github.com/repos/kreier/timeline/commits/main';

const STATIC_CSV = [
  'db/dictionary_reference.csv',
  'db/dictionary_en.csv',
  'db/dictionary_de.csv',
  'db/dictionary_vi.csv',
  'db/dictionary_fr.csv',
  'db/dictionary_it.csv',
  'db/dictionary_tl.csv',
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
];

const FIXED_IMAGES = [
  'images/qr-en.png',
  'images/qr-de.png',
  'images/qr-vi.png',
  'images/qr-fr.png',
  'images/qr-it.png',
  'images/qr-tl.png',
  'images/daniel2_fiverr2.svg',
  'images/daniel2_fiverr2_rtl.svg'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchFile(relPath) {
  const targetPath = path.join(PUBLIC_DIR, relPath);
  ensureDir(path.dirname(targetPath));

  const url = `${RAW_BASE}/${relPath}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  [SKIP] ${relPath} (HTTP ${res.status})`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(targetPath, buffer);
    console.log(`  [OK] ${relPath} (${buffer.length} bytes)`);
    return true;
  } catch (err) {
    console.warn(`  [ERR] ${relPath}: ${err.message}`);
    return false;
  }
}

async function getUpstreamCommit() {
  try {
    const headers = { 'User-Agent': 'timeline-js-sync-script' };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(API_COMMIT_URL, { headers });
    if (res.ok) {
      const data = await res.json();
      return {
        sha: data.sha,
        shortSha: data.sha.substring(0, 7),
        date: data.commit?.committer?.date || new Date().toISOString(),
        message: data.commit?.message?.split('\n')[0] || ''
      };
    }
  } catch (e) {
    console.warn('Could not fetch upstream commit info:', e.message);
  }
  return { sha: 'unknown', shortSha: 'unknown', date: new Date().toISOString(), message: '' };
}

async function parsePicturesCsv() {
  const picturesCsvPath = path.join(PUBLIC_DIR, 'db/pictures.csv');
  const picturesSvgPath = path.join(PUBLIC_DIR, 'db/pictures_svg.csv');
  const images = new Set();

  if (fs.existsSync(picturesCsvPath)) {
    const content = fs.readFileSync(picturesCsvPath, 'utf-8');
    const lines = content.split(/\r?\n/).slice(1);
    for (const line of lines) {
      const parts = line.split(',');
      const key = parts[0]?.trim();
      if (key) images.add(`images/${key}`);
    }
  }

  if (fs.existsSync(picturesSvgPath)) {
    const content = fs.readFileSync(picturesSvgPath, 'utf-8');
    const lines = content.split(/\r?\n/).slice(1);
    for (const line of lines) {
      const parts = line.split(',');
      const key = parts[0]?.trim();
      if (key) images.add(`images/${key}.svg`);
    }
  }

  return Array.from(images);
}

async function main() {
  console.log('=== Syncing assets from kreier/timeline to public/ ===');
  ensureDir(PUBLIC_DIR);

  const upstreamInfo = await getUpstreamCommit();
  console.log(`Upstream commit: ${upstreamInfo.shortSha} (${upstreamInfo.date})`);

  let successCount = 0;

  console.log('\n--- Syncing CSVs ---');
  for (const csv of STATIC_CSV) {
    if (await fetchFile(csv)) successCount++;
  }

  console.log('\n--- Syncing Fonts ---');
  for (const font of STATIC_FONTS) {
    if (await fetchFile(font)) successCount++;
  }

  console.log('\n--- Syncing Fixed Images ---');
  for (const img of FIXED_IMAGES) {
    if (await fetchFile(img)) successCount++;
  }

  console.log('\n--- Syncing Dynamic Images from pictures.csv ---');
  const dynamicImages = await parsePicturesCsv();
  for (const img of dynamicImages) {
    if (await fetchFile(img)) successCount++;
  }

  // Write build info manifest
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  const buildInfo = {
    version: pkg.version,
    syncedAt: new Date().toISOString(),
    upstream: {
      repo: 'kreier/timeline',
      branch: 'main',
      sha: upstreamInfo.sha,
      shortSha: upstreamInfo.shortSha,
      date: upstreamInfo.date,
      message: upstreamInfo.message
    },
    totalFiles: successCount
  };

  fs.writeFileSync(path.join(PUBLIC_DIR, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
  console.log(`\n✓ Synced ${successCount} files into public/. Wrote build-info.json.\n`);
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
