# Block Library

A DA (Document Authoring) app that automatically builds a browsable, click-to-preview
catalog of every block and variation, from a single catalog **sheet** — no manual UI
wiring per block, and no code change needed to add a new one.

## How it works

```
docs/library/blocks (DA sheet: name, path) ──▶ admin.da.live source (.json)
        │                                              │
        │ rows grouped by name                         ▼
        ▼                                     parseCatalogSheet()
   block list (sidebar)                                │
        │                                              ▼
   click a block ──▶ variation cards (one per row)
        │
   click a card ──▶ fetch row.path (the example page) ──▶ findBlockInstance()
                            │
                            ▼
        isolated iframe (preview.html) decorates the found instance with this
        project's own scripts/aem.js + styles/styles.css — the exact same code
        a real page uses.
```

This follows the same convention as DA's own native `library` config's `blocks`
sub-sheet: the catalog is a **sheet** with a `name` column (the block name) and a `path`
column (a link to a page containing an authored example of it). Several rows can share a
`name` — each is a separate variation, each with its own example page. An optional
`label` (or `description`) column gives a friendlier display name than the page's path.

The linked example pages are authored exactly like any other page — no special syntax.
The block's first class is its name, remaining classes are variant modifiers (e.g.
authoring "Cards (bordered)" in a table produces `<div class="cards bordered">`), and an
optional heading placed directly above the instance becomes its fallback label when the
sheet row has none.

Nothing is prescribed about the *catalog sheet's* path values either: a bare DA path
(e.g. `/docs/library/examples/cards-bordered`) is resolved and fetched (authenticated)
via `admin.da.live/source`; a full `https://content.da.live/...` URL is fetched directly
(public, no auth) — matching how DA's own `blocks` sub-sheet documentation links examples.

## Files

| File | Role |
|---|---|
| `config.js` | The one thing that varies per site: the catalog sheet's path. |
| `da-context.js` | Resolves DA_SDK `context` → `admin.da.live`/`da.live` URLs, including catalog-row link resolution. |
| `parse-library.js` | Pure `parseCatalogSheet(json)` (sheet → grouped rows) and `findBlockInstance(html, name)` (linked page → block markup). |
| `preview.html` / `preview.js` | Isolated render harness: decorates a block with real site CSS/JS in its own iframe. |
| `block-library.html` / `block-library.js` / `block-library.css` | The app UI: block list, variation grid, preview modal. |
| `test/parse-library.smoke.html` | Browser smoke test for the parser and URL helpers. |

## Using it

Open the app (see registration below). It lists every block name found in the catalog
sheet in a sidebar, with a count of variations (rows). Click a block name to see its
variations as cards (labelled from the row's `label`/`description` column, or a
prettified version of its `path` when absent). Click a card to fetch that row's linked
example page and open a live preview, rendered with this project's real block CSS and JS
(carousels, tabs, accordions, etc. all behave exactly as they do on a page). The preview
panel also offers:

- **View HTML** — the raw markup for that variation, for copy/paste or reference.
- **Copy HTML** — copies it to the clipboard.
- **Edit example page** — opens the linked page in DA's document editor (only shown for
  rows linked by a bare DA path; not applicable to an absolute URL row).
- **Insert into open document** — calls the DA SDK's `sendHTML` action. This only does
  something useful when Block Library is opened as a **library plugin** alongside an open
  document (see registration below); in the standalone app it's a no-op.

If the catalog sheet doesn't exist yet, or a row's linked page doesn't actually contain
the named block, the app shows an explanatory message instead of failing silently.

## Configuring for this site (or another)

Org and site are **never hardcoded** — the DA App SDK's `context` already carries them
(the app always runs inside `da.live/app/{org}/{site}/...` or a library plugin bound to a
document in that org/site), so copying this `tools/block-library/` folder into another
site's repo works with no code change.

The one per-site setting is the catalog sheet's path, defaulted in `config.js`:

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

## Authoring the catalog

1. Create `/docs/library/blocks` (or your configured path) in DA as a **sheet**
   (`da.live/sheet#/{org}/{site}/docs/library/blocks`), with columns `name`, `path`, and
   optionally `label` (or `description`).
2. For each variation you want catalogued, author a page containing that block instance
   (with its normal content), and add a row pointing `path` at it:

   | name | path | label |
   |---|---|---|
   | cards | `/docs/library/examples/cards-bordered` | Bordered |
   | cards | `/docs/library/examples/cards-event` | Event |
   | hero | `/docs/library/examples/hero-basic` | |

   Multiple rows with the same `name` are grouped as that block's variations; each still
   points at its own example page (one block instance per page is simplest, though only
   the *first* matching instance on a page is used if there's more than one).

Only blocks that exist under `/blocks/{name}/` in this repo will render fully decorated;
others still show up with their raw authored markup so nothing is silently dropped.

## Testing

`parse-library.js` and `da-context.js` are pure (DOMParser only, no network), so they run
identically in the app and in a plain browser:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899/tools/block-library/test/parse-library.smoke.html
```

To exercise the full UI locally (sheet fetch, per-row linked-page fetch, live rendering,
preview modal, insert action) without a live DA session, stub the DA SDK module and the
`admin.da.live`/`content.da.live` requests — see the project's Playwright-based
verification approach for an example of intercepting
`https://da.live/nx/utils/sdk.js`, the sheet's `.json` source, and each row's linked page.
