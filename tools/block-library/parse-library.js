/**
 * Parse the block-library catalog and its linked example pages.
 *
 * The catalog itself is a **sheet** (structured/tabular content), following the same
 * `name` / `path` convention as DA's own native `library` `blocks` sub-sheet: each row
 * names a block and links to a page containing an authored example of it. Several rows
 * may share a `name` — each is a separate variation, each with its own example page.
 *
 * The linked pages are authored exactly like any other page — no special markup — so
 * finding the actual instance on that page uses the same block convention everywhere
 * else in EDS: a block's first class is its name, remaining classes are variant
 * modifiers. `findBlockInstance` locates the (first) instance matching the expected name.
 *
 * Pure and DOM-only (DOMParser) — no network, so it runs identically in the app and in a
 * browser-based test.
 */

/** Normalize a label into a config key, matching EDS `toClassName` semantics. */
function toKey(name) {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : '';
}

/** Read a block's key/value rows into a plain object (mirrors `readBlockConfig` in aem.js). */
function readBlockConfig(block) {
  const cfg = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const cols = [...row.children];
    if (!cols[1]) return;
    const name = toKey(cols[0].textContent);
    if (!name) return;
    cfg[name] = cols[1].textContent.trim();
  });
  return cfg;
}

/** Walk back through this instance's own siblings for the nearest heading label. */
function nearestLabel(block) {
  let sib = block.previousElementSibling;
  while (sib) {
    if (/^H[1-6]$/.test(sib.tagName)) return sib.textContent.trim();
    sib = sib.previousElementSibling;
  }
  return null;
}

/**
 * @typedef {Object} CatalogRow
 * @property {string} name  Block name, as declared in the sheet's `name` column.
 * @property {string} path  Path or absolute URL to the row's example page.
 * @property {string|null} label Optional display label from a `label`/`description` column.
 */

/**
 * Parse the catalog sheet's JSON (as returned by `admin.da.live/source/.../*.json`) into
 * rows, grouped by block name. Rows missing a `name` or `path` are dropped.
 * @param {object} json Sheet JSON — expects a `data` array of row objects.
 * @returns {Array<{name: string, rows: CatalogRow[]}>} Sorted alphabetically by name.
 */
export function parseCatalogSheet(json) {
  const data = Array.isArray(json?.data) ? json.data : [];
  const byName = new Map();

  data.forEach((row) => {
    const name = (row.name || '').trim();
    const path = (row.path || '').trim();
    if (!name || !path) return;
    const label = (row.label || row.description || '').trim() || null;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push({ name, path, label });
  });

  return [...byName.entries()]
    .map(([name, rows]) => ({ name, rows }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @typedef {Object} BlockInstance
 * @property {string} name        Block name (first class).
 * @property {string[]} variants  Variant modifier classes (remaining classes).
 * @property {string|null} label  Nearest preceding heading text, if any.
 * @property {Object} config      Key/value rows read from the instance.
 * @property {string} html        outerHTML of the instance, ready to render or insert.
 */

/**
 * Find the first instance of `expectedName` on an example page.
 * @param {string} html Raw source HTML of the linked example page.
 * @param {string} expectedName Block name declared for this row in the catalog sheet.
 * @returns {BlockInstance|null} `null` when no matching block is found on the page.
 */
export function findBlockInstance(html, expectedName) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const root = doc.querySelector('main') || doc.body;

  const sections = [...root.querySelectorAll(':scope > div')];
  for (let s = 0; s < sections.length; s += 1) {
    const blocks = [...sections[s].querySelectorAll(':scope > div[class]')];
    for (let b = 0; b < blocks.length; b += 1) {
      const block = blocks[b];
      const [name, ...variants] = [...block.classList];
      if (name === expectedName) {
        return {
          name,
          variants,
          label: nearestLabel(block),
          config: readBlockConfig(block),
          html: block.outerHTML,
        };
      }
    }
  }
  return null;
}

export default parseCatalogSheet;
