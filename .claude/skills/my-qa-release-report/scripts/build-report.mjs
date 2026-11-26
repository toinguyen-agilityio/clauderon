#!/usr/bin/env node
// Build a single-file QA release report (HTML) from a report.json spec and its screenshots.
// Usage: node build-report.mjs <report.json> [--out report.html] [--skip-missing]
// --skip-missing: draw a grey placeholder for screenshots that are not on disk (to preview examples/release-1).
// No dependencies (Node 18+). Screenshots are embedded as data: URIs, so the output can be published as-is.
// The CSS and JS of the page are in ../assets/report.css and ../assets/report.js. Change the design there, so every report keeps it.
// The JSON format is documented in the my-qa-release-report SKILL.md.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const css = readFileSync(join(assets, 'report.css'), 'utf8'), js = readFileSync(join(assets, 'report.js'), 'utf8');
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