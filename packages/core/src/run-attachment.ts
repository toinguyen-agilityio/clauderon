// Files and links a Member adds to a plan or summary Input when starting a Run (ADR 0011).
// Pure: the web app checks and composes with these, the Gateway and the Agent agree on the paths.

/** Where the Agent writes a Run's attachments, relative to its worktree; git ignores `.clauderon/`. */
export const ATTACHMENTS_DIR = ".clauderon/inputs";

export const ATTACHMENT_LIMITS = { fileBytes: 10 * 1024 * 1024, runBytes: 25 * 1024 * 1024, files: 10 } as const;
export const LINK_LIMITS = { links: 20, length: 2_000 } as const;

/** The first Agent version that downloads attachments. */
export const ATTACHMENTS_MIN_AGENT = "0.6.0";

/** Whether an Agent reporting `version` (e.g. `0.6.0+abc`, `0.6.0-dev`) is at least `min`. */
export function agentAtLeast(version: string | null | undefined, min: string): boolean {
  const have = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? "");
  const want = /^(\d+)\.(\d+)\.(\d+)/.exec(min)!;
  if (!have) return false;
  for (let i = 1; i <= 3; i++) {
    const a = Number(have[i]);
    const b = Number(want[i]);
    if (a !== b) return a > b;
  }
  return true;
}

export const agentSupportsAttachments = (version: string | null | undefined) => agentAtLeast(version, ATTACHMENTS_MIN_AGENT);

const NAME_MAX = 120;

/**
 * A file name safe to write in the worktree: no folders, no control or shell-special characters,
 * no leading dot or dash. Keeps letters of any script, digits, spaces and `._-()`.
 */
export function attachmentName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let name = base
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\-\s]+/, "");
  if (name.length > NAME_MAX) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 && name.length - dot <= 16 ? name.slice(dot) : "";
    name = name.slice(0, NAME_MAX - ext.length) + ext;
  }
  return name || "file";
}

/** Clean names, made unique in order: `a.pdf`, `a (2).pdf`, … */
export function attachmentNames(raw: readonly string[]): string[] {
  const used = new Set<string>();
  return raw.map((r) => {
    const name = attachmentName(r);
    const dot = name.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Checks the files against the limits; sizes in bytes. */
export function checkAttachments(files: readonly { name: string; size: number }[]): { ok: true } | { ok: false; error: string } {
  if (files.length > ATTACHMENT_LIMITS.files) return { ok: false, error: `Attach at most ${ATTACHMENT_LIMITS.files} files.` };
  const big = files.find((f) => f.size > ATTACHMENT_LIMITS.fileBytes);
  if (big) return { ok: false, error: `${big.name} is larger than ${mb(ATTACHMENT_LIMITS.fileBytes)}.` };
  if (files.some((f) => f.size === 0)) return { ok: false, error: "An attached file is empty." };
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > ATTACHMENT_LIMITS.runBytes) return { ok: false, error: `Attached files are at most ${mb(ATTACHMENT_LIMITS.runBytes)} together.` };
  return { ok: true };
}

/** Cleans the links a Member listed: http(s) URLs only, without duplicates. */
export function checkLinks(raw: readonly string[]): { ok: true; links: string[] } | { ok: false; error: string } {
  const links: string[] = [];
  for (const entry of raw.map((l) => l.trim()).filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return { ok: false, error: `${entry.slice(0, 80)} is not a link.` };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Links start with https:// or http://." };
    if (entry.length > LINK_LIMITS.length) return { ok: false, error: `A link is at most ${LINK_LIMITS.length} characters.` };
    if (!links.includes(entry)) links.push(entry);
  }
  if (links.length > LINK_LIMITS.links) return { ok: false, error: `Add at most ${LINK_LIMITS.links} links.` };
  return { ok: true, links };
}

/**
 * The text a plan or summary Input carries: what the Member wrote, then the links under
 * "Sources:" and the attached files' paths under "Attachments:", so every Node that takes
 * the Input sees them.
 */
export function composeInputText(text: string, links: readonly string[], attachments: readonly string[]): string {
  const parts = [text.trim()];
  if (links.length > 0) parts.push(["Sources (open these links for the details):", ...links.map((l) => `- ${l}`)].join("\n"));
  if (attachments.length > 0) {
    parts.push([`Attachments (files in the worktree; read them):`, ...attachments.map((n) => `- ${ATTACHMENTS_DIR}/${n}`)].join("\n"));
  }
  return parts.filter(Boolean).join("\n\n");
}
