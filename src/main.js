import Papa from 'papaparse';
import { downloadAssets, getExpectedAssets } from './modules/assets.js';
import { generateTimelinePdf } from './modules/pdf/generator.js';
import { STEPS } from './modules/pdf/steps.js';

const state = {
  files: null,
  langCode: 'en',
  categoryStats: {
    dictionaries: { loaded: 0, total: 2 },
    data: { loaded: 0, total: 14 },
    fonts: { loaded: 0, total: 4 },
    images: { loaded: 0, total: 3 }
  },
  logEntriesCount: 0
};

const $ = (sel) => document.querySelector(sel);

function log(container, msg, kind = '') {
  const line = document.createElement('div');
  if (kind) line.className = kind;
  line.textContent = msg;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
  state.logEntriesCount++;
  const countEl = $('#logCount');
  if (countEl) {
    countEl.textContent = `${state.logEntriesCount} entries`;
  }
}

function renderStepList() {
  const ul = $('#stepList');
  if (!ul) return;
  ul.innerHTML = '';
  for (const step of STEPS) {
    const li = document.createElement('li');
    li.className = 'step-item';

    const left = document.createElement('div');
    left.className = 'step-item-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `step-${step.id}`;
    checkbox.className = 'step-checkbox';
    checkbox.checked = step.default;
    checkbox.disabled = step.status !== 'done';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = checkbox.id;
    labelEl.className = `step-label ${step.status !== 'done' ? 'disabled-label' : ''}`;
    labelEl.textContent = step.label;

    if (step.status !== 'done') {
      const badge = document.createElement('span');
      badge.className = 'badge-unported';
      badge.textContent = 'not yet ported';
      labelEl.appendChild(badge);
    }

    left.append(checkbox, labelEl);

    const fn = document.createElement('span');
    fn.className = 'step-fn';
    fn.textContent = `${step.pyFn}()`;

    li.append(left, fn);
    ul.appendChild(li);
  }
}

function initAssetLists(langCode) {
  const expected = getExpectedAssets(langCode);
  const categories = ['dictionaries', 'data', 'fonts', 'images'];

  for (const cat of categories) {
    const listEl = $(`#list-${cat}`);
    const badgeEl = $(`#badge-${cat}`);
    if (!listEl) continue;

    const files = expected[cat] || [];
    state.categoryStats[cat] = {
      loaded: 0,
      total: files.length
    };

    if (badgeEl) {
      badgeEl.textContent = `0/${files.length}`;
      badgeEl.className = 'counter-badge';
    }

    listEl.innerHTML = '';
    for (const filePath of files) {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.id = `file-${btoa(unescape(encodeURIComponent(filePath))).replace(/=/g, '')}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-name';
      nameSpan.title = filePath;
      nameSpan.textContent = filePath;

      const statusSpan = document.createElement('span');
      statusSpan.className = 'file-status status-pending';
      statusSpan.textContent = 'pending';

      li.append(nameSpan, statusSpan);
      listEl.appendChild(li);
    }
  }
}

function updateFileStatus(category, filePath, status, error) {
  const fileId = `file-${btoa(unescape(encodeURIComponent(filePath))).replace(/=/g, '')}`;
  let li = document.getElementById(fileId);
  const listEl = $(`#list-${category}`);

  // Dynamic file discovered (e.g. from pictures.csv)
  if (!li && listEl) {
    li = document.createElement('li');
    li.className = 'file-item';
    li.id = fileId;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.title = filePath;
    nameSpan.textContent = filePath;

    const statusSpan = document.createElement('span');
    statusSpan.className = `file-status status-${status}`;
    statusSpan.textContent = status === 'ok' ? 'ready' : (status === 'skip' ? 'skipped' : status);

    li.append(nameSpan, statusSpan);
    listEl.appendChild(li);

    if (state.categoryStats[category]) {
      state.categoryStats[category].total++;
    }
  } else if (li) {
    const statusSpan = li.querySelector('.file-status');
    if (statusSpan) {
      statusSpan.className = `file-status status-${status}`;
      statusSpan.textContent = status === 'ok' ? 'ready' : (status === 'skip' ? 'skipped' : (status === 'err' ? 'error' : status));
      if (error) {
        statusSpan.title = error;
      }
    }
  }

  if (status === 'ok' && state.categoryStats[category]) {
    state.categoryStats[category].loaded++;
  }

  // Update badge
  const badgeEl = $(`#badge-${category}`);
  if (badgeEl && state.categoryStats[category]) {
    const { loaded, total } = state.categoryStats[category];
    badgeEl.textContent = `${loaded}/${total}`;
    if (loaded >= total && total > 0) {
      badgeEl.className = 'counter-badge badge-ready';
    } else if (loaded > 0) {
      badgeEl.className = 'counter-badge badge-loading';
    }
  }
}

function enabledStepIds() {
  return new Set(STEPS.filter((s) => document.getElementById(`step-${s.id}`)?.checked).map((s) => s.id));
}

async function handleDownload() {
  const logEl = $('#assetLog');
  logEl.innerHTML = '';
  const btn = $('#btnDownload');
  const langCode = $('#languageSelect').value;
  state.langCode = langCode;

  initAssetLists(langCode);

  const statusEl = $('#overallAssetStatus');
  if (statusEl) {
    statusEl.textContent = 'Downloading assets...';
    statusEl.className = 'status-indicator status-loading';
  }

  btn.disabled = true;
  try {
    const { files } = await downloadAssets(
      langCode,
      (msg, kind) => log(logEl, msg, kind),
      Papa,
      (info) => updateFileStatus(info.category, info.path, info.status, info.error)
    );

    state.files = files;
    log(logEl, `Download complete: ${files.size} files loaded in memory.`, 'ok');

    if (statusEl) {
      statusEl.textContent = `Ready (${files.size} files)`;
      statusEl.className = 'status-indicator status-ok';
    }

    // Enable render section & buttons
    $('#step-select')?.removeAttribute('aria-disabled');
    const btnRender = $('#btnRender');
    const btnUpdate = $('#btnUpdate');
    if (btnRender) btnRender.disabled = false;
    if (btnUpdate) btnUpdate.disabled = false;
  } catch (e) {
    log(logEl, `Download failed: ${e.message}`, 'err');
    if (statusEl) {
      statusEl.textContent = 'Download error';
      statusEl.className = 'status-indicator';
    }
  } finally {
    btn.disabled = false;
  }
}

async function handleRender() {
  const logEl = $('#renderLog');
  logEl.innerHTML = '';
  const downloadLink = $('#downloadLink');
  downloadLink.style.display = 'none';

  if (!state.files) {
    log(logEl, 'Please download assets first (Step 1)', 'err');
    return;
  }

  const edition = $('#editionSelect').value;
  const btn = $('#btnRender');
  const btnUpdate = $('#btnUpdate');
  btn.disabled = true;
  if (btnUpdate) btnUpdate.disabled = true;

  try {
    log(logEl, `Rendering timeline PDF (${state.langCode}, ${edition} edition)...`);
    const bytes = await generateTimelinePdf(
      state.files,
      state.langCode,
      edition,
      enabledStepIds(),
      (msg, kind) => log(logEl, msg, kind)
    );
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = `timeline_${state.langCode}_${edition}.pdf`;
    downloadLink.style.display = 'inline-flex';
    log(logEl, 'PDF generated successfully. Click "Save PDF" to download.', 'ok');
  } catch (e) {
    log(logEl, `Render failed: ${e.message}`, 'err');
    console.error(e);
  } finally {
    btn.disabled = false;
    if (btnUpdate) btnUpdate.disabled = false;
  }
}

// Select/Deselect all steps
function handleToggleAllSteps(checked) {
  for (const step of STEPS) {
    if (step.status === 'done') {
      const checkbox = document.getElementById(`step-${step.id}`);
      if (checkbox) checkbox.checked = checked;
    }
  }
}

// Initial setup
renderStepList();
initAssetLists($('#languageSelect')?.value || 'en');

$('#languageSelect')?.addEventListener('change', (e) => {
  if (!state.files) {
    initAssetLists(e.target.value);
  }
});

$('#btnDownload')?.addEventListener('click', handleDownload);
$('#btnRender')?.addEventListener('click', handleRender);
$('#btnUpdate')?.addEventListener('click', handleRender);

$('#btnSelectAll')?.addEventListener('click', () => handleToggleAllSteps(true));
$('#btnDeselectAll')?.addEventListener('click', () => handleToggleAllSteps(false));
