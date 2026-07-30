/**
 * Render harness loaded in an isolated iframe by block-library.js.
 *
 * Reuses this project's own block decoration pipeline (`scripts/aem.js`) directly — the
 * catalog document lives in the same repo as the blocks it showcases, so previews get the
 * exact CSS/JS a real page would, with no separate build step or copy of block logic.
 * Isolated in its own document (rather than rendered inline in the app) so a block's CSS
 * can never leak into the app's own chrome.
 */

import {
  decorateButtons, decorateIcons, decorateBlock, loadBlock, loadCSS,
} from '../../scripts/aem.js';

const mount = document.querySelector('main .section');

function reportHeight() {
  const { height } = mount.getBoundingClientRect();
  window.parent.postMessage(
    { type: 'block-library-preview-height', height: Math.ceil(height) },
    window.location.origin,
  );
}

async function render(html) {
  mount.innerHTML = html;
  const block = mount.firstElementChild;
  if (!block) {
    reportHeight();
    return;
  }
  try {
    decorateButtons(mount);
    decorateIcons(mount);
    decorateBlock(block);
    await loadBlock(block);
  } catch (err) {
    // Block JS threw — still show the (undecorated) markup rather than a blank preview.
    // eslint-disable-next-line no-console
    console.error('Block Library preview failed to decorate block', err);
  }
  reportHeight();
  // Block JS may resize content asynchronously (images, carousels); report again shortly.
  window.setTimeout(reportHeight, 300);
}

window.addEventListener('message', (e) => {
  if (e.origin !== window.location.origin) return;
  if (e.data?.type === 'block-library-render') render(e.data.html);
});

window.addEventListener('load', () => {
  loadCSS('/styles/fonts.css');
  window.parent.postMessage({ type: 'block-library-preview-ready' }, window.location.origin);
});
