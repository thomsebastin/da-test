// Import DA App SDK (resolved at runtime from da.live).
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { validatePage } from './validate-page.js';
import config from './config.js';

const ADMIN_ORIGIN = 'https://admin.da.live';

const SEVERITY_ICON = { error: '✖', warning: '⚠', info: 'ℹ' };
const STATUS_LABEL = { ready: 'Ready', warnings: 'Warnings', errors: 'Errors' };

/**
 * Build the admin.da.live source URL for the page currently open in DA.
 * Internal guidance: use admin.da.live (source of truth) rather than content.da.live.
 * @param {{org: string, repo: string, path: string, ext?: string}} context
 * @returns {string}
 */
function sourceUrl({
  org, repo, path, ext,
}) {
  // The SDK may hand back `path` with or without a leading slash — normalize to exactly
  // one so we never produce `.../da-testtools/...`.
  const clean = `/${path}`.replace(/\/+/g, '/').replace(/\.[^/.]+$/, '');
  return `${ADMIN_ORIGIN}/source/${org}/${repo}${clean}.${ext || 'html'}`;
}

/**
 * Fetch the current page's source HTML from admin.da.live.
 * @param {object} context DA_SDK context.
 * @param {string} token   IMS access token from the SDK.
 * @returns {Promise<string>}
 */
async function fetchSource(context, token) {
  const res = await fetch(sourceUrl(context), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Could not load page source (${res.status})`);
  }
  return res.text();
}

/** Render the validation result into the panel. */
function renderPanel(result) {
  const root = document.querySelector('#panel');
  root.innerHTML = '';

  const status = document.createElement('div');
  status.className = `status status--${result.status}`;
  status.textContent = STATUS_LABEL[result.status];
  root.append(status);

  if (!result.issues.length) {
    const ok = document.createElement('p');
    ok.className = 'issue issue--ok';
    ok.textContent = 'All checks passed ✔';
    root.append(ok);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'issues';
  result.issues.forEach((issue) => {
    const li = document.createElement('li');
    li.className = `issue issue--${issue.severity}`;
    li.innerHTML = `<span class="icon" aria-hidden="true">${SEVERITY_ICON[issue.severity]}</span>`;
    const text = document.createElement('span');
    text.className = 'message';
    text.textContent = issue.message;
    const loc = document.createElement('span');
    loc.className = 'location';
    loc.textContent = issue.location;
    li.append(text, loc);
    list.append(li);
  });
  root.append(list);
}

/** Render an error/empty state. */
function renderMessage(text, isError = false) {
  const root = document.querySelector('#panel');
  root.innerHTML = `<p class="issue ${isError ? 'issue--error' : ''}">${text}</p>`;
}

async function run(context, token) {
  renderMessage('Validating…');
  try {
    const html = await fetchSource(context, token);
    renderPanel(validatePage(html, config));
  } catch (err) {
    renderMessage(err.message || 'Validation failed', true);
  }
}

(async function init() {
  const { context, token } = await DA_SDK;

  const refresh = document.querySelector('#refresh');
  if (refresh) refresh.addEventListener('click', () => run(context, token));

  await run(context, token);
}());
