/**
 * Site validation contract.
 *
 * DA is not a strongly typed form-model authoring system, so instead of relying on a
 * native "required field" feature we describe the readiness rules declaratively here.
 * The same contract is consumed by both the DA plugin (inline author feedback) and the
 * preflight runner (formal pre-publish gate), which keeps the two in sync.
 *
 * Everything in this file is JSON-serializable. The logic that interprets it lives in
 * `rules.js`; page rules are referenced by `code` so this file stays declarative.
 *
 * Severities:
 *   - error   → required for readiness (blocks preflight)
 *   - warning → recommended, not blocking
 *   - info    → advisory only
 */

/** @typedef {'error' | 'warning' | 'info'} Severity */

/**
 * @typedef {Object} ValidationConfig
 * @property {Array<{name: string, severity: Severity}>} requiredMetadata
 * @property {Array<{name: string, severity: Severity}>} requiredBlocks
 * @property {Object<string, {requiredFields: string[], severity?: Severity}>} blockRules
 * @property {{requireImageAlt: boolean, severity?: Severity}} accessibility
 * @property {Array<{code: string, severity?: Severity}>} pageRules
 */

/** @type {ValidationConfig} */
const config = {
  // Metadata fields that must be present (and non-empty) in the page metadata block.
  requiredMetadata: [
    { name: 'title', severity: 'error' },
    { name: 'description', severity: 'error' },
    { name: 'image', severity: 'warning' }, // og:image
  ],

  // Blocks that must appear at least once on the page.
  requiredBlocks: [
    { name: 'hero', severity: 'error' },
  ],

  // Per-block field requirements. Field names are resolved by the field detectors in
  // `rules.js` (heading, image, text, href, alt, ...).
  blockRules: {
    hero: {
      requiredFields: ['heading', 'image'],
      severity: 'error',
    },
    cta: {
      requiredFields: ['text', 'href'],
      severity: 'error',
    },
  },

  // Accessibility checks applied across the whole page.
  accessibility: {
    requireImageAlt: true,
    severity: 'warning',
  },

  // Named cross-cutting page rules. The implementation for each `code` lives in the
  // `pageRules` registry in `rules.js`.
  pageRules: [
    { code: 'REQUIRE_PRIMARY_CTA', severity: 'warning' },
  ],
};

/**
 * Preflight-tuned config.
 *
 * DA's *native* Preflight (Prepare menu) already checks page title, meta description, a
 * single H1, broken/unpublished links and leftover placeholder text. Our custom preflight
 * runs *alongside* native (distinct title), so we drop the overlapping metadata checks here
 * to avoid double-reporting and keep our value focused on what native does NOT cover:
 * required blocks, block-field completeness, image alt text and primary-CTA presence.
 *
 * The inline validator keeps using the fuller `config` above (default export), since it
 * runs while editing — before the author ever opens Prepare/Preflight.
 */
const NATIVE_METADATA = ['title', 'description'];
export const preflightConfig = {
  ...config,
  requiredMetadata: config.requiredMetadata.filter((f) => !NATIVE_METADATA.includes(f.name)),
};

export default config;
