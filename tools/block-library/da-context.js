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

// Matches an authored `https://content.da.live/{org}/{site}/{path}` link, DA's own
// convention for referencing a page from a sheet (e.g. the `library` `blocks` sub-sheet).
const CONTENT_LINK_PATTERN = /^https?:\/\/content\.da\.live\/([^/]+)\/([^/]+)\/(.+)$/i;

/**
 * Resolve a catalog row's `path` value to the {context, path} it actually refers to. A
 * `content.da.live` link names its own org/site explicitly (which may differ from the
 * current `context` if the sheet links a page in another site); a bare DA path
 * (e.g. `/docs/library/examples/cards-bordered`) belongs to the current context.
 * @param {object} context DA_SDK context.
 * @param {string} path Absolute `content.da.live` URL or bare DA path from a catalog row.
 * @returns {{context: object, path: string}}
 */
function resolveRowLocation(context, path) {
  const contentMatch = path.match(CONTENT_LINK_PATTERN);
  if (contentMatch) {
    const [, org, site, rest] = contentMatch;
    return { context: { org, site }, path: `/${rest}` };
  }
  return { context, path };
}

/**
 * Resolve a catalog row's `path` value to an authenticated `admin.da.live/source` URL.
 * `content.da.live` requires the same IMS bearer token as `admin.da.live` for any
 * non-public org/site, so a `content.da.live` link is rewritten to `admin.da.live/source`
 * rather than fetched as-is — that gives it the same proven auth handling as the catalog
 * sheet fetch, instead of a second, unverified code path.
 * @param {object} context DA_SDK context.
 * @param {string} path Absolute `content.da.live` URL or bare DA path from a catalog row.
 * @returns {string} admin.da.live source URL.
 */
export function resolveLinkedPage(context, path) {
  const loc = resolveRowLocation(context, path);
  return sourceUrl(loc.context, loc.path);
}

/**
 * @param {object} context DA_SDK context.
 * @param {string} path Absolute `content.da.live` URL or bare DA path from a catalog row.
 * @returns {string} da.live document-editor URL for that row's example page.
 */
export function editUrlForRow(context, path) {
  const loc = resolveRowLocation(context, path);
  return editUrl(loc.context, loc.path);
}

export default sourceUrl;
