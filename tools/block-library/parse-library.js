/**
 * Parse the block-library catalog document into a list of blocks and their variations.
 *
 * Convention (standard EDS authoring — no special markup required beyond normal block
 * authoring): each section of the document may contain one or more block instances,
 * authored exactly as they would be on any real page. A block instance's first class is
 * the block name; any further classes are the variant modifiers for that instance. Every
 * instance found is one "variation" an author can preview. An optional heading placed
 * directly above an instance becomes its display label.
 *
 * Pure and DOM-only (DOMParser) — no network, so it runs identically in the app and in a
 * browser-based test.
 */

// Structural blocks, not authored content examples.
const NON_CONTENT_BLOCKS = new Set(['metadata', 'section-metadata']);

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
 * @typedef {Object} BlockVariation
 * @property {string} name        Block name (first class).
 * @property {string[]} variants  Variant modifier classes (remaining classes).
 * @property {string|null} label  Nearest preceding heading text, if any.
 * @property {Object} config      Key/value rows read from the instance.
 * @property {string} html        outerHTML of the instance, ready to render or insert.
 */

/**
 * @typedef {Object} CatalogEntry
 * @property {string} name              Block name.
 * @property {BlockVariation[]} variations
 */

/**
 * @param {string} html Raw source HTML of the catalog document (from admin.da.live).
 * @returns {CatalogEntry[]} Sorted alphabetically by block name.
 */
export function buildCatalog(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const root = doc.querySelector('main') || doc.body;
  const byName = new Map();

  [...root.querySelectorAll(':scope > div')].forEach((section) => {
    [...section.querySelectorAll(':scope > div[class]')].forEach((block) => {
      const classes = [...block.classList];
      const [name, ...variants] = classes;
      if (!name || NON_CONTENT_BLOCKS.has(name)) return;

      const variation = {
        name,
        variants,
        label: nearestLabel(block),
        config: readBlockConfig(block),
        html: block.outerHTML,
      };
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(variation);
    });
  });

  return [...byName.entries()]
    .map(([name, variations]) => ({ name, variations }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default buildCatalog;
