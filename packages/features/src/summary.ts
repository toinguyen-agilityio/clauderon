import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Feature, featuresFileSchema } from "./schema";

export const SUMMARY_PATH = "docs/features-summary.html";
export const SUMMARY_VI_PATH = "docs/features-summary.vi.json";
export const REPO_BLOB = "https://github.com/toinguyen-agilityio/clauderon/blob/main/";

/** Groups by what a Member does, in page order. A feature id lives in exactly one group; removed ones are in none. */
export const GROUPS = [
  {
    key: "tickets",
    title: "Tickets",
    intro: "Pick GitHub issues as the work to do.",
    ids: ["TIC-1", "TIC-2", "TIC-3", "TIC-5", "TIC-6", "TIC-7", "TIC-8", "TIC-9"],
  },
  {
    key: "flows",
    title: "Flows and Nodes",
    intro: "Build the process from typed Nodes.",
    ids: [
      "FLW-1", "FLW-3", "FLW-4", "FLW-5", "FLW-6", "FLW-7", "FLW-8", "FLW-9", "FLW-10",
      "flow-drafts", "flow-node-files",
    ],
  },
  {
    key: "runs",
    title: "Runs",
    intro: "Run a Flow for a Ticket, one Node at a time.",
    ids: ["RUN-1", "RUN-2", "RUN-3", "RUN-8", "RUN-9", "RUN-10", "RUN-11", "RUN-12", "RUN-14", "RUN-16"],
  },
  {
    key: "people",
    title: "People in the loop (Approve, Grill)",
    intro: "A Run pauses for a person to decide or answer.",
    ids: ["FLW-2", "RUN-4", "RUN-5", "RUN-6", "RUN-7", "MEM-2"],
  },
  {
    key: "tracking",
    title: "Tracking results",
    intro: "See what a Run did and which pull requests it opened.",
    ids: ["TRK-1", "TRK-2", "TRK-4", "TRK-7", "pull-requests-tab"],
  },
  {
    key: "machines",
    title: "Machines and the Agent",
    intro: "Each Member runs Runs on their own computer.",
    ids: [
      "POD-1", "machine-pairing", "agent-self-update", "POD-3", "POD-4", "POD-5", "POD-10",
      "POD-11", "POD-12", "POD-13", "NFR-3", "NFR-6",
    ],
  },
  {
    key: "team",
    title: "Sign-in and team",
    intro: "Who gets in, which Projects are enabled, and what is recorded.",
    ids: ["MEM-1", "MEM-3", "MEM-4", "PRJ-1", "PRJ-2", "PRJ-3", "RUN-15", "NFR-2"],
  },
  {
    key: "deploy",
    title: "Deploy and operations",
    intro: "Self-hosted, durable and safe with secrets.",
    ids: ["deploy", "NFR-1", "NFR-4", "NFR-5"],
  },
] as const;

export const BADGES: Record<Exclude<Feature["status"], "removed">, { en: string; vi: string }> = {
  done: { en: "Done", vi: "Xong" },
  partial: { en: "Partial", vi: "Một phần" },
  "not-started": { en: "Not yet built", vi: "Chưa làm" },
};

export interface ViFeature {
  name: string;
  summary: string;
  reason?: string;
}
export interface ViFile {
  groups: Record<string, { title: string; intro: string }>;
  features: Record<string, ViFeature>;
}

const LINKS = [
  ["docs/requirements/v1-requirements.md", "Requirements", "Yêu cầu"],
  ["docs/specs/README.md", "Milestone specs (M0–M4)", "Spec theo milestone (M0–M4)"],
  ["docs/adr", "Decision records (ADRs)", "Quyết định kiến trúc (ADR)"],
  ["docs/overview.md", "Overview", "Tổng quan"],
  ["CONTEXT.md", "Glossary (CONTEXT.md)", "Từ điển thuật ngữ (CONTEXT.md)"],
  ["docs/features.json", "features.json (the source of this page)", "features.json (nguồn của trang này)"],
] as const;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** English text with its Vietnamese twin: the toggle script swaps `data-vi` in. */
function t(en: string, vi: string, tag = "span", cls = ""): string {
  return `<${tag}${cls ? ` class="${cls}"` : ""} data-vi="${esc(vi)}">${esc(en)}</${tag}>`;
}

export function loadFeatures(root: string): Feature[] {
  return featuresFileSchema.parse(JSON.parse(readFileSync(join(root, "docs/features.json"), "utf8"))).features;
}

export function loadVi(root: string): ViFile {
  return JSON.parse(readFileSync(join(root, SUMMARY_VI_PATH), "utf8")) as ViFile;
}

/** Fails when a feature has no group or no Vietnamese line, so neither can go missing. */
export function checkCoverage(features: Feature[], vi: ViFile): void {
  const problems: string[] = [];
  const grouped = new Map<string, string>();
  for (const g of GROUPS) {
    if (!vi.groups[g.key]) problems.push(`no Vietnamese text for group ${g.key}`);
    for (const id of g.ids) {
      if (grouped.has(id)) problems.push(`${id} is in two groups`);
      grouped.set(id, g.key);
    }
  }
  const byId = new Map(features.map((f) => [f.id, f]));
  for (const id of grouped.keys()) {
    const f = byId.get(id);
    if (!f) problems.push(`group lists ${id}, which is not in features.json`);
    else if (f.status === "removed") problems.push(`${id} is removed but listed in a group`);
  }
  for (const f of features) {
    if (f.status !== "removed" && !grouped.has(f.id)) problems.push(`${f.id} is not in any group`);
    const v = vi.features[f.id];
    if (!v?.name || !v.summary) problems.push(`no Vietnamese text for ${f.id}`);
    else if (f.status === "removed" && !v.reason) problems.push(`no Vietnamese reason for ${f.id}`);
  }
  if (problems.length) throw new Error(`features summary: ${problems.join("; ")}`);
}

function featureRow(f: Feature, vi: ViFeature): string {
  const b = f.status === "removed" ? undefined : BADGES[f.status];
  return (
    `<li class="feat"><span class="badge ${f.status}" data-vi="${esc(b?.vi ?? "")}">${esc(b?.en ?? "")}</span>` +
    `<span class="txt"><strong data-vi="${esc(vi.name)}">${esc(f.name)}</strong> ` +
    `<span data-vi="${esc(vi.summary)}">${esc(f.summary)}</span></span></li>`
  );
}

const DIAGRAM = `<svg class="diagram" viewBox="0 0 760 150" role="img" aria-labelledby="dg-t">
<title id="dg-t">A Ticket goes into a Flow of Nodes, which becomes a Run on the Member's Machine</title>
<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
<rect x="8" y="35" width="150" height="80" rx="10" class="bx"/>
<text x="83" y="70" text-anchor="middle" class="h">Ticket</text><text x="83" y="92" text-anchor="middle" class="s">a GitHub issue</text>
<path d="M160 75H222" class="ln" marker-end="url(#ar)"/>
<rect x="224" y="10" width="300" height="130" rx="10" class="bx"/>
<text x="374" y="32" text-anchor="middle" class="h">Flow</text>
<rect x="240" y="52" width="76" height="40" rx="6" class="nd"/><text x="278" y="77" text-anchor="middle" class="s">Agent</text>
<rect x="332" y="52" width="76" height="40" rx="6" class="nd hu"/><text x="370" y="77" text-anchor="middle" class="s">Approve</text>
<rect x="424" y="52" width="86" height="40" rx="6" class="nd"/><text x="467" y="77" text-anchor="middle" class="s">Open a PR</text>
<path d="M317 72H330M409 72H422" class="ln" marker-end="url(#ar)"/>
<text x="374" y="124" text-anchor="middle" class="s">typed Nodes, run one at a time</text>
<path d="M526 75H588" class="ln" marker-end="url(#ar)"/>
<rect x="590" y="35" width="160" height="80" rx="10" class="bx run"/>
<text x="670" y="66" text-anchor="middle" class="h">Run</text><text x="670" y="86" text-anchor="middle" class="s">on the Member's</text><text x="670" y="102" text-anchor="middle" class="s">own Machine</text>
</svg>`;

const CSS = `
:root{--bg:#f4f6f9;--surface:#fff;--line:#dce1e9;--fg:#1a2130;--muted:#5b6578;--accent:#2f5bd3;--ok:#1f7a4d;--ok-soft:#e3f3ea;--warn:#9a6a00;--warn-soft:#fbf1d6;--off:#5b6578;--off-soft:#eceff4;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#11151c;--surface:#1a1f28;--line:#2b3341;--fg:#e5e9f0;--muted:#98a2b4;--accent:#8ea6ff;--ok:#5fcf96;--ok-soft:#173327;--warn:#e6b84a;--warn-soft:#362b10;--off:#98a2b4;--off-soft:#232a35;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#11151c;--surface:#1a1f28;--line:#2b3341;--fg:#e5e9f0;--muted:#98a2b4;--accent:#8ea6ff;--ok:#5fcf96;--ok-soft:#173327;--warn:#e6b84a;--warn-soft:#362b10;--off:#98a2b4;--off-soft:#232a35;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 var(--sans);padding:32px max(16px,env(safe-area-inset-right)) 48px max(16px,env(safe-area-inset-left))}
.wrap{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
h1,h2{margin:0;text-wrap:balance}h1{font-size:30px;letter-spacing:-.01em}h2{font-size:17px}
.eyebrow{font:12px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.lede{color:var(--muted);max-width:72ch;margin:6px 0 0}
.head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px}.head>div:first-child{flex:1 1 420px;min-width:0}
.lang{display:inline-flex;align-self:flex-start;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:3px;gap:2px}
.lang button{font:600 12px var(--mono);padding:6px 12px;border:0;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.lang button[aria-pressed=true]{background:var(--fg);color:var(--bg)}
.lang button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.sub{color:var(--muted);font-size:13px;margin:0}
.diagram{width:100%;height:auto;max-width:760px;align-self:center}
.diagram .bx{fill:var(--surface);stroke:var(--line);stroke-width:1.5}.diagram .run{stroke:var(--accent)}
.diagram .nd{fill:var(--bg);stroke:var(--line)}.diagram .hu{stroke:var(--warn)}
.diagram .ln{stroke:var(--muted);stroke-width:1.5;fill:none}
.diagram .h{font:600 16px var(--sans);fill:var(--fg)}.diagram .s{font:12px var(--sans);fill:var(--muted)}
.feats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.feat{display:flex;gap:10px;align-items:baseline}
.txt{min-width:0;overflow-wrap:anywhere}
.badge{flex:none;min-width:92px;text-align:center;font:600 11px var(--mono);padding:2px 7px;border-radius:4px;border:1px solid color-mix(in srgb,currentColor 35%,transparent)}
.badge.done{background:var(--ok-soft);color:var(--ok)}.badge.partial{background:var(--warn-soft);color:var(--warn)}.badge.not-started{background:var(--off-soft);color:var(--off)}
.count{font:12px var(--mono);color:var(--muted);font-weight:400}
.legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
details summary{cursor:pointer;font-weight:600}
.gone{margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:8px;color:var(--muted)}
.links{display:flex;flex-wrap:wrap;gap:8px 18px;margin:0;padding:0;list-style:none}
a{color:var(--accent)}
@media(max-width:560px){.feat{flex-direction:column;gap:3px}h1{font-size:24px}}
`;

const SCRIPT = `(function(){var n=[].slice.call(document.querySelectorAll('[data-vi]'));n.forEach(function(e){e.setAttribute('data-en',e.innerHTML)});var b=[].slice.call(document.querySelectorAll('.lang button'));function s(l){n.forEach(function(e){e.innerHTML=e.getAttribute(l==='vi'?'data-vi':'data-en')});b.forEach(function(x){x.setAttribute('aria-pressed',x.getAttribute('data-lang')===l?'true':'false')});document.documentElement.setAttribute('lang',l);try{localStorage.setItem('features-lang',l)}catch(e){}}b.forEach(function(x){x.addEventListener('click',function(){s(x.getAttribute('data-lang'))})});var v=null;try{v=localStorage.getItem('features-lang')}catch(e){}if(v==='vi')s('vi')})();`;

export function renderSummary(features: Feature[], vi: ViFile): string {
  checkCoverage(features, vi);
  const byId = new Map(features.map((f) => [f.id, f]));
  const sections = GROUPS.map((g) => {
    const rows = g.ids.map((id) => featureRow(byId.get(id)!, vi.features[id]!)).join("\n");
    const gv = vi.groups[g.key]!;
    return (
      `<section class="panel" id="${g.key}"><h2>${t(g.title, gv.title)} <span class="count">${g.ids.length}</span></h2>\n` +
      `<p class="sub">${t(g.intro, gv.intro)}</p>\n<ul class="feats">\n${rows}\n</ul></section>`
    );
  }).join("\n");

  const removed = features.filter((f) => f.status === "removed");
  const gone = removed
    .map((f) => {
      const v = vi.features[f.id]!;
      return (
        `<li><strong data-vi="${esc(v.name)}">${esc(f.name)}</strong> (${esc(f.id)}): ` +
        `<span data-vi="${esc(v.reason!)}">${esc(f.reason!)}</span></li>`
      );
    })
    .join("\n");

  const counts = { done: 0, partial: 0, "not-started": 0 };
  for (const f of features) if (f.status !== "removed") counts[f.status]++;
  const legend = (Object.keys(BADGES) as (keyof typeof BADGES)[])
    .map((k) => `<span class="badge ${k}" data-vi="${esc(BADGES[k].vi)}">${esc(BADGES[k].en)}</span> ${counts[k]}`)
    .join(" ");

  const links = LINKS.map(([p, en, vn]) => `<li><a href="${REPO_BLOB}${p}">${t(en, vn)}</a></li>`).join("\n");

  return `<meta name="claude:viewport-fit-sides" content="cover">
<title>Clauderon Features</title>
<style>${CSS}</style>
<main class="wrap">
<header class="head">
<div>
${t("Clauderon · feature summary", "Clauderon · tóm tắt tính năng", "div", "eyebrow")}
<h1>${t("What Clauderon does today", "Clauderon làm được gì hôm nay")}</h1>
<p class="lede">${t(
    "One line per feature, grouped by what a Member does. Generated from the repo's features file, so the page and the code agree.",
    "Mỗi tính năng một dòng, nhóm theo việc một Member làm. Sinh từ file features của repo, nên trang và code luôn khớp nhau.",
  )}</p>
</div>
<div class="lang" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="true">EN</button><button type="button" data-lang="vi" aria-pressed="false">VI</button></div>
</header>
<section class="panel">
<h2>${t("The core idea", "Ý tưởng chính")}</h2>
<p class="sub">${t(
    "A Member picks Tickets, runs them through a Flow of Nodes, and each Run executes on that Member's own Machine under their own logins.",
    "Member chọn Ticket, chạy qua một Flow gồm các Node, và mỗi Run thực thi trên Machine của chính Member đó dưới login riêng.",
  )}</p>
${DIAGRAM}
<div class="legend">${legend}</div>
<p class="sub">${t(
    "Status comes from the evidence in features.json. The roadmap status (#131) has not landed yet, so nothing is marked partial or not yet built today.",
    "Trạng thái lấy từ bằng chứng trong features.json. Trạng thái roadmap (#131) chưa có, nên hiện chưa mục nào là một phần hay chưa làm.",
  )}</p>
</section>
${sections}
<section class="panel">
<details><summary>${t("Removed from v1 (not current)", "Đã bỏ khỏi v1 (không còn hiện hành)")} <span class="count">${removed.length}</span></summary>
<ul class="gone">
${gone}
</ul></details>
</section>
<section class="panel">
<h2>${t("Read more", "Đọc thêm")}</h2>
<ul class="links">
${links}
</ul>
</section>
</main>
<script>${SCRIPT}</script>
`;
}

export function buildSummary(root: string): string {
  return renderSummary(loadFeatures(root), loadVi(root));
}
