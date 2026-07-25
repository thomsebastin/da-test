// Import DA App SDK (resolved at runtime from da.live).
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { runPreflight } from './preflight.js';
import { preflightConfig } from './config.js';

const SEVERITY_ICON = { error: '✖', warning: '⚠', info: 'ℹ' };

/** Render one issue as a list item. */
function issueItem(issue) {
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
  return li;
}

/** Render a titled section of issues, or nothing when the list is empty. */
function section(title, issues) {
  if (!issues.length) return null;
  const wrap = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = `${title} (${issues.length})`;
  const list = document.createElement('ul');
  list.className = 'issues';
  issues.forEach((issue) => list.append(issueItem(issue)));
  wrap.append(h, list);
  return wrap;
}

/** Render the preflight report as a publish gate. */
function renderReport(report) {
  const root = document.querySelector('#panel');
  root.innerHTML = '';

  const gate = document.createElement('div');
  gate.className = `gate gate--${report.pass ? 'pass' : 'fail'}`;
  gate.textContent = report.pass
    ? 'Ready to publish'
    : `Not ready — ${report.failures.length} blocker${report.failures.length === 1 ? '' : 's'}`;
  root.append(gate);

  const advisories = report.issues.filter((i) => i.severity !== 'error');
  const blockers = section('Must fix before publish', report.failures);
  const advice = section('Recommended', advisories);

  if (blockers) root.append(blockers);
  if (advice) root.append(advice);
  if (!blockers && !advice) {
    const ok = document.createElement('p');
    ok.className = 'issue issue--ok';
    ok.textContent = 'All preflight checks passed ✔';
    root.append(ok);
  }
}

/** Render an error/status message. */
function renderMessage(text, isError = false) {
  const root = document.querySelector('#panel');
  root.innerHTML = `<p class="issue ${isError ? 'issue--error' : ''}">${text}</p>`;
}

async function run(context, token) {
  renderMessage('Running preflight…');
  try {
    renderReport(await runPreflight(context, token, preflightConfig));
  } catch (err) {
    renderMessage(err.message || 'Preflight failed', true);
  }
}

(async function init() {
  const { context, token } = await DA_SDK;

  const refresh = document.querySelector('#refresh');
  if (refresh) refresh.addEventListener('click', () => run(context, token));

  await run(context, token);
}());
