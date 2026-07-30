// Import DA App SDK (resolved at runtime from da.live).
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { buildCatalog } from './parse-library.js';
import { sourceUrl, editUrl } from './da-context.js';
import { getConfig } from './config.js';

const app = document.querySelector('#bl-app');
const sourceLink = document.querySelector('#bl-source-link');
const refreshBtn = document.querySelector('#bl-refresh');

let state = { catalog: [], selected: null };

/** Fetch the catalog document's source HTML from admin.da.live. */
async function fetchCatalogHtml(context, token, libraryPath) {
  const res = await fetch(sourceUrl(context, libraryPath), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 404) {
    const err = new Error('Catalog document not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!res.ok) throw new Error(`Could not load catalog document (${res.status})`);
  return res.text();
}

function variationLabel(variation) {
  if (variation.label) return variation.label;
  if (variation.variants.length) return variation.variants.join(', ');
  return 'Default';
}

/** Render the sidebar list of discovered block names. */
function renderNav(root) {
  const nav = document.createElement('nav');
  nav.className = 'bl-nav';
  const list = document.createElement('ul');
  state.catalog.forEach(({ name, variations }) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bl-nav-item';
    btn.classList.toggle('is-active', state.selected?.name === name);
    btn.innerHTML = `<span class="bl-nav-name">${name}</span><span class="bl-nav-count">${variations.length}</span>`;
    btn.addEventListener('click', () => {
      state.selected = { name, variationIndex: null };
      // eslint-disable-next-line no-use-before-define
      render(root);
    });
    li.append(btn);
    list.append(li);
  });
  nav.append(list);
  return nav;
}

/** Render the grid of variation cards for the currently selected block. */
function renderVariations(root, actions) {
  const section = document.createElement('section');
  section.className = 'bl-variations';

  const entry = state.catalog.find((b) => b.name === state.selected?.name);
  if (!entry) {
    section.innerHTML = '<p class="bl-status">Select a block from the list to see its variations.</p>';
    return section;
  }

  const h2 = document.createElement('h2');
  h2.textContent = entry.name;
  section.append(h2);

  const grid = document.createElement('div');
  grid.className = 'bl-grid';
  entry.variations.forEach((variation, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bl-card';
    card.innerHTML = `
      <span class="bl-card-title">${variationLabel(variation)}</span>
      ${variation.variants.length ? `<span class="bl-card-variants">${variation.variants.join(' · ')}</span>` : ''}
    `;
    // eslint-disable-next-line no-use-before-define
    card.addEventListener('click', () => openPreview(entry, variation, index, actions));
    grid.append(card);
  });
  section.append(grid);
  return section;
}

/** Open the click-to-preview modal for one block variation. */
function openPreview(entry, variation, index, actions) {
  const overlay = document.createElement('div');
  overlay.className = 'bl-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'bl-modal';

  const header = document.createElement('div');
  header.className = 'bl-modal-header';
  header.innerHTML = `<h3>${entry.name} — ${variationLabel(variation)}</h3>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bl-modal-close';
  closeBtn.setAttribute('aria-label', 'Close preview');
  closeBtn.textContent = '✕';
  header.append(closeBtn);

  const iframe = document.createElement('iframe');
  iframe.className = 'bl-preview-frame';
  iframe.title = `Preview: ${entry.name} — ${variationLabel(variation)}`;
  iframe.src = './preview.html';

  const onMessage = (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.data?.type === 'block-library-preview-ready') {
      iframe.contentWindow.postMessage(
        { type: 'block-library-render', html: variation.html },
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
  details.querySelector('code').textContent = variation.html;

  const footer = document.createElement('div');
  footer.className = 'bl-modal-footer';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy HTML';
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(variation.html);
    copyBtn.textContent = 'Copied!';
    window.setTimeout(() => { copyBtn.textContent = 'Copy HTML'; }, 1500);
  });

  const insertBtn = document.createElement('button');
  insertBtn.type = 'button';
  insertBtn.className = 'bl-btn-primary';
  insertBtn.textContent = 'Insert into open document';
  insertBtn.title = 'Only takes effect when opened as a library plugin alongside a document';
  insertBtn.addEventListener('click', () => {
    actions.sendHTML(variation.html);
    actions.closeLibrary();
  });

  footer.append(copyBtn, insertBtn);

  modal.append(header, iframe, details, footer);
  overlay.append(modal);

  const close = () => {
    window.removeEventListener('message', onMessage);
    overlay.remove();
  };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  document.body.append(overlay);
}

function renderEmptyState(context, libraryPath, message) {
  app.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'bl-empty';
  wrap.innerHTML = `
    <p>${message}</p>
    <p>Author block examples at <code>${libraryPath}</code> — one block instance per
    variation, authored the same way you would on any page (variant modifiers as extra
    names on the block, e.g. "Cards (bordered)"). The library rebuilds itself from that
    document automatically.</p>
  `;
  const link = document.createElement('a');
  link.href = editUrl(context, libraryPath);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open catalog document in DA';
  wrap.append(link);
  app.append(wrap);
}

function render(root) {
  app.innerHTML = '';
  const layout = document.createElement('div');
  layout.className = 'bl-layout';
  layout.append(renderNav(root), renderVariations(root, root.actions));
  app.append(layout);
}

async function load(context, token, actions, libraryPath) {
  app.innerHTML = '<p class="bl-status">Loading block library…</p>';
  try {
    const html = await fetchCatalogHtml(context, token, libraryPath);
    const catalog = buildCatalog(html);
    if (!catalog.length) {
      renderEmptyState(context, libraryPath, 'No blocks found in the catalog document yet.');
      return;
    }
    state = { catalog, selected: { name: catalog[0].name, variationIndex: null } };
    render({ actions });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      renderEmptyState(context, libraryPath, 'Catalog document does not exist yet.');
      return;
    }
    app.innerHTML = `<p class="bl-status bl-status-error">${err.message}</p>`;
  }
}

(async function init() {
  const { context, token, actions } = await DA_SDK;
  const { libraryPath } = getConfig();

  sourceLink.href = editUrl(context, libraryPath);
  refreshBtn.addEventListener('click', () => load(context, token, actions, libraryPath));

  await load(context, token, actions, libraryPath);
}());
