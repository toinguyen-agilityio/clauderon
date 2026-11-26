# report.json format

Every text field (**T**) is a plain string or `{ "en": "…", "vi": "…" }`. `languages` sets the keys and the order of the language buttons; the first is the default. Backticks render as code; no other markup. Screenshot paths are relative to the JSON file.

**Top level:** `title` T (required) · `languages` string[] (default `["en"]`; UI labels exist for `en` and `vi`) · `eyebrow` T · `meta` T (date, build, browser, commit, widths, themes) · `issuesNote`, `casesNote` T (note under each summary card) · `issues` Issue[] (required, rendered in this order) · `notCovered` T[] · `footer` `{ "title": T, "items": [{ "text": T, "href": "…", "linkText": "…" }] }` (e.g. the evidence PR).

The failure banner, all counts and each issue's pass/fail are computed from the cases. Never write them by hand.

**Issue:** `id` (anchor `#i-<id>`: the issue number, or a slug such as `"sport"` for issues tested together) · `label` (default `#<id>`) · `title` T · `links` `[{ "text": T, "href": "…" }]` · `cases` Case[] · `extra` `[{ "status": "pass"|"fail", "text": T }]` (release-wide checks without screenshots).

**Case:** `id` (unique, e.g. `"105-1"`) · `title` T · `status` `"pass"|"fail"` · `tested` T · `expected` T · `result` T · `findings` `[{ "text": T, "shots": [n, …] }]` (1-based numbers into `shots`) · `raw` string[] (shown collapsed) · `shots` (string | `{ "file": "…", "label": T }`)[] (numbered 1…n in this order; `label` overrides the caption).

## Example

An excerpt of a real report Toi signed off (Release 1 of his portfolio: 5 issues, 29 cases, 1 failure). Copy its tone and level of detail, never its content. The full file is [examples/report.example.json](../examples/report.example.json); build it with `--skip-missing` to preview.

What to notice: `expected` is written from the issue before looking; the failed case names the file and field behind the bug and the decision needed; each finding links the exact shots that prove it (desktop shots 3 and 6 show all three cards side by side); what still passed gets its own finding; checks without screenshots go in `extra`; what nobody checked goes in `notCovered`.
