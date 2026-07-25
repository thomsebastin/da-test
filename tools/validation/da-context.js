/**
 * Resolve a DA_SDK `context` object into an `admin.da.live` source URL.
 *
 * The Prepare-menu context is confirmed to use `site` for the site identifier (matching
 * DA's own vocabulary everywhere else, e.g. `da.live/config#/{org}/{site}/`), while some
 * older Library-plugin contexts have used `repo`. Prefer `site`, fall back to `repo`, and —
 * if neither is present — fail with the actual keys DA sent so the real shape is visible
 * immediately instead of guessed at again.
 */

const ADMIN_ORIGIN = 'https://admin.da.live';

/**
 * @param {object} context DA_SDK context (expects org, site|repo, path, optional ext).
 * @returns {string} admin.da.live source URL for the page.
 * @throws {Error} when a required field is missing; message lists the keys actually present.
 */
export function sourceUrl(context) {
  const { org, path, ext } = context || {};
  const site = context && (context.site || context.repo);

  const missing = [];
  if (!org) missing.push('org');
  if (!site) missing.push('site/repo');
  if (!path) missing.push('path');
  if (missing.length) {
    const known = Object.keys(context || {}).filter((k) => k !== 'actions' && k !== 'token');
    throw new Error(
      `DA context is missing ${missing.join(', ')}. Received keys: ${known.join(', ') || '(none)'}`,
    );
  }

  // Normalize `path` to exactly one leading slash so org/site and path never fuse together.
  const clean = `/${path}`.replace(/\/+/g, '/').replace(/\.[^/.]+$/, '');
  return `${ADMIN_ORIGIN}/source/${org}/${site}${clean}.${ext || 'html'}`;
}

export default sourceUrl;
