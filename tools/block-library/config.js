/**
 * Block Library configuration.
 *
 * The org and site are never configured here — the DA App SDK context already carries them
 * (the app is always opened as `da.live/app/{org}/{site}/...` or as a library plugin bound
 * to a document in that org/site), so the same code works unmodified in any org/site.
 *
 * The one thing that *does* vary per site is where the catalog document lives. Default it
 * here, and allow a `?library=/some/path` override so the same deployed tool can point at a
 * different catalog without a code change (handy when copying this folder into another repo
 * that keeps its examples somewhere else).
 */

const DEFAULT_CONFIG = {
  // DA path (no extension) to the document authors use to catalog block examples.
  libraryPath: '/docs/library/blocks',
};

/**
 * @returns {{libraryPath: string}}
 */
export function getConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    libraryPath: params.get('library') || DEFAULT_CONFIG.libraryPath,
  };
}

export default DEFAULT_CONFIG;
