/**
 * Shared validation engine.
 *
 * This is the single source of truth used by BOTH consumers:
 *   - the DA plugin (`validation.js`) for inline author feedback, and
 *   - the preflight runner (`preflight.js`) for the formal pre-publish gate.
 *
 * Implementing validation once here is what stops authors from seeing one result in the
 * editor and a different one at preflight.
 */

import parsePage from './parse-page.js';
import defaultConfig from './config.js';
import { ruleEvaluators } from './rules.js';

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

/**
 * @typedef {import('./rules.js').Issue} Issue
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} ready              True when there are no error-severity issues.
 * @property {Issue[]} issues             All issues, sorted most-severe first.
 * @property {{error: number, warning: number, info: number}} counts
 * @property {'ready'|'warnings'|'errors'} status Headline status for the UI.
 */

/**
 * Validate an already-parsed page model against a config.
 * @param {import('./parse-page.js').PageModel} model
 * @param {import('./config.js').ValidationConfig} [config]
 * @returns {ValidationResult}
 */
export function validateModel(model, config = defaultConfig) {
  const issues = ruleEvaluators
    .flatMap((run) => run(model, config))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts = { error: 0, warning: 0, info: 0 };
  issues.forEach((issue) => { counts[issue.severity] += 1; });

  let status = 'ready';
  if (counts.error) status = 'errors';
  else if (counts.warning) status = 'warnings';

  return {
    ready: counts.error === 0,
    issues,
    counts,
    status,
  };
}

/**
 * Parse DA source HTML and validate it in one step.
 * @param {string} html Raw source HTML from admin.da.live.
 * @param {import('./config.js').ValidationConfig} [config]
 * @returns {ValidationResult}
 */
export function validatePage(html, config = defaultConfig) {
  return validateModel(parsePage(html), config);
}

export default validatePage;
