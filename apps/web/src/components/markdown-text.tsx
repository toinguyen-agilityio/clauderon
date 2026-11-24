"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { closeOnBackdrop } from "./dialog";
import { Icon } from "./icons";

/** Text longer than this (lines or characters) is shown collapsed, with an Expand button. */
export const LONG_TEXT_LINES = 12;
export const LONG_TEXT_CHARS = 600;

/**
 * Text that arrived JSON-escaped (literal "\\n" and no real line break, as when an agent
 * returns a string inside JSON twice) gets its line breaks and tabs back, so it reads as Markdown.
 */
export function readableText(text: string): string {
  if (text.includes("\n") || !text.includes("\\n")) return text;
  return text.replaceAll("\\r\\n", "\n").replaceAll("\\n", "\n").replaceAll("\\t", "\t").replaceAll('\\"', '"');
}

const SEVERITY = /\[(critical|blocker|major|minor|nit)\]/gi;
// A short lead-in label ("File:", "Suggested fix:") at the start of a list item or paragraph.
const LABEL = /^(\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:`sev:\w+`\s*)?)([A-Z][A-Za-z]*(?: [A-Za-z]+){0,2}):(?=\s)/;
// Spans the formatter leaves alone: inline code, links, bare URLs.
const KEEP = /(`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\)|https?:\/\/[^\s)]+)/;
const CODE_LIKE = new RegExp(
  [
    // A path with a folder, or a file with a code extension, with an optional :line or :line-line.
    String.raw`(?:[\w@.-]+\/)+[\w.-]+\.[A-Za-z]{1,5}(?::\d+(?:-\d+)?)?`,
    String.raw`\b[\w-]+\.(?:tsx?|jsx?|mjs|json|sql|css|ya?ml|sh|md)(?::\d+(?:-\d+)?)?\b`,
    // A call: name() or obj.name(args), with no space before the parenthesis.
    String.raw`\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\((?!s\))[\w$, .]{0,40}\)`,
    // snake_case names such as run.flow_id.
    String.raw`\b[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)*_[a-z0-9_]+\b`,
  ].join("|"),
  "g",
);

/**
 * Agent text written as plain prose, made easier to scan: severity tags become badges, a
 * short label opening a list item or paragraph is bold, bullets right under a numbered
 * item nest in it, and file paths, calls and snake_case names are set as code. Code blocks, inline code and links are left as they are.
 */
export function formatForReading(text: string): string {
  let fenced = false;
  let underNumbered = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced || /^( {4}|\t)/.test(line)) return line;
      // Bullets written flush left right after a numbered item belong to it: indent them so they nest.
      if (/^\d+[.)]\s/.test(line)) underNumbered = true;
      else if (underNumbered && /^[-*+]\s/.test(line)) line = `   ${line}`;
      else if (line.trim() !== "") underNumbered = false;
      const parts = line.split(KEEP).map((part, i) => (i % 2 === 1 ? part : part.replace(SEVERITY, (_, level: string) => `\`sev:${level.toLowerCase()}\``).replace(CODE_LIKE, (m) => `\`${m}\``)));
      return parts.join("").replace(LABEL, "$1**$2:**");
    })
    .join("\n");
}

export function isLongText(text: string): boolean {
  return text.length > LONG_TEXT_CHARS || text.split("\n").length > LONG_TEXT_LINES;
}

const plural = (n: number, word: string) => `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;

/** How long the text is, so the Expand button says what it opens. */
function textSize(text: string): string {
  const lines = text.trimEnd().split("\n").length;
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${plural(lines, "line")} · ${plural(words, "word")}`;
}

/**
 * Node text rendered as Markdown. Long text is collapsed to a short box that fades out,
 * with an Expand button over the fade that opens the whole text in a dialog; short text
 * has no button. `title` names the dialog (an Output's name), "Full text" otherwise.
 * Raw HTML in the text is not rendered (react-markdown escapes it) and links
 * open in a new tab; only http(s), mailto and relative links are kept.
 */
export function MarkdownText({ text: raw, className, title }: { text: string; className?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const text = readableText(raw);
  const long = isLongText(text);
  return (
    <div className={`md-box ${long ? "long" : ""} ${className ?? ""}`}>
      <MarkdownBody text={text} collapsed={long} />
      {long && (
        <div className="md-more">
          <button type="button" className="md-expand" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            {EXPAND_ICON}
            Expand
            <span className="md-size">{textSize(text)}</span>
          </button>
        </div>
      )}
      {open && <ExpandedText text={text} title={title ?? "Full text"} onClose={() => setOpen(false)} />}
    </div>
  );
}

const EXPAND_ICON = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
  </svg>
);

/** The full text in a modal dialog: Copy, and Esc, the backdrop or × return to the collapsed view. */
function ExpandedText({ text, title, onClose }: { text: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  const copy = () =>
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal wide md-dialog" aria-label={title} onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <div className="md-dialog-t">
            <h2>{title}</h2>
            <span className="faint small">{textSize(text)}</span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <button type="button" className="btn sm" onClick={copy} aria-live="polite">
              {copied ? Icon.check : Icon.copy}
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="btn ghost sm icon" aria-label="Close" title="Close (Esc)" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
        </div>
        <div className="modal-b">
          <MarkdownBody text={text} />
        </div>
      </div>
    </dialog>
  );
}

/** The rendered Markdown alone; `collapsed` caps its height. Also what tests render. */
export function MarkdownBody({ text: raw, collapsed = false }: { text: string; collapsed?: boolean }) {
  const text = formatForReading(readableText(raw));
  return (
    <div className={collapsed ? "md outv collapsed" : "md outv full"}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Agent text is untrusted: an auto-loaded remote image could leak data in its URL. Show a link instead.
          img: ({ src, alt }) =>
            typeof src === "string" ? (
              <a href={src} target="_blank" rel="noreferrer noopener">
                {alt || src}
              </a>
            ) : null,
          // A severity tag from `formatForReading`, shown as a badge.
          code: ({ className, children }) => {
            const level = !className && typeof children === "string" ? /^sev:(\w+)$/.exec(children)?.[1] : undefined;
            return level ? <span className={`md-sev ${level}`}>{level}</span> : <code className={className}>{children}</code>;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
