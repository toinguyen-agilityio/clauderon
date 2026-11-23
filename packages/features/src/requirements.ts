// Reads the v1 requirements table and the milestone coverage table of the specs README.

export type Requirement = {
  id: string;
  name: string;
  summary: string;
  priority: string;
};

const ROW = /^\|\s*([A-Z]{3}-\d+)\s*\|(.*)\|\s*(Must|Should|Could|Dropped)\s*\|\s*$/;

/** Strip Markdown links, emphasis and code ticks, and collapse spaces. */
export function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text: string, max: number): string {
  const clean = plain(text);
  const m = /^(.*?[.!?])(\s|$)/.exec(clean);
  const sentence = m?.[1] ?? clean;
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

function nameOf(text: string): string {
  const bold = /^\*\*([^*]+)\*\*/.exec(text.trim());
  if (bold?.[1]) return plain(bold[1]).replace(/[:.]$/, "");
  const words = plain(text).split(" ").slice(0, 6).join(" ");
  return words.replace(/[,:;.]$/, "");
}

/** Requirement rows of section 4 (functional and non-functional). */
export function parseRequirements(markdown: string): Requirement[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("## 4."));
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## 5."));
  const out: Requirement[] = [];
  for (const line of lines.slice(start < 0 ? 0 : start, end < 0 ? lines.length : end)) {
    const m = ROW.exec(line);
    if (!m?.[1] || m[2] === undefined || !m[3]) continue;
    const id = m[1];
    let body = m[2].trim();
    let name: string;
    if (id.startsWith("NFR-")) {
      // | NFR-1 | Security | text | Must |
      const cut = body.indexOf("|");
      name = plain(body.slice(0, cut));
      body = body.slice(cut + 1).trim();
    } else {
      name = nameOf(body);
    }
    out.push({ id, name, summary: firstSentence(body, 140), priority: m[3] });
  }
  return out;
}

function idsIn(cell: string): string[] {
  const ids: string[] = [];
  const range = /([A-Z]{3})-(\d+)\s*(?:…|\.\.\.)\s*\1-(\d+)/g;
  for (const m of cell.matchAll(range)) {
    for (let n = Number(m[2]); n <= Number(m[3]); n++) ids.push(`${m[1]}-${n}`);
  }
  for (const m of cell.matchAll(/[A-Z]{3}-\d+/g)) ids.push(m[0]);
  return ids;
}

/** Requirement id to the first milestone (M0 to M4) that builds it, from the coverage table. */
export function parseMilestones(readme: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = readme.split(/\r?\n/);
  const from = lines.findIndex((l) => l.startsWith("## Requirement coverage"));
  if (from < 0) return map;
  for (const line of lines.slice(from + 1)) {
    if (line.startsWith("---")) break;
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    // cells[0] is the area; cells[1..5] are M0..M4
    cells.slice(1, 6).forEach((cell, i) => {
      for (const id of idsIn(cell)) if (!map.has(id)) map.set(id, `M${i}`);
    });
  }
  return map;
}
