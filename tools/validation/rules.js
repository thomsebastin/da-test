/**
 * Validation rules for the shared validator.
 *
 * This module holds the *logic*; `config.js` holds the *declaration* of which rules apply.
 * Each rule returns zero or more issues shaped as:
 *   { severity, code, message, location }
 *
 * Keeping the logic here means a site can retune the contract in `config.js` without
 * touching code, and the DA plugin and preflight runner never drift apart.
 */

/**
 * @typedef {Object} Issue
 * @property {'error'|'warning'|'info'} severity
 * @property {string} code     Stable machine code, e.g. HERO_HEADING_MISSING.
 * @property {string} message  Actionable, author-facing text.
 * @property {string} location Where to look, e.g. "block:hero" or "metadata.description".
 */

/**
 * Field detectors resolve a named `requiredField` against a block element.
 * Each returns true when the field is present. Add new detectors here to extend the
 * vocabulary available to `blockRules[*].requiredFields` in the config.
 */
const fieldDetectors = {
  heading: (el) => !!el.querySelector('h1, h2, h3, h4, h5, h6'),
  image: (el) => !!el.querySelector('img, picture source, picture'),
  text: (el) => el.textContent.trim().length > 0,
  href: (el) => [...el.querySelectorAll('a')].some((a) => (a.getAttribute('href') || '').trim().length > 0),
  link: (el) => [...el.querySelectorAll('a')].some((a) => (a.getAttribute('href') || '').trim().length > 0),
  alt: (el) => [...el.querySelectorAll('img')].every((img) => (img.getAttribute('alt') || '').trim().length > 0),
};

const upper = (s) => String(s).toUpperCase().replace(/[^0-9A-Z]+/g, '_').replace(/^_|_$/g, '');
const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
  || (Array.isArray(v) && v.length === 0);

/**
 * Required metadata fields must be present and non-empty.
 * @param {import('./parse-page.js').PageModel} model
 * @param {import('./config.js').ValidationConfig} config
 * @returns {Issue[]}
 */
function requiredMetadataRule(model, config) {
  return (config.requiredMetadata || [])
    .filter((field) => isEmpty(model.metadata[field.name]))
    .map((field) => ({
      severity: field.severity || 'error',
      code: `META_${upper(field.name)}_MISSING`,
      message: `Metadata field "${field.name}" is required`,
      location: `metadata.${field.name}`,
    }));
}

/**
 * Required blocks must appear at least once on the page.
 * @returns {Issue[]}
 */
function requiredBlocksRule(model, config) {
  return (config.requiredBlocks || [])
    .filter((block) => !model.blocks.some((b) => b.name === block.name))
    .map((block) => ({
      severity: block.severity || 'error',
      code: `BLOCK_${upper(block.name)}_MISSING`,
      message: `Required block "${block.name}" is missing`,
      location: 'page',
    }));
}

/**
 * Per-block required fields (e.g. hero must contain a heading and an image).
 * Only runs against blocks that are actually present; missing blocks are the concern of
 * `requiredBlocksRule` so we don't double-report.
 * @returns {Issue[]}
 */
function blockFieldRules(model, config) {
  const issues = [];
  Object.entries(config.blockRules || {}).forEach(([blockName, rule]) => {
    model.blocks
      .filter((b) => b.name === blockName)
      .forEach((block) => {
        (rule.requiredFields || []).forEach((field) => {
          const detect = fieldDetectors[field];
          const present = detect ? detect(block.el) : !isEmpty(block.config[field]);
          if (!present) {
            issues.push({
              severity: rule.severity || 'error',
              code: `${upper(blockName)}_${upper(field)}_MISSING`,
              message: `${blockName} block must include ${field}`,
              location: `block:${blockName}`,
            });
          }
        });
      });
  });
  return issues;
}

/**
 * Every content image must carry alt text.
 * @returns {Issue[]}
 */
function imageAltRule(model, config) {
  const a11y = config.accessibility || {};
  if (!a11y.requireImageAlt) return [];
  const imgs = [...model.doc.querySelectorAll('main img, body img')];
  const missing = imgs.filter((img) => (img.getAttribute('alt') || '').trim() === '');
  if (!missing.length) return [];
  return [{
    severity: a11y.severity || 'warning',
    code: 'IMAGE_ALT_MISSING',
    message: missing.length === 1
      ? '1 image is missing alt text'
      : `${missing.length} images are missing alt text`,
    location: 'page',
  }];
}

/**
 * Named page-level rules, referenced by `code` from `config.pageRules`.
 * Each entry describes itself and implements `test(model)` returning an Issue or null.
 */
const pageRules = {
  REQUIRE_PRIMARY_CTA: {
    description: 'Every landing page must include at least one CTA block or button link',
    test: (model) => {
      // A CTA is satisfied by a `cta` block, a decorated button, or — the common case in
      // DA source — a link that is the sole content of its paragraph (EDS button pattern).
      const root = model.doc.querySelector('main') || model.doc.body;
      const buttonLink = [...root.querySelectorAll('a[href]')].some((a) => {
        if (a.classList.contains('button')) return true;
        const p = a.closest('p');
        return !!p && p.textContent.trim() === a.textContent.trim();
      });
      const hasCta = model.blocks.some((b) => b.name === 'cta')
        || !!root.querySelector('.button-container a')
        || buttonLink;
      return hasCta ? null : {
        code: 'REQUIRE_PRIMARY_CTA',
        message: 'Page must include at least one call to action',
        location: 'page',
      };
    },
  },
};

/**
 * Run the configured named page rules.
 * @returns {Issue[]}
 */
function pageRulesCheck(model, config) {
  const issues = [];
  (config.pageRules || []).forEach((entry) => {
    const rule = pageRules[entry.code];
    if (!rule) return;
    const result = rule.test(model);
    if (result) {
      issues.push({ severity: entry.severity || 'error', ...result });
    }
  });
  return issues;
}

// Ordered list of rule evaluators the engine runs.
const ruleEvaluators = [
  requiredMetadataRule,
  requiredBlocksRule,
  blockFieldRules,
  imageAltRule,
  pageRulesCheck,
];

export {
  ruleEvaluators,
  fieldDetectors,
  pageRules,
  requiredMetadataRule,
  requiredBlocksRule,
  blockFieldRules,
  imageAltRule,
  pageRulesCheck,
};
