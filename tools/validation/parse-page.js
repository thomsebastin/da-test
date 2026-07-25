/**
 * Parse DA / EDS source HTML into a normalized page model.
 *
 * The model is the single input to the validation engine, so both the DA plugin and the
 * preflight runner see the exact same structure. Elements are retained on each block so
 * rules can run DOM queries (e.g. "does this block contain a heading?").
 *
 * DA source represents a page as a `<main>` of section `<div>`s. A block is a `<div>`
 * whose first class is the block name (further classes are variants). Metadata lives in a
 * `div.metadata` block of key/value rows, mirroring `readBlockConfig` in `scripts/aem.js`.
 */

/**
 * Normalize a label into a config key, matching EDS `toClassName` semantics.
 * @param {string} name
 * @returns {string}
 */
function toKey(name) {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : '';
}

/**
 * Read a block's key/value rows into a plain object.
 * Values collapse to href for links, src for images, otherwise trimmed text.
 * @param {Element} block
 * @returns {Object<string, string|string[]>}
 */
function readBlockConfig(block) {
  const cfg = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const cols = [...row.children];
    if (!cols[1]) return;
    const name = toKey(cols[0].textContent);
    if (!name) return;
    const col = cols[1];
    let value;
    if (col.querySelector('a')) {
      const as = [...col.querySelectorAll('a')];
      value = as.length === 1 ? as[0].getAttribute('href') : as.map((a) => a.getAttribute('href'));
    } else if (col.querySelector('img')) {
      const imgs = [...col.querySelectorAll('img')];
      value = imgs.length === 1 ? imgs[0].getAttribute('src') : imgs.map((img) => img.getAttribute('src'));
    } else {
      value = col.textContent.trim();
    }
    cfg[name] = value;
  });
  return cfg;
}

/**
 * @typedef {Object} ParsedBlock
 * @property {string} name    First class of the block div (the block name).
 * @property {string[]} variants Any remaining classes.
 * @property {Object} config  Key/value rows read from the block.
 * @property {Element} el      The block element, for DOM-level rule checks.
 */

/**
 * @typedef {Object} PageModel
 * @property {Object<string, string|string[]>} metadata Flattened page metadata.
 * @property {ParsedBlock[]} blocks   Every block on the page except metadata.
 * @property {Document} doc           The parsed document, for page-level checks.
 */

// Blocks that are structural/metadata rather than authored content blocks.
const NON_CONTENT_BLOCKS = new Set(['metadata', 'section-metadata']);

/**
 * Parse DA source HTML into a {@link PageModel}.
 * @param {string} html Raw source HTML from admin.da.live (or a full page document).
 * @returns {PageModel}
 */
export default function parsePage(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const root = doc.querySelector('main') || doc.body;

  const blocks = [];
  let metadata = {};

  // A block is a classed div that is not a plain section wrapper.
  root.querySelectorAll('div[class]').forEach((div) => {
    const classes = [...div.classList];
    if (!classes.length) return;
    const name = classes[0];
    if (name === 'metadata') {
      // Merge in case a page carries more than one metadata block.
      metadata = { ...metadata, ...readBlockConfig(div) };
      return;
    }
    if (NON_CONTENT_BLOCKS.has(name)) return;
    blocks.push({
      name,
      variants: classes.slice(1),
      config: readBlockConfig(div),
      el: div,
    });
  });

  return { metadata, blocks, doc };
}

export { toKey, readBlockConfig };
