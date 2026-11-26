#!/usr/bin/env node
// Build a single-file QA release report (HTML) from a report.json spec and its screenshots.
// Usage: node build-report.mjs <report.json> [--out report.html] [--skip-missing]
// --skip-missing: draw a grey placeholder for screenshots that are not on disk (to preview examples/release-1).
// No dependencies (Node 18+). Screenshots are embedded as data: URIs, so the output can be published as-is.
// The CSS and JS of the page are at the bottom of this file. Change the design there, so every report keeps it.
// The JSON format is documented in the my-qa-release-report SKILL.md.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';

const args = process.argv.slice(2);
if (!args[0] || args[0] === '-h' || args[0] === '--help') {
  console.log('Usage: node build-report.mjs <report.json> [--out report.html] [--skip-missing]');
  process.exit(args[0] ? 0 : 1);
}
const specPath = resolve(args[0]);
const outIdx = args.indexOf('--out');
const outPath = resolve(outIdx > -1 ? args[outIdx + 1] : join(dirname(specPath), 'report.html'));
const skipMissing = args.includes('--skip-missing');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const base = dirname(specPath);
const LANGS = spec.languages?.length ? spec.languages : ['en'];
const errors = [], warnings = [];
let missing = 0;

const UI = {
  en: { eyebrow: 'Release test report', pass: 'Pass', fail: 'Fail', tested: 'What is tested', expected: 'Expected',
    result: 'Actual result', raw: 'Detailed test output', rawNote: 'Raw test output.', evidence: (n) => `Evidence (${n} screenshots)`,
    shot: (n) => `Shot ${n}`, light: 'light', dark: 'dark', agenda: 'Test cases', expand: 'Expand all', collapse: 'Collapse all',
    issuesH: 'Issues in the release', issues: 'issues', passed: 'passed', failed: 'failed', casesH: 'Test cases', cases: 'cases',
    blocks: 'Results by block', alertFail: (c, i) => `${c} failed check${c > 1 ? 's' : ''}, ${i} issue${i > 1 ? 's' : ''} affected`,
    alertOk: 'All checks passed', checks: (p, t) => `${p} of ${t} checks passed`, other: 'Other release-wide checks',
    notCovered: 'Not covered', zoom: 'Zoom in / Fit', close: 'Close' },
  vi: { eyebrow: 'Báo cáo kiểm thử bản phát hành', pass: 'Đạt', fail: 'Không đạt', tested: 'Nội dung test', expected: 'Mong muốn',
    result: 'Kết quả thực tế', raw: 'Chi tiết kết quả test', rawNote: 'Kết quả test gốc, bằng tiếng Anh.', evidence: (n) => `Ảnh bằng chứng (${n} ảnh)`,
    shot: (n) => `Ảnh ${n}`, light: 'sáng', dark: 'tối', agenda: 'Danh sách test case', expand: 'Mở tất cả', collapse: 'Thu gọn tất cả',
    issuesH: 'Issue trong bản phát hành', issues: 'issue', passed: 'đạt', failed: 'không đạt', casesH: 'Ca kiểm thử', cases: 'ca',
    blocks: 'Kết quả theo nhóm', alertFail: (c, i) => `${c} kiểm tra không đạt, ảnh hưởng ${i} issue`,
    alertOk: 'Tất cả kiểm tra đều đạt', checks: (p, t) => `${p}/${t} kiểm tra đạt`, other: 'Các kiểm tra khác toàn bản phát hành',
    notCovered: 'Chưa kiểm tra', zoom: 'Phóng to / Vừa màn hình', close: 'Đóng' },
};
const ui = (lang) => UI[lang] || UI.en;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// inline `code` is the only markup allowed in text
const fmt = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const pick = (v, lang) => (v && typeof v === 'object' ? (v[lang] ?? v[LANGS[0]] ?? v.en ?? '') : (v ?? ''));
// Render a text value in every language. Plain strings and single-language reports render without spans.
function t(v) {
  if (LANGS.length === 1) return fmt(pick(v, LANGS[0]));
  if (typeof v !== 'object' || v === null) return fmt(v);
  return LANGS.map((l) => `<span lang="${l}">${fmt(pick(v, l))}</span>`).join('');
}
function u(key, ...a) {
  const val = (l) => { const x = ui(l)[key]; return typeof x === 'function' ? x(...a) : x; };
  if (LANGS.length === 1) return esc(val(LANGS[0]));
  return LANGS.map((l) => `<span lang="${l}">${esc(val(l))}</span>`).join('');
}
const plain = (v) => pick(v, LANGS[0]);
const pill = (st, big = false) => `<span class="pill ${st}${big ? ' big' : ''}">${u(st)}</span>`;

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
function dataUri(file, where) {
  const p = resolve(base, file);
  if (!existsSync(p)) {
    if (!skipMissing) { errors.push(`${where}: screenshot not found: ${file}`); return ''; }
    missing++;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="100%" height="100%" fill="#e3e6ee"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#596073">${esc(basename(file))}</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
  const mime = MIME[extname(p).toLowerCase()];
  if (!mime) { errors.push(`${where}: unsupported image type: ${file}`); return ''; }
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}
// PNG/JPEG dimensions, so the grid can reserve space before images decode.
function dims(file) {
  try {
    const b = readFileSync(resolve(base, file));
    if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) break;
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + len;
      }
    }
  } catch {}
  return null;
}
// "<case>-<what>-<light|dark>-<width>.png" -> theme + width for the caption
function parseName(file) {
  const m = basename(file, extname(file)).match(/-(light|dark)-(\d+)$/);
  return m ? { theme: m[1], width: m[2] } : {};
}

// ---------- validate + derive ----------
const issues = spec.issues || [];
if (!issues.length) errors.push('report.json has no issues');
const seen = new Set();
for (const is of issues) {
  is.id = String(is.id);
  is.cases = is.cases || [];
  if (!is.cases.length) warnings.push(`issue ${is.id}: no test cases`);
  for (const c of is.cases) {
    const where = `case ${c.id}`;
    if (!c.id) errors.push(`issue ${is.id}: a case has no id`);
    if (seen.has(c.id)) errors.push(`${where}: duplicate id`); seen.add(c.id);
    if (!['pass', 'fail'].includes(c.status)) errors.push(`${where}: status must be "pass" or "fail"`);
    for (const k of ['title', 'tested', 'expected', 'result']) if (!c[k]) errors.push(`${where}: missing "${k}"`);
    c.shots = (c.shots || []).map((s) => (typeof s === 'string' ? { file: s } : s));
    c.findings = c.findings || [];
    const used = new Set();
    for (const f of c.findings) for (const n of f.shots || []) {
      if (n < 1 || n > c.shots.length) errors.push(`${where}: finding points to shot ${n}, but the case has ${c.shots.length}`);
      used.add(n);
    }
    c.shots.forEach((_, i) => { if (!used.has(i + 1)) warnings.push(`${where}: shot ${i + 1} (${c.shots[i].file}) is not referenced by any finding`); });
    if (c.status === 'fail' && !c.findings.length) warnings.push(`${where}: failed case has no findings explaining why`);
  }
  is.status = is.cases.some((c) => c.status === 'fail') ? 'fail' : 'pass';
}
if (errors.length) { console.error('Errors:\n- ' + errors.join('\n- ')); process.exit(1); }

const allCases = issues.flatMap((i) => i.cases);
const failedCases = allCases.filter((c) => c.status === 'fail');
const failedIssues = issues.filter((i) => i.status === 'fail');

// ---------- render ----------
function renderCase(c) {
  const findings = c.findings.map((f) => {
    const refs = (f.shots || []).map((n) => `<a class="ref" href="#s-${esc(c.id)}-${n}">${u('shot', n)}</a>`).join(' ');
    return `<li>${t(f.text)} ${refs}</li>`;
  }).join('');
  const raw = (c.raw || []).length
    ? `<details class="checked"><summary>${u('raw')} (${c.raw.length})</summary><p class="note">${u('rawNote')}</p><ul>${c.raw.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>`
    : '';
  const figs = c.shots.map((s, i) => {
    const n = i + 1, { theme, width } = { ...parseName(s.file), ...s };
    const d = dims(s.file);
    const label = s.label ? t(s.label) : [theme ? u(theme) : '', width ? `${esc(width)}px` : ''].filter(Boolean).join(' · ');
    return `<figure id="s-${esc(c.id)}-${n}"><button type="button" class="shot" aria-label="Open screenshot ${n}">`
      + `<img src="${dataUri(s.file, `case ${c.id}`)}"${d ? ` width="${d[0]}" height="${d[1]}"` : ''} alt="Screenshot ${esc(basename(s.file))}" loading="lazy"></button>`
      + `<figcaption><span class="num">${n}</span> ${label}<span class="fn">${esc(basename(s.file, extname(s.file)))}</span></figcaption></figure>`;
  }).join('');
  const ev = c.shots.length ? `<div class="ev"><h4>${u('evidence', c.shots.length)}</h4><div class="shots">${figs}</div></div>` : '';
  return `<article class="case ${c.status}" id="c-${esc(c.id)}">
<header class="case-h">${pill(c.status)}<h3><span class="cid">${esc(c.id)}</span> ${t(c.title)}</h3></header>
<dl class="spec"><div><dt>${u('tested')}</dt><dd>${t(c.tested)}</dd></div><div><dt>${u('expected')}</dt><dd>${t(c.expected)}</dd></div>`
    + `<div class="actual ${c.status}"><dt>${u('result')} ${pill(c.status)}</dt><dd>${t(c.result)}${findings ? `<ul>${findings}</ul>` : ''}</dd></div></dl>
${raw}
${ev}
</article>`;
}

function renderIssue(is) {
  const passed = is.cases.filter((c) => c.status === 'pass').length;
  const links = (is.links || []).map((l) => `<a href="${esc(l.href)}">${t(l.text)}</a>`).join('');
  const extra = (is.extra || []).length
    ? `<div class="xcut"><h3>${u('other')}</h3><ul>${is.extra.map((x) => `<li>${pill(x.status || 'pass')} ${t(x.text)}</li>`).join('')}</ul></div>` : '';
  return `<section class="issue ${is.status}" id="i-${esc(is.id)}">
<details class="issue-d" open><summary class="issue-h"><div><p class="eyebrow">${esc(is.label || '#' + is.id)}</p><h2>${t(is.title)}</h2>${links ? `<p class="links">${links}</p>` : ''}</div>`
    + `<div class="res">${pill(is.status, true)}<span class="count">${u('checks', passed, is.cases.length)}</span></div><span class="chev" aria-hidden="true"></span></summary>
<div class="issue-body">${is.cases.map(renderCase).join('\n')}${extra}</div></details>
</section>`;
}

const toc = `<nav class="toc" id="toc" aria-label="Test cases"><div class="toc-head">${u('agenda')}<button type="button" class="toc-x" data-toc="close" aria-label="Close">&#10005;</button></div>
<ul class="toc-list">${issues.map((is) => `<li class="toc-issue"><a href="#i-${esc(is.id)}" class="toc-i">${esc(is.label || '#' + is.id)} · ${t(is.title)}</a><ul>`
  + is.cases.map((c) => `<li><a href="#c-${esc(c.id)}" class="toc-case ${c.status}">${t(c.title)}${c.status === 'fail' ? `<span class="toc-tag">${u('fail')}</span>` : ''}</a></li>`).join('')
  + '</ul></li>').join('')}</ul></nav>
<button type="button" class="toc-open" data-toc="open">${u('agenda')}</button>`;

const firstReason = (c) => (c.findings[0] ? c.findings[0].text : c.result);
const alert = failedCases.length
  ? `<aside class="alert" role="alert"><h2>${u('alertFail', failedCases.length, failedIssues.length)}</h2><ul>${failedCases.map((c) => {
      const is = issues.find((i) => i.cases.includes(c));
      return `<li><a href="#c-${esc(c.id)}"><strong>${esc(c.id)}</strong> ${t(c.title)}</a> (${esc(is.label || '#' + is.id)}): ${t(firstReason(c))}</li>`;
    }).join('')}</ul></aside>`
  : `<aside class="alert ok"><h2>${u('alertOk')}</h2></aside>`;

const nums = (total, p, f, unit) => `<div class="nums"><div><b>${total}</b><span>${u(unit)}</span></div><div class="p"><b>${p}</b><span>${u('passed')}</span></div><div class="f"><b>${f}</b><span>${u('failed')}</span></div></div>`;
const stats = `<section class="stats">
<div class="stat"><h2>${u('issuesH')}</h2>${nums(issues.length, issues.length - failedIssues.length, failedIssues.length, 'issues')}${spec.issuesNote ? `<p class="meta" style="margin:0">${t(spec.issuesNote)}</p>` : ''}</div>
<div class="stat"><h2>${u('casesH')}</h2>${nums(allCases.length, allCases.length - failedCases.length, failedCases.length, 'cases')}${spec.casesNote ? `<p class="meta" style="margin:0">${t(spec.casesNote)}</p>` : ''}</div>
<div class="stat"><h2>${u('blocks')}</h2><ul class="nav">${issues.map((is) => `<li><a href="#i-${esc(is.id)}">${pill(is.status)} ${esc(is.label || '#' + is.id)} ${t(is.title)}</a></li>`).join('')}</ul></div>
</section>`;

const langBtns = LANGS.length > 1
  ? `<div class="lang" role="group" aria-label="Language">${LANGS.map((l, i) => `<button type="button" data-set-lang="${l}" aria-pressed="${i === 0}">${l.toUpperCase()}</button>`).join('')}</div>` : '';
const notCovered = (spec.notCovered || []).length
  ? `<section class="limits"><h2>${u('notCovered')}</h2><ul>${spec.notCovered.map((x) => `<li>${t(x)}</li>`).join('')}</ul></section>` : '';
const footer = spec.footer
  ? `<section class="pr"><h2>${t(spec.footer.title)}</h2>${(spec.footer.items || []).map((x) => `<p>${t(x.text)}${x.href ? ` <a href="${esc(x.href)}">${esc(x.linkText || x.href)}</a>` : ''}</p>`).join('')}</section>` : '';

const css = CSS(), js = JS();
const html = `<!DOCTYPE html>
<html lang="${LANGS[0]}" data-lang="${LANGS[0]}" data-langs="${LANGS.join(',')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(plain(spec.title))}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>${css}</style>
</head>
<body>
<div class="layout">
${toc}
<div class="wrap">
<header class="top"><div><p class="eyebrow">${spec.eyebrow ? t(spec.eyebrow) : u('eyebrow')}</p><h1>${t(spec.title)}</h1>${spec.meta ? `<p class="meta">${t(spec.meta)}</p>` : ''}</div>${langBtns}</header>
${alert}
${stats}
<div class="toolbar"><button type="button" data-all="open">${u('expand')}</button><button type="button" data-all="close">${u('collapse')}</button></div>
${issues.map(renderIssue).join('\n\n')}
${notCovered}
${footer}
</div>
</div>
<dialog class="lb" id="lb" aria-label="Screenshot viewer">
<div class="lb-bar"><button type="button" data-lb="prev" aria-label="Previous screenshot">&#8249;</button><button type="button" data-lb="next" aria-label="Next screenshot">&#8250;</button>
<div class="lb-cap" id="lb-cap"></div>
<button type="button" data-lb="zoom">${u('zoom')}</button><button type="button" data-lb="close" aria-label="Close">&#10005;</button></div>
<div class="lb-stage fit" id="lb-stage"><img id="lb-img" alt=""></div>
</dialog>
<script>${js}</script>
</body>
</html>
`;
if (errors.length) { console.error('Errors:\n- ' + errors.slice(0, 20).join('\n- ') + (errors.length > 20 ? `\n- …and ${errors.length - 20} more` : '')); process.exit(1); }
writeFileSync(outPath, html);
const mb = (Buffer.byteLength(html) / 1048576).toFixed(1);
if (missing) warnings.push(`${missing} screenshots were missing and drawn as placeholders (--skip-missing)`);
if (warnings.length) console.warn('Warnings:\n- ' + warnings.join('\n- '));
console.log(`Wrote ${outPath} (${mb} MB): ${issues.length} issues, ${allCases.length} cases, ${failedCases.length} failed, ${allCases.reduce((n, c) => n + c.shots.length, 0)} screenshots.`);
if (mb > 15) console.warn('Report is over 15 MB: use JPEG screenshots or fewer full-page shots (the artifact limit is 16 MB).');

// ---------- page design ----------
function CSS() { return `/* QA release report. Layout: sidebar agenda | header, failure banner, summary, one collapsible block per issue.
   Each case: title, what is tested, expected, actual result (findings with screenshot links), raw output, evidence grid. */
:root {
  --bg: #f7f8fb; --surface: #ffffff; --fg: #161a26; --muted: #596073; --line: #dfe3ec;
  --accent: #3a47d5; --pass: #176b3a; --pass-bg: #e3f4ea; --fail: #a4161a; --fail-bg: #fdeaea; --fail-line: #e8a3a5;
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-head: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0f1117; --surface: #171a23; --fg: #e8eaf2; --muted: #a0a7ba; --line: #2b303c;
  --accent: #94a0ff; --pass: #6fd197; --pass-bg: #12301f; --fail: #ff9a9d; --fail-bg: #3a1618; --fail-line: #7a2d31; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 var(--font-body); padding-block: 32px 64px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
img { max-width: 100%; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

/* language toggle: every text node is rendered once per language */
html[data-lang] [lang]:not(html) { display: none; }
html[data-lang="en"] [lang="en"]:not(html), html[data-lang="vi"] [lang="vi"]:not(html) { display: revert; }

.layout { display: grid; grid-template-columns: 280px minmax(0, 1040px); gap: 40px; justify-content: center; align-items: start; }
.wrap { display: flex; flex-direction: column; gap: 28px; min-width: 0; }

/* sidebar agenda */
.toc { position: sticky; top: 0; max-height: 100vh; overflow: auto; padding: 0 8px 48px 0; margin-top: -32px; padding-top: 32px; scrollbar-width: thin; }
.toc-head { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: .82rem; padding: 0 0 18px; }
.toc-x, .toc-open { display: none; }
.toc ul { list-style: none; margin: 0; padding: 0; }
.toc-list { display: flex; flex-direction: column; gap: 32px; }
.toc a { text-decoration: none; display: block; }
.toc-i { color: var(--muted); font-size: .84rem; margin-bottom: 10px; line-height: 1.4; }
.toc-i:hover { color: var(--fg); }
.toc-issue > ul { display: flex; flex-direction: column; gap: 2px; }
.toc-case { color: var(--fg); font-size: 1rem; line-height: 1.4; padding: 6px 0; opacity: .82; transition: opacity .12s; }
.toc-case:hover, .toc a.cur { opacity: 1; }
.toc a.cur { font-weight: 600; }
.toc-case.fail { color: var(--fail); opacity: 1; }
.toc-tag { margin-left: 8px; font-size: .68rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; border: 1px solid var(--fail-line); border-radius: 999px; padding: 1px 7px; vertical-align: 2px; }
@media (max-width: 1100px) {
  .layout { grid-template-columns: minmax(0, 1040px); }
  .toc { position: fixed; z-index: 50; top: 0; left: 0; bottom: 0; margin: 0; width: min(340px, 88vw); max-height: none; padding: 20px 20px 40px 24px; background: var(--bg); transform: translateX(-105%); transition: transform .18s ease; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
  .toc.show { transform: none; }
  .toc-x { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; font-size: 1rem; }
  .toc-open { display: inline-block; position: fixed; z-index: 40; left: 12px; bottom: max(16px, env(safe-area-inset-bottom, 0px)); font: 600 .85rem var(--font-body); min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--fg); color: var(--bg); box-shadow: 0 6px 20px rgba(0,0,0,.25); cursor: pointer; }
}

/* header + summary */
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.top > div:first-child { min-width: 0; flex: 1 1 320px; }
.lang { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface); }
.lang button { font: 600 .85rem var(--font-body); padding: 8px 16px; min-width: 44px; min-height: 40px; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.lang button[aria-pressed="true"] { background: var(--accent); color: var(--surface); }
h1, h2, h3, h4 { font-family: var(--font-head); text-wrap: balance; margin: 0; line-height: 1.2; }
h1 { font-size: 2.2rem; font-weight: 700; }
h2 { font-size: 1.35rem; font-weight: 700; }
h3 { font-size: 1rem; font-weight: 500; }
.eyebrow { margin: 0 0 4px; font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.meta { color: var(--muted); font-size: .88rem; margin: 8px 0 0; }
.note { margin: 6px 0 0; font-size: .78rem; color: var(--muted); }
.pill { display: inline-block; font-size: .72rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; line-height: 1.5; }
.pill.pass { background: var(--pass-bg); color: var(--pass); }
.pill.fail { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail-line); }
.pill.big { font-size: .9rem; padding: 4px 14px; }
.alert { border: 2px solid var(--fail); background: var(--fail-bg); border-radius: 10px; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
.alert.ok { border-color: var(--pass); background: var(--pass-bg); }
.alert h2 { color: var(--fail); } .alert.ok h2 { color: var(--pass); }
.alert ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.alert a { color: var(--fail); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.stat h2 { font-size: 1rem; color: var(--muted); font-weight: 500; }
.nums { display: flex; gap: 24px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
.nums div { display: flex; flex-direction: column; }
.nums b { font-family: var(--font-head); font-size: 2rem; line-height: 1.1; }
.nums span { font-size: .8rem; color: var(--muted); }
.nums .p b { color: var(--pass); } .nums .f b { color: var(--fail); }
.nav { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.nav a { text-decoration: none; color: var(--fg); display: flex; gap: 10px; align-items: baseline; }
.nav a:hover { text-decoration: underline; }
.toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: -12px; }
.toolbar button { font: 600 .82rem var(--font-body); padding: 8px 14px; min-height: 40px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--fg); cursor: pointer; }

/* issue blocks */
.issue { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px; min-width: 0; scroll-margin-top: 16px; }
.issue.fail { border: 2px solid var(--fail); }
.issue-d > summary { list-style: none; cursor: pointer; }
.issue-d > summary::-webkit-details-marker { display: none; }
.issue-h { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.issue-h > div { min-width: 0; }
.issue-h .res { margin-left: auto; }
.links { margin: 6px 0 0; font-size: .9rem; display: flex; flex-wrap: wrap; gap: 2px 14px; }
.res { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.count { font-size: .82rem; color: var(--muted); }
.chev { flex: none; width: 32px; height: 32px; border: 1px solid var(--line); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
.chev::before { content: ""; width: 8px; height: 8px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg) translate(-2px,-2px); }
.issue-d:not([open]) .chev::before { transform: rotate(-45deg); }
.issue-body { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }

/* test case */
.case { border-top: 1px solid var(--line); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; scroll-margin-top: 16px; }
.case.fail { background: var(--fail-bg); border: 1px solid var(--fail-line); border-radius: 8px; padding: 14px; }
.case-h { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cid { font-family: var(--font-mono); font-size: .85em; color: var(--muted); margin-right: 4px; }
.spec { margin: 0; display: grid; gap: 8px; }
.spec > div { display: grid; grid-template-columns: 150px 1fr; gap: 12px; align-items: baseline; }
.spec dt { font-size: .78rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.spec dd { margin: 0; min-width: 0; }
.spec .actual { border-left: 4px solid var(--pass); padding: 6px 0 6px 10px; }
.spec .actual.fail { border-left-color: var(--fail); }
.spec .actual dd > ul { margin: 6px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
.ref { margin: 0 0 0 4px; color: var(--accent); font: 600 .85em var(--font-body); text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
.ref:hover { text-decoration-thickness: 2px; }
.checked summary { cursor: pointer; color: var(--muted); font-size: .88rem; }
.checked ul { margin: 8px 0 0; padding-left: 20px; font-size: .88rem; display: flex; flex-direction: column; gap: 4px; }
.checked li { overflow-wrap: anywhere; }
.ev h4 { margin: 4px 0 8px; font: 600 .78rem var(--font-body); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; align-items: start; }
figure { margin: 0; min-width: 0; scroll-margin-top: 24px; }
.shot { display: block; width: 100%; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); cursor: zoom-in; overflow: hidden; max-height: 260px; }
.shot img { display: block; width: 100%; height: auto; }
figure.hit .shot { outline: 3px solid var(--accent); outline-offset: 2px; }
figcaption { font-size: .78rem; margin-top: 4px; overflow-wrap: anywhere; }
.num { display: inline-block; min-width: 22px; text-align: center; padding: 0 6px; border-radius: 999px; background: var(--accent); color: var(--surface); font: 600 .75rem/1.6 var(--font-body); margin-right: 4px; }
.fn { display: block; font-family: var(--font-mono); font-size: .66rem; color: var(--muted); margin-top: 2px; }
.xcut ul { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; font-size: .9rem; }
.limits { font-size: .9rem; color: var(--muted); }
.limits ul { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.pr { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; }
.pr p { margin: 6px 0 0; }

/* screenshot viewer */
.lb { border: 0; padding: 0; margin: 0; width: 100vw; height: 100vh; max-width: none; max-height: none; background: #0b0d13; color: #e8eaf2; }
.lb::backdrop { background: rgba(8,10,16,.95); }
.lb[open] { display: grid; grid-template-rows: auto 1fr; }
.lb-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; flex-wrap: wrap; }
.lb-cap { flex: 1 1 200px; min-width: 0; font-size: .9rem; }
.lb-cap .fn, .lb-cap .cid { color: #a0a7ba; }
.lb-bar button { font: 600 .85rem var(--font-body); min-width: 40px; min-height: 40px; padding: 0 12px; border: 1px solid #3a4050; border-radius: 8px; background: #171a23; color: #e8eaf2; cursor: pointer; }
.lb-bar button:disabled { opacity: .35; cursor: default; }
.lb-stage { overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 8px 16px 24px; }
.lb-stage img { display: block; max-width: 100%; height: auto; cursor: zoom-in; background: #fff; border-radius: 4px; }
.lb-stage.fit img { max-height: calc(100vh - 90px); width: auto; }
.lb-stage.full img { width: 100%; max-width: 1600px; max-height: none; cursor: zoom-out; }

@media (max-width: 520px) {
  h1 { font-size: 1.7rem; } .res { align-items: flex-start; }
  .spec > div { grid-template-columns: 1fr; gap: 2px; }
}
`; }

function JS() { return `(function () {
  var root = document.documentElement;
  var langs = (root.getAttribute('data-langs') || 'en').split(',');

  // Language toggle (only when the report has more than one language).
  function setLang(l) {
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    var bs = document.querySelectorAll('[data-set-lang]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].getAttribute('data-set-lang') === l));
  }
  var l = langs[0];
  try {
    var saved = localStorage.getItem('report-lang');
    var nav = (navigator.language || '').slice(0, 2);
    l = langs.indexOf(saved) > -1 ? saved : (langs.indexOf(nav) > -1 ? nav : langs[0]);
  } catch (e) {}
  setLang(l);

  // Open the collapsed issue block that contains a target id.
  function openFor(id) {
    var el = id && document.getElementById(id); if (!el) return;
    var sec = el.closest('.issue'), d = sec && sec.querySelector('.issue-d');
    if (d) d.open = true;
  }
  openFor(location.hash.slice(1));
  window.addEventListener('hashchange', function () { openFor(location.hash.slice(1)); });

  // Screenshot viewer (modal).
  var lb = document.getElementById('lb'), stage = document.getElementById('lb-stage'),
      lbImg = document.getElementById('lb-img'), lbCap = document.getElementById('lb-cap');
  var group = [], idx = 0;
  function show() {
    var f = group[idx], im = f.querySelector('img'), cap = f.querySelector('figcaption');
    lbImg.src = im.src; lbImg.alt = im.alt;
    var art = f.closest('article'), title = art ? art.querySelector('h3') : null;
    lbCap.innerHTML = (title ? title.innerHTML + ' &middot; ' : '') + cap.innerHTML;
    stage.className = 'lb-stage fit'; stage.scrollTop = 0;
    lb.querySelector('[data-lb=prev]').disabled = idx === 0;
    lb.querySelector('[data-lb=next]').disabled = idx === group.length - 1;
  }
  function openLb(f) {
    var shots = f.closest('.shots');
    group = shots ? [].slice.call(shots.querySelectorAll('figure')) : [f];
    idx = Math.max(0, group.indexOf(f)); show();
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  }
  function step(d) { var n = idx + d; if (n >= 0 && n < group.length) { idx = n; show(); } }
  function toggleZoom() { stage.className = stage.className.indexOf('full') > -1 ? 'lb-stage fit' : 'lb-stage full'; }
  document.addEventListener('keydown', function (e) {
    if (!lb.open) return;
    if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
  });

  // Sidebar: highlight the case in view; drawer on narrow screens.
  var toc = document.getElementById('toc');
  var tocLinks = [].slice.call(toc.querySelectorAll('.toc-case'));
  var byId = {}; tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = byId[en.target.id]; if (!a) return;
        tocLinks.forEach(function (x) { x.classList.remove('cur'); }); a.classList.add('cur');
        var r = a.getBoundingClientRect(), tr = toc.getBoundingClientRect();
        if (r.top < tr.top || r.bottom > tr.bottom) a.scrollIntoView({ block: 'nearest' });
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    [].forEach.call(document.querySelectorAll('article.case'), function (el) { io.observe(el); });
  }

  document.addEventListener('click', function (e) {
    var c = function (sel) { return e.target.closest && e.target.closest(sel); };
    var t;
    if ((t = c('[data-toc]'))) { toc.classList.toggle('show', t.getAttribute('data-toc') === 'open'); return; }
    if (c('.toc a')) toc.classList.remove('show');
    if ((t = c('[data-set-lang]'))) {
      var v = t.getAttribute('data-set-lang'); setLang(v);
      try { localStorage.setItem('report-lang', v); } catch (e2) {}
      return;
    }
    if ((t = c('[data-all]'))) {
      var ds = document.querySelectorAll('.issue-d');
      for (var k = 0; k < ds.length; k++) ds[k].open = t.getAttribute('data-all') === 'open';
      return;
    }
    if ((t = c('a[href^="#"]'))) {
      var id = t.getAttribute('href').slice(1); openFor(id);
      var f = document.getElementById(id);
      if (f && f.tagName === 'FIGURE') {
        e.preventDefault();
        [].forEach.call(document.querySelectorAll('figure.hit'), function (x) { x.classList.remove('hit'); });
        f.classList.add('hit');
        f.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
    }
    if ((t = c('.shot'))) { openLb(t.closest('figure')); return; }
    if ((t = c('[data-lb]'))) {
      var act = t.getAttribute('data-lb');
      if (act === 'close') lb.close(); else if (act === 'zoom') toggleZoom(); else step(act === 'next' ? 1 : -1);
      return;
    }
    if (e.target === lb || e.target === stage) lb.close();
    if (e.target === lbImg) toggleZoom();
  });
})();
`; }
