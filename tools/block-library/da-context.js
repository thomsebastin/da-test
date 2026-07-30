/**
 * Resolve a DA_SDK `context` object into `admin.da.live` / `da.live` URLs for an arbitrary
 * DA path (unlike a plugin bound to the open document, this app always reads a *fixed*
 * catalog path, so it needs a path parameter rather than `context.path`).
 *
 * Mirrors the org/site normalization used elsewhere in this project: prefer `context.site`,
 * fall back to `context.repo`, and fail loudly (listing the keys actually received) rather
 * than silently building a broken URL.
 */

const ADMIN_ORIGIN = 'https://admin.da.live';
const DA_ORIGIN = 'https://da.live';

function resolveOrgSite(context) {
  const { org } = context || {};
  const site = context && (context.site || context.repo);
  if (!org || !site) {
    const known = Object.keys(context || {}).filter((k) => k !== 'actions' && k !== 'token');
    throw new Error(
      `DA context is missing org/site. Received keys: ${known.join(', ') || '(none)'}`,
    );
  }
  return { org, site };
}

/** Normalize to exactly one leading slash, no trailing extension. */
function cleanPath(path) {
  return `/${path}`.replace(/\/+/g, '/').replace(/\.[^/.]+$/, '');
}

/**
 * @param {object} context DA_SDK context (expects org, site|repo).
 * @param {string} path DA path to the document, with or without extension.
 * @param {string} [ext] Extension, defaults to 'html'.
 * @returns {string} admin.da.live source URL.
 */
export function sourceUrl(context, path, ext = 'html') {
  const { org, site } = resolveOrgSite(context);
  return `${ADMIN_ORIGIN}/source/${org}/${site}${cleanPath(path)}.${ext}`;
}

/**
 * @param {object} context DA_SDK context.
 * @param {string} path DA path to the document.
 * @returns {string} da.live edit URL, handy for "create this document" empty states.
 */
export function editUrl(context, path) {
  const { org, site } = resolveOrgSite(context);
  return `${DA_ORIGIN}/edit#/${org}/${site}${cleanPath(path)}`;
}

export default sourceUrl;
