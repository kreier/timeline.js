import Papa from 'papaparse';
import { downloadAssets } from './modules/assets.js';
import { generateTimelinePdf } from './modules/pdf/generator.js';
import { STEPS } from './modules/pdf/steps.js';

const state = {
  files: null,
  langCode: null
};

const $ = (sel) => document.querySelector(sel);

function log(container, msg, kind = '') {
  const line = document.createElement('div');
  if (kind) line.className = kind;
  line.textContent = msg;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

function renderStepList() {
  const ul = $('#stepList');
  ul.innerHTML = '';
  for (const step of STEPS) {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `step-${step.id}`;
    checkbox.checked = step.default;
    checkbox.disabled = step.status !== 'done';
    const labelEl = document.createElement('label');
    labelEl.htmlFor = checkbox.id;
    labelEl.textContent = step.status === 'done' ? step.label : `${step.label} (not yet ported)`;
    const fn = document.createElement('span');
    fn.className = 'fn';
    fn.textContent = `${step.pyFn}()`;
    li.append(checkbox, labelEl, fn);
    ul.appendChild(li);
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
  btn.disabled = true;
  try {
    const { files } = await downloadAssets(langCode, (msg, kind) => log(logEl, msg, kind), Papa);
    state.files = files;
    state.langCode = langCode;
    log(logEl, `done - ${files.size} files ready in memory.`, 'ok');
    $('#step-select').removeAttribute('aria-disabled');
    $('#step-render').removeAttribute('aria-disabled');
  } catch (e) {
    log(logEl, `failed: ${e.message}`, 'err');
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
    log(logEl, 'download assets first (step 1)', 'err');
    return;
  }

  const edition = $('#editionSelect').value;
  const btn = $('#btnRender');
  btn.disabled = true;
  try {
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
    downloadLink.style.display = 'inline-block';
    log(logEl, 'PDF ready.', 'ok');
  } catch (e) {
    log(logEl, `failed: ${e.message}`, 'err');
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

renderStepList();
$('#btnDownload').addEventListener('click', handleDownload);
$('#btnRender').addEventListener('click', handleRender);
$('#btnUpdate').addEventListener('click', handleRender);
