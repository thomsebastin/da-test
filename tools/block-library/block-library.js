// Import DA App SDK (resolved at runtime from da.live).
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { parseCatalogSheet, findBlockInstance } from './parse-library.js';
import {
  sourceUrl, sheetUrl, editUrlForRow, resolveLinkedPage,
} from './da-context.js';
import { getConfig } from './config.js';

const app = document.querySelector('#bl-app');
const sourceLink = document.querySelector('#bl-source-link');
const refreshBtn = document.querySelector('#bl-refresh');

// `expanded` tracks which block names are open in the sidebar; `preview` tracks the
// currently previewed row: { entry, row, status: 'loading'|'ready'|'error', instance?, error? }
let state = { catalog: [], expanded: new Set(), preview: null };

// Only one preview iframe is ever live at a time, so its message listener is tracked here
// and torn down before the next one is wired up (rather than per-modal, since the panel —
// and its iframe — now persist across renders instead of being created/destroyed).
let teardownPreviewListener = null;

/** Fetch the catalog sheet's JSON from admin.da.live. */
async function fetchCatalogJson(context, token, libraryPath) {
  const res = await fetch(sourceUrl(context, libraryPath, 'json'), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 404) {
    const err = new Error('Catalog sheet not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!res.ok) throw new Error(`Could not load catalog sheet (${res.status})`);
  return res.json();
}

/** Fetch a catalog row's linked example page and extract the declared block instance. */
async function fetchRowInstance(context, token, row) {
  const url = resolveLinkedPage(context, row.path);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load example page (${res.status}): ${url}`);
  const html = await res.text();
  const instance = findBlockInstance(html, row.name);
  if (!instance) throw new Error(`Block "${row.name}" not found on the linked example page`);
  return instance;
}

/** Prettify the last path segment as a fallback label when a row has none. */
function basenameLabel(path) {
  const clean = path.replace(/^https?:\/\/[^/]+/, '').replace(/\.[^/.]+$/, '');
  const last = clean.split('/').filter(Boolean).pop() || 'default';
  return last.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function rowLabel(row) {
  return row.label || basenameLabel(row.path);
}

function previewLabel(row, instance) {
  if (row.label) return row.label;
  if (instance?.label) return instance.label;
  if (instance?.variants.length) return instance.variants.join(', ');
  return basenameLabel(row.path);
}

/** Select a row for preview and fetch its example lazily. */
function selectVariation(entry, row, root) {
  state.preview = {
    entry, row, status: 'loading',
  };
  // eslint-disable-next-line no-use-before-define
  render(root);

  fetchRowInstance(root.context, root.token, row).then((instance) => {
    state.preview = {
      entry, row, status: 'ready', instance,
    };
    // eslint-disable-next-line no-use-before-define
    render(root);
  }).catch((err) => {
    state.preview = {
      entry, row, status: 'error', error: err.message,
    };
    // eslint-disable-next-line no-use-before-define
    render(root);
  });
}

/** Render the sidebar: each block toggles open to reveal its variations inline. */
function renderNav(root) {
  const nav = document.createElement('nav');
  nav.className = 'bl-nav';
  const list = document.createElement('ul');

  state.catalog.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'bl-block';
    const isExpanded = state.expanded.has(entry.name);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'bl-block-toggle';
    toggle.setAttribute('aria-expanded', String(isExpanded));
    toggle.innerHTML = `
      <span class="bl-block-caret" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
      <span class="bl-block-name">${entry.name}</span>
      <span class="bl-nav-count">${entry.rows.length}</span>
    `;
    toggle.addEventListener('click', () => {
      if (isExpanded) state.expanded.delete(entry.name);
      else state.expanded.add(entry.name);
      // eslint-disable-next-line no-use-before-define
      render(root);
    });
    li.append(toggle);

    if (isExpanded) {
      const variationList = document.createElement('ul');
      variationList.className = 'bl-variation-list';
      entry.rows.forEach((row) => {
        const vLi = document.createElement('li');
        const vBtn = document.createElement('button');
        vBtn.type = 'button';
        vBtn.className = 'bl-variation-item';
        vBtn.classList.toggle(
          'is-active',
          state.preview?.entry === entry && state.preview?.row === row,
        );
        vBtn.textContent = rowLabel(row);
        vBtn.addEventListener('click', () => selectVariation(entry, row, root));
        vLi.append(vBtn);
        variationList.append(vLi);
      });
      li.append(variationList);
    }

    list.append(li);
  });

  nav.append(list);
  return nav;
}

/** Render the right-hand preview panel for the currently selected variation, if any. */
function renderPreviewPanel(root) {
  const section = document.createElement('section');
  section.className = 'bl-preview-panel';

  const { preview } = state;
  if (!preview) {
    section.innerHTML = '<p class="bl-status">Select a variation from the list to preview it here.</p>';
    return section;
  }

  const { entry, row, status } = preview;
  const title = document.createElement('h2');
  title.className = 'bl-preview-title';
  title.textContent = `${entry.name} — ${status === 'ready' ? previewLabel(row, preview.instance) : rowLabel(row)}`;
  section.append(title);

  if (status === 'loading') {
    const p = document.createElement('p');
    p.className = 'bl-status';
    p.textContent = 'Loading example…';
    section.append(p);
    return section;
  }

  if (status === 'error') {
    const p = document.createElement('p');
    p.className = 'bl-status bl-status-error';
    p.textContent = preview.error;
    section.append(p);
    return section;
  }

  const { instance } = preview;

  const iframe = document.createElement('iframe');
  iframe.className = 'bl-preview-frame';
  iframe.title = `Preview: ${entry.name} — ${previewLabel(row, instance)}`;
  iframe.src = './preview.html';

  if (teardownPreviewListener) teardownPreviewListener();
  const onMessage = (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.data?.type === 'block-library-preview-ready') {
      iframe.contentWindow.postMessage(
        { type: 'block-library-render', html: instance.html },
        window.location.origin,
      );
    }
    if (e.data?.type === 'block-library-preview-height') {
      iframe.style.height = `${Math.max(120, e.data.height)}px`;
    }
  };
  window.addEventListener('message', onMessage);
  teardownPreviewListener = () => window.removeEventListener('message', onMessage);

  const details = document.createElement('details');
  details.className = 'bl-raw-html';
  details.innerHTML = '<summary>View HTML</summary><pre><code></code></pre>';
  details.querySelector('code').textContent = instance.html;

  const footer = document.createElement('div');
  footer.className = 'bl-preview-footer';

  const editLink = document.createElement('a');
  editLink.className = 'bl-link';
  editLink.href = editUrlForRow(root.context, row.path);
  editLink.target = '_blank';
  editLink.rel = 'noopener';
  editLink.textContent = 'Edit example page';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy HTML';
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(instance.html);
    copyBtn.textContent = 'Copied!';
    window.setTimeout(() => { copyBtn.textContent = 'Copy HTML'; }, 1500);
  });

  const insertBtn = document.createElement('button');
  insertBtn.type = 'button';
  insertBtn.className = 'bl-btn-primary';
  insertBtn.textContent = 'Insert into open document';
  insertBtn.title = 'Only takes effect when opened as a library plugin alongside a document';
  insertBtn.addEventListener('click', () => {
    root.actions.sendHTML(instance.html);
    root.actions.closeLibrary();
  });

  footer.append(editLink, copyBtn, insertBtn);
  section.append(iframe, details, footer);
  return section;
}

function renderEmptyState(context, libraryPath, message) {
  app.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'bl-empty';
  wrap.innerHTML = `
    <p>${message}</p>
    <p>The catalog at <code>${libraryPath}</code> is a <strong>sheet</strong> of block
    examples: a <code>name</code> column (the block name) and a <code>path</code> column
    (link to a page containing an authored example of it) — same convention as DA's own
    <code>library</code> <code>blocks</code> sub-sheet. Add one row per variation; several
    rows can share a name, each pointing at its own example page. The library rebuilds
    itself from that sheet automatically.</p>
  `;
  const link = document.createElement('a');
  link.href = sheetUrl(context, libraryPath);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open catalog sheet in DA';
  wrap.append(link);
  app.append(wrap);
}

function render(root) {
  app.innerHTML = '';
  const layout = document.createElement('div');
  layout.className = 'bl-layout';
  layout.append(renderNav(root), renderPreviewPanel(root));
  app.append(layout);
}

async function load(context, token, actions, libraryPath) {
  app.innerHTML = '<p class="bl-status">Loading block library…</p>';
  try {
    const json = await fetchCatalogJson(context, token, libraryPath);
    const catalog = parseCatalogSheet(json);
    if (!catalog.length) {
      renderEmptyState(context, libraryPath, 'No blocks found in the catalog sheet yet.');
      return;
    }
    state = { catalog, expanded: new Set(), preview: null };
    render({
      context, token, actions,
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      renderEmptyState(context, libraryPath, 'Catalog sheet does not exist yet.');
      return;
    }
    app.innerHTML = `<p class="bl-status bl-status-error">${err.message}</p>`;
  }
}

(async function init() {
  const { context, token, actions } = await DA_SDK;
  const { libraryPath } = getConfig();

  sourceLink.href = sheetUrl(context, libraryPath);
  refreshBtn.addEventListener('click', () => load(context, token, actions, libraryPath));

  await load(context, token, actions, libraryPath);
}());
