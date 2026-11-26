---
name: "my-qa-release-report"
description: "Build and publish a one-page HTML QA release report, the same layout in every repo: sidebar agenda, test cases grouped by issue, each with what was tested, expected, actual result (pass/fail) and numbered screenshot evidence, plus a screenshot viewer. Use after any release or milestone QA pass, or whenever Toi asks for a test report, QA report, release report or \"báo cáo test\", in any repo."
---

# QA release report

Turns the results of a test pass into one self-contained HTML page that a PO or reviewer can read without opening GitHub. Toi wants **the same page in every repo**, so the page is never hand-written: you write a `report.json` and the build script (`scripts/build-report.mjs`) renders it. Only the content changes from repo to repo; the layout never does.

Every report has:

- A sidebar agenda: issue titles as small grey group labels, test cases as large links, failed cases red; a drawer on narrow screens.
- A failure banner, summary counts, then one collapsible block per issue (Expand all / Collapse all).
- Each test case in this order: **title → what is tested → expected → actual result** (pass/fail, one bullet per finding, each ending with links like "Ảnh 3 Ảnh 6" to the screenshots that prove it) **→ raw test output (collapsed) → numbered screenshots**.
- A screenshot viewer (click a screenshot: prev/next, arrow keys, zoom, Esc).
- An EN/VI toggle when the report is bilingual.

## Steps

### 1. Get the build script

Use `scripts/build-report.mjs` from this skill's folder (it reads `assets/report.css` and `assets/report.js` next to it). Do not change it, shorten it or write your own page: identical output across repos depends on it. It needs only Node 18+. Change the design only in `assets/`, never per report.

### 2. Collect the results

The report only shows evidence from this session. If the tests have not been run, run them first. If the repo has its own QA guide (a QA agent, a test plan, a CONTRIBUTING section), follow it for what to test; this skill only decides how the results are reported. Default when nothing says otherwise: test the production build with Playwright, light and dark themes, at 320, 375 and 1280px.

Group the work by the issues in the release. For each test case collect what you did, what the issue says should happen, what happened, the raw lines your script logged, and the screenshots.

Name screenshots `<case-id>-<what>-<light|dark>-<width>.png` (e.g. `98-4-travel-dark-375.png`): the caption "dark · 375px" is read from the name. Capture at `deviceScaleFactor: 1`. For desktop widths prefer viewport or element shots to full-page shots, which become unreadable in the grid. Keep screenshots as full-size PNG: when the tests already produced evidence (for example the PNGs committed in the evidence PR), embed those originals as they are, and never re-encode them to JPEG or reuse JPEGs from an older report, because Toi saw them as blurry. Only if the built page would pass ~15 MB, save the largest shots as JPEG (`type: 'jpeg', quality: 90`).

### 3. Write report.json

Put `report.json` next to a `shots/` folder in the scratch folder. Read [references/report-json-format.md](references/report-json-format.md) and [examples/report.example.json](examples/report.example.json) first, and match the example's tone and level of detail:

- **One case = one thing a reviewer would tick off.** Split a case when its findings need different screenshots.
- **`tested`** names the pages, widths, themes and actions. **`expected`** comes from the issue's acceptance criteria, not from what you saw.
- **`result`** is one sentence that starts with "Matches:" / "Does not match:" ("Đúng như mong muốn:" / "Không đúng như mong muốn:"). The detail goes in `findings`.
- **Every finding points to the screenshots that prove it**, so a reviewer never has to guess which of 14 screenshots shows the bug. For a failure, point to the shot where the defect is most visible (often the desktop shot that shows all items side by side), name the cause (file, field, component) and the decision needed, and add a separate finding for what still passed.
- Never mark pass what you did not check. What only a person can do (real Safari, real phones, a visual "no flash" check) goes in `notCovered`.
- Sort issues by issue number. Issues tested together share one block (`"label": "#101 and #102"`).
- If Toi writes in Vietnamese, make it bilingual (`"languages": ["en", "vi"]`) and write both texts; keep `raw` exactly as logged.

### 4. Build

```bash
node <skill folder>/scripts/build-report.mjs <scratch>/report.json --out <scratch>/report.html
```

Fix every error (missing file, a finding that points to a shot that does not exist). Treat "not referenced by any finding" warnings seriously: point a finding at the shot or drop it. `--skip-missing` (grey placeholders for missing screenshots) is only for previewing an example, never for a real report.

### 5. Check it in a browser

Open `report.html` with Playwright before handing it over: screenshot the top of the page and one failed case (both languages if bilingual), click a sidebar link, a "Ảnh n" link and a screenshot (the viewer must open), and check there are no page errors.

### 6. Publish

Publish `report.html` as an artifact (`mcp__claude-artifacts__publish_files`) and give Toi the link. To update a report, republish to the same artifact with its current `base_version`. Without the Artifact tool, send the HTML file. Then summarise in two or three sentences: pass/fail counts, the failed cases, and what is left for a person.
