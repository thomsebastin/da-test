/**
 * Preflight runner — Layer 2, the formal pre-publish gate.
 *
 * It deliberately reuses the SAME validator as the DA plugin so reviewers and authors see
 * identical rule outcomes. The only difference is intent: preflight treats the result as a
 * pass/fail gate (errors block), whereas the plugin surfaces the same issues as guidance.
 *
 * Usage inside a custom DA preflight check:
 *
 *   import { runPreflight } from '/tools/validation/preflight.js';
 *   const report = await runPreflight({ org, repo, path, ext }, token);
 *   if (!report.pass) { // surface report.issues as actionable failures }
 */

import { validatePage } from './validate-page.js';
import config from './config.js';

const ADMIN_ORIGIN = 'https://admin.da.live';

/**
 * @param {{org: string, repo: string, path: string, ext?: string}} context
 * @returns {string}
 */
function sourceUrl({
  org, repo, path, ext,
}) {
  // Normalize `path` to exactly one leading slash so repo and path never fuse together.
  const clean = `/${path}`.replace(/\/+/g, '/').replace(/\.[^/.]+$/, '');
  return `${ADMIN_ORIGIN}/source/${org}/${repo}${clean}.${ext || 'html'}`;
}

/**
 * @typedef {Object} PreflightReport
 * @property {boolean} pass                 True when there are no error-severity issues.
 * @property {import('./rules.js').Issue[]} issues
 * @property {import('./rules.js').Issue[]} failures Error-severity issues only (the gate).
 * @property {import('./validate-page.js').ValidationResult} result Full validation result.
 */

/**
 * Validate raw source HTML as a preflight gate. Pure — no network — so it is easy to unit
 * test and to run over content you already have in hand.
 * @param {string} html
 * @param {import('./config.js').ValidationConfig} [cfg]
 * @returns {PreflightReport}
 */
export function preflightHtml(html, cfg = config) {
  const result = validatePage(html, cfg);
  return {
    pass: result.ready,
    issues: result.issues,
    failures: result.issues.filter((i) => i.severity === 'error'),
    result,
  };
}

/**
 * Fetch the current page source from admin.da.live and run the preflight gate.
 * @param {{org: string, repo: string, path: string, ext?: string}} context
 * @param {string} [token] IMS access token.
 * @param {import('./config.js').ValidationConfig} [cfg]
 * @returns {Promise<PreflightReport>}
 */
export async function runPreflight(context, token, cfg = config) {
  const res = await fetch(sourceUrl(context), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Preflight could not load page source (${res.status})`);
  }
  return preflightHtml(await res.text(), cfg);
}

export default runPreflight;
