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

`validation.html` is a DA **Library (sidebar) plugin** — it opens beside the document you
are editing and validates *that* page. It is registered in the **`library`** sheet of the
site config (org `thomsebastin`, site `da-test`).

1. Open the site config: <https://da.live/config#/thomsebastin/da-test/>
2. Add (or edit) the **`library`** sheet and add a row:

   | title | path | icon | experience |
   |---|---|---|---|
   | Content Validation | `https://main--da-test--thomsebastin.aem.live/tools/validation/validation.html` | | dialog |

3. Save. The plugin now appears in the editor's **Library** palette. Open a page in DA, open
   the Library, and pick **Content Validation** to run it.

Notes on the columns (see [Setup library](https://docs.da.live/administrators/guides/setup-library)):

- **`path`** is the full URL to the `.html` (the `.html` extension is required). Use the
  `aem.live` host once the code is on `main`, or `main--da-test--thomsebastin.aem.page` to
  test from preview.
- **`experience: dialog`** makes it open as a sidebar panel rather than a fullscreen app.
- **`icon`** is optional — a full URL to a `.png`.

Because it runs against the open document, the SDK provides that page's context; the plugin
fetches its source from `admin.da.live`, runs the shared validator, and renders a status
panel with a **Re-check** button.

> Do **not** use the `apps` sheet for this — that registers a *fullscreen* app with no open
> document, so it would try to validate itself instead of the page being edited.

## Preflight (Layer 2)

Preflight is the formal **publish gate**. It reuses the same engine as the inline validator
but frames the result as pass/fail: any `error`-severity issue blocks, and `warning`/`info`
become advisories. `preflight-panel.js` + `preflight.html` provide a UI; `preflight.js`
provides the logic.

### Relationship to DA's native Preflight

DA ships a **native Preflight** in the **Prepare** menu that already checks: broken /
unpublished links and fragments, leftover placeholder text, and SEO (title, meta
description, single H1). Our check **augments** it — it runs as a *separate* Prepare item
(distinct title **"Content Checks"**) and covers what native does not:

- required blocks are present (e.g. `hero`)
- block-field completeness (hero heading + image, CTA text + href)
- image **alt text**
- primary CTA presence

To avoid double-reporting, the preflight config (`preflightConfig` in `config.js`) drops the
title/description metadata checks that native SEO already performs. The inline validator
keeps them, since it runs while editing — before Prepare is ever opened.

### Registering (Prepare menu)

Add a row to the **`prepare`** sheet in the site (or org) config at
<https://da.live/config#/thomsebastin/da-test/>:

| title | path | icon | ref |
|---|---|---|---|
| Content Checks | `/tools/validation/preflight` | | main |

> Using the title **"Content Checks"** (not "Preflight") makes it appear **alongside** the
> native Preflight. Registering with the title `Preflight` would *replace* the native check
> instead — see [Preflight](https://docs.da.live/administrators/guides/prepare-menu/preflight).

Then: open a page → **Prepare** → **Content Checks**. It shows a green **Ready to publish**
banner, or a red **Not ready — N blockers** banner with the must-fix list.

### Programmatically

For a custom check or any pre-publish automation:

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

### Plugin vs. preflight

Both run the same rules, so results never diverge. The difference is intent:

| | Inline validator | Preflight |
|---|---|---|
| Purpose | Guidance while editing | Pass/fail gate before publish |
| Errors | Shown as issues | **Block** readiness |
| Surface | `validation.html` | `preflight.html` |

Heavier, preflight-only checks from the rollout plan (broken links, template conformity,
cross-page governance) slot in as new rule evaluators in `rules.js` gated behind a preflight
config flag — the panel and gate need no changes.

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
