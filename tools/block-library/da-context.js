/**
 * Resolve a DA_SDK `context` object into `admin.da.live` / `da.live` URLs for an arbitrary
 * DA path (unlike a plugin bound to the open document, this app always reads a *fixed*
 * catalog sheet, so it needs a path parameter rather than `context.path`).
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
 * @param {string} path DA path to a content page.
 * @returns {string} da.live document-editor URL (rich text / blocks).
 */
export function editUrl(context, path) {
  const { org, site } = resolveOrgSite(context);
  return `${DA_ORIGIN}/edit#/${org}/${site}${cleanPath(path)}`;
}

/**
 * @param {object} context DA_SDK context.
 * @param {string} path DA path to a sheet (structured/tabular content, e.g. the blocks
 *   catalog itself — a `name`/`path` table, same convention as DA's own `library`
 *   `blocks` sub-sheet).
 * @returns {string} da.live sheet-editor URL.
 */
export function sheetUrl(context, path) {
  const { org, site } = resolveOrgSite(context);
  return `${DA_ORIGIN}/sheet#/${org}/${site}${cleanPath(path)}`;
}

/**
 * Resolve a catalog row's `path` value to a fetchable URL. Sheets following DA's own
 * `blocks` sub-sheet convention link with a full `https://content.da.live/...` URL (public,
 * unauthenticated); a bare DA path (e.g. `/docs/library/examples/cards-bordered`) is
 * resolved against `admin.da.live/source` instead, same as the catalog sheet itself.
 * @param {object} context DA_SDK context.
 * @param {string} path Absolute URL or DA path from a catalog row.
 * @returns {{url: string, needsAuth: boolean}}
 */
export function resolveLinkedPage(context, path) {
  if (/^https?:\/\//i.test(path)) return { url: path, needsAuth: false };
  return { url: sourceUrl(context, path), needsAuth: true };
}

export default sourceUrl;
