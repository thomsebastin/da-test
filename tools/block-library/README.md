# Block Library

A DA (Document Authoring) app that automatically builds a browsable, click-to-preview
catalog of every block and variation authored in a single reference document — no manual
registration of blocks or variants required.

## How it works

```
docs/library/blocks (DA doc) ──▶ admin.da.live source ──▶ buildCatalog() ──▶ browsable UI
                                                                                   │
                                                              click a variation ──┘
                                                                                   ▼
                                                    isolated iframe (preview.html) decorates
                                                    the block with this project's own
                                                    scripts/aem.js + styles/styles.css —
                                                    the exact same code a real page uses.
```

Authors add block examples to one DA document exactly the way they'd author any page —
there is no special syntax. Each block instance in that document (one instance = one
variation) is picked up automatically:

- The block's **first class is its name**, remaining classes are variant modifiers — the
  standard EDS convention (e.g. authoring "Cards (bordered)" in a table produces
  `<div class="cards bordered">`).
- An optional **heading placed directly above** an instance becomes its display label.
- **`metadata`** and **`section-metadata`** blocks are ignored (structural, not examples).

Nothing else about the document is prescribed — put one variation per section, several per
section, group related variations under a heading, whatever reads best to authors.

## Files

| File | Role |
|---|---|
| `config.js` | The one thing that varies per site: the catalog document's path. |
| `da-context.js` | Resolves DA_SDK `context` → `admin.da.live` / `da.live` URLs for an arbitrary path. |
| `parse-library.js` | Pure `buildCatalog(html)` — groups block instances into blocks + variations. |
| `preview.html` / `preview.js` | Isolated render harness: decorates a block with real site CSS/JS in its own iframe. |
| `block-library.html` / `block-library.js` / `block-library.css` | The app UI: block list, variation grid, preview modal. |
| `test/parse-library.smoke.html` | Browser smoke test for the parser and URL helpers. |

## Using it

Open the app (see registration below). It lists every block name found in the catalog
document in a sidebar, with a count of variations. Click a block name to see its variations
as cards; click a card to open a live preview, rendered with this project's real block CSS
and JS (carousels, tabs, accordions, etc. all behave exactly as they do on a page). The
preview panel also offers:

- **View HTML** — the raw markup for that variation, for copy/paste or as reference for a
  manual page edit.
- **Copy HTML** — copies it to the clipboard.
- **Insert into open document** — calls the DA SDK's `sendHTML` action. This only does
  something useful when Block Library is opened as a **library plugin** alongside an open
  document (see registration below); in the standalone app it's a no-op.

If the catalog document doesn't exist yet, the app shows an empty state with a direct link
to create it in DA.

## Configuring for this site (or another)

Org and site are **never hardcoded** — the DA App SDK's `context` already carries them
(the app always runs inside `da.live/app/{org}/{site}/...` or a library plugin bound to a
document in that org/site), so copying this `tools/block-library/` folder into another
site's repo works with no code change.

The one per-site setting is the catalog document's path, defaulted in `config.js`:

```js
const DEFAULT_CONFIG = {
  libraryPath: '/docs/library/blocks',
};
```

Override it per-registration without touching code via a `?library=` query param on the
registered path, e.g. `.../block-library.html?library=/tools/examples/blocks`.

## Registering in DA

Register it either (or both) ways:

### As a fullscreen app — for browsing/reference

1. Open the site config: <https://da.live/config#/thomsebastin/da-test/>
2. Add a row to the **`apps`** sheet:

   | title | description | image | path |
   |---|---|---|---|
   | Block Library | Browse and preview every block variation | | `https://da.live/app/thomsebastin/da-test/tools/block-library/block-library` |

3. Save. It now appears on the apps dashboard at <https://da.live/apps#/thomsebastin/da-test>.

### As a library plugin — to insert a variation into the document you're editing

1. Open the same site config.
2. Add a row to the **`library`** sheet:

   | title | path | icon | experience |
   |---|---|---|---|
   | Block Library | `https://main--da-test--thomsebastin.aem.live/tools/block-library/block-library.html` | | dialog |

3. Save. It now appears in the editor's **Library** palette, and the **Insert into open
   document** button in the preview modal works.

Use `main--da-test--thomsebastin.aem.page` instead of `aem.live` to test from preview
before the code reaches `main`.

## Authoring the catalog document

Create `/docs/library/blocks` (or your configured path) in DA and author one instance per
variation you want catalogued, e.g.:

```
## Bordered
[Cards (bordered) block with its normal content]

## Event
[Cards (event) block with its normal content]
```

Only blocks that exist under `/blocks/{name}/` in this repo will render fully decorated;
others still show up with their raw authored markup so nothing is silently dropped.

## Testing

`parse-library.js` and `da-context.js` are pure (DOMParser only, no network), so they run
identically in the app and in a plain browser:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899/tools/block-library/test/parse-library.smoke.html
```

To exercise the full UI locally (parsing, live rendering, preview modal, insert action)
without a live DA session, stub the DA SDK module and the catalog fetch response — see the
project's Playwright-based verification approach for an example of intercepting
`https://da.live/nx/utils/sdk.js` and the `admin.da.live/source/...` request.
