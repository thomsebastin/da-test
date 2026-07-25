# Content Validation

A two-layer readiness validator for DA / Edge Delivery pages. It gives authors
"mandatory-field-like" behavior that DA does not provide natively, without inventing two
sets of rules:

1. **DA plugin** (`validation.html`) — immediate, inline author feedback while editing.
2. **Preflight runner** (`preflight.js`) — a formal pass/fail gate before publish/handoff.

Both consume the **same shared validator**, so authors and reviewers always see identical
rule outcomes.

## Files

| File | Role |
|---|---|
| `config.js` | The site validation contract (declarative, JSON-serializable). |
| `parse-page.js` | Parses DA source HTML into a normalized page model. |
| `rules.js` | Rule logic: field detectors, rule evaluators, named page rules. |
| `validate-page.js` | Shared engine — `validatePage(html)` / `validateModel(model)`. |
| `validation.html` / `validation.js` | Layer 1: the DA plugin UI. |
| `preflight.js` | Layer 2: `runPreflight(context, token)` / `preflightHtml(html)`. |
| `test/smoke.html` | Browser smoke test for the shared engine. |

## How it works

```
DA source HTML ──▶ parsePage() ──▶ PageModel ──▶ validateModel(model, config) ──▶ result
                                                    ▲
                                                    │ same engine
                        ┌───────────────────────────┴───────────────────────────┐
                   DA plugin (inline)                              Preflight (gate)
```

Page content is read from **`admin.da.live`** (the source of truth), not `content.da.live`.

A result looks like:

```js
{
  ready: false,                 // true when there are no error-severity issues
  status: 'errors',             // 'ready' | 'warnings' | 'errors'
  counts: { error: 2, warning: 1, info: 0 },
  issues: [
    { severity: 'error', code: 'HERO_HEADING_MISSING',
      message: 'hero block must include heading', location: 'block:hero' },
    // ...sorted most-severe first
  ],
}
```

## Configuring rules

Edit `config.js`. It is declarative and JSON-serializable — the logic lives in `rules.js`.

```js
requiredMetadata: [{ name: 'title', severity: 'error' }],
requiredBlocks:   [{ name: 'hero',  severity: 'error' }],
blockRules: {
  hero: { requiredFields: ['heading', 'image'], severity: 'error' },
  cta:  { requiredFields: ['text', 'href'],     severity: 'error' },
},
accessibility: { requireImageAlt: true, severity: 'warning' },
pageRules: [{ code: 'REQUIRE_PRIMARY_CTA', severity: 'warning' }],
```

- **Severities:** `error` blocks readiness/preflight, `warning` is recommended, `info` is advisory.
- **Block field names** (`heading`, `image`, `text`, `href`, `alt`) resolve via the field
  detectors in `rules.js`; any other name falls back to matching a block config row.
- **Page rules** are referenced by `code`; implement new ones in the `pageRules` registry
  in `rules.js`.

## Registering the DA plugin

`validation.html` is a standard DA App SDK app. Register it in your site config so it shows
on the DA apps page (org `thomsebastin`, site `da-test`).

1. Open the site config: <https://da.live/config#/thomsebastin/da-test/>
2. Add (or edit) the **`apps`** sheet and add a row:

   | title | description | image | path | ref |
   |---|---|---|---|---|
   | Content Validation | Checks pages for required content before publish | | `/tools/validation/validation` | main |

3. Save. The app card appears at <https://da.live/apps#/thomsebastin/da-test> and opens at
   <https://da.live/app/thomsebastin/da-test/tools/validation/validation>.

It loads the current page context from the SDK, fetches source from `admin.da.live`, runs
the shared validator, and renders a status panel with a **Re-check** button.

> The `apps` sheet columns are `title`, `description`, `image`, `path`, `ref` — see
> [Developing apps & plugins](https://docs.da.live/developers/guides/developing-apps-and-plugins).

## Using preflight

From a custom DA preflight check, or any pre-publish automation:

```js
import { runPreflight } from '/tools/validation/preflight.js';

const report = await runPreflight({ org, repo, path, ext }, token);
if (!report.pass) {
  // report.failures → error-severity issues that block publish
  // report.issues   → everything, for a full report
}
```

`preflightHtml(html)` is the pure, network-free variant — handy for tests or when you
already hold the source HTML.

## Testing

Open `test/smoke.html` through a static server rooted at the project (so `/tools/...`
imports resolve) and check that all assertions pass:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899/tools/validation/test/smoke.html
```

## Rollout

- **Phase 1 (shipped defaults):** title, description, hero + hero heading/image, CTA
  href, image alt text.
- **Phase 2:** governance — allowed block combinations, duplicate CTA detection, broken
  links, SEO quality.
- **Phase 3:** site-specific — locale requirements, campaign metadata, regulated content.
