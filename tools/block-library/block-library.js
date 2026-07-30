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

let state = { catalog: [], selectedName: null };

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

/** Prettify the last path segment as a fallback card label when a row has none. */
function basenameLabel(path) {
  const clean = path.replace(/^https?:\/\/[^/]+/, '').replace(/\.[^/.]+$/, '');
  const last = clean.split('/').filter(Boolean).pop() || 'default';
  return last.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function cardLabel(row) {
  return row.label || basenameLabel(row.path);
}

function modalLabel(row, instance) {
  if (row.label) return row.label;
  if (instance?.label) return instance.label;
  if (instance?.variants.length) return instance.variants.join(', ');
  return basenameLabel(row.path);
}

/** Render the sidebar list of discovered block names. */
function renderNav(root) {
  const nav = document.createElement('nav');
  nav.className = 'bl-nav';
  const list = document.createElement('ul');
  state.catalog.forEach(({ name, rows }) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bl-nav-item';
    btn.classList.toggle('is-active', state.selectedName === name);
    btn.innerHTML = `<span class="bl-nav-name">${name}</span><span class="bl-nav-count">${rows.length}</span>`;
    btn.addEventListener('click', () => {
      state.selectedName = name;
      // eslint-disable-next-line no-use-before-define
      render(root);
    });
    li.append(btn);
    list.append(li);
  });
  nav.append(list);
  return nav;
}

/** Render the grid of variation cards (one per sheet row) for the selected block. */
function renderVariations(root) {
  const section = document.createElement('section');
  section.className = 'bl-variations';

  const entry = state.catalog.find((b) => b.name === state.selectedName);
  if (!entry) {
    section.innerHTML = '<p class="bl-status">Select a block from the list to see its variations.</p>';
    return section;
  }

  const h2 = document.createElement('h2');
  h2.textContent = entry.name;
  section.append(h2);

  const grid = document.createElement('div');
  grid.className = 'bl-grid';
  entry.rows.forEach((row) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bl-card';
    card.innerHTML = `<span class="bl-card-title">${cardLabel(row)}</span>`;
    // eslint-disable-next-line no-use-before-define
    card.addEventListener('click', () => openPreview(entry, row, root));
    grid.append(card);
  });
  section.append(grid);
  return section;
}

/** Open the click-to-preview modal for one catalog row, fetching its example lazily. */
function openPreview(entry, row, root) {
  const overlay = document.createElement('div');
  overlay.className = 'bl-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'bl-modal';

  const header = document.createElement('div');
  header.className = 'bl-modal-header';
  header.innerHTML = `<h3>${entry.name} — ${cardLabel(row)}</h3>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bl-modal-close';
  closeBtn.setAttribute('aria-label', 'Close preview');
  closeBtn.textContent = '✕';
  header.append(closeBtn);

  const body = document.createElement('div');
  body.className = 'bl-modal-body';
  body.innerHTML = '<p class="bl-status">Loading example…</p>';

  modal.append(header, body);
  overlay.append(modal);

  let onMessage;
  const close = () => {
    if (onMessage) window.removeEventListener('message', onMessage);
    overlay.remove();
  };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
  document.body.append(overlay);

  fetchRowInstance(root.context, root.token, row).then((instance) => {
    header.querySelector('h3').textContent = `${entry.name} — ${modalLabel(row, instance)}`;

    const iframe = document.createElement('iframe');
    iframe.className = 'bl-preview-frame';
    iframe.title = `Preview: ${entry.name} — ${modalLabel(row, instance)}`;
    iframe.src = './preview.html';

    onMessage = (e) => {
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

    const details = document.createElement('details');
    details.className = 'bl-raw-html';
    details.innerHTML = '<summary>View HTML</summary><pre><code></code></pre>';
    details.querySelector('code').textContent = instance.html;

    const footer = document.createElement('div');
    footer.className = 'bl-modal-footer';

    const editLink = document.createElement('a');
    editLink.className = 'bl-link';
    editLink.href = editUrlForRow(root.context, row.path);
    editLink.target = '_blank';
    editLink.rel = 'noopener';
    editLink.textContent = 'Edit example page';
    footer.append(editLink);

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

    footer.append(copyBtn, insertBtn);

    body.innerHTML = '';
    body.append(iframe, details, footer);
  }).catch((err) => {
    body.innerHTML = `<p class="bl-status bl-status-error">${err.message}</p>`;
  });
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
  layout.append(renderNav(root), renderVariations(root));
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
    state = { catalog, selectedName: catalog[0].name };
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
