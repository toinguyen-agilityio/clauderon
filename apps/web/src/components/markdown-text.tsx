"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { closeOnBackdrop } from "./dialog";

/** Text longer than this (lines or characters) is shown collapsed, with an Expand button. */
export const LONG_TEXT_LINES = 12;
export const LONG_TEXT_CHARS = 600;

export function isLongText(text: string): boolean {
  return text.length > LONG_TEXT_CHARS || text.split("\n").length > LONG_TEXT_LINES;
}

/**
 * Node text rendered as Markdown. Long text is collapsed to a short box with an
 * Expand button that opens the whole text in a dialog; short text has no button.
 * Raw HTML in the text is not rendered (react-markdown escapes it) and links
 * open in a new tab; only http(s), mailto and relative links are kept.
 */
export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongText(text);
  return (
    <div className={`md-box ${className ?? ""}`}>
      <MarkdownBody text={text} collapsed={long} />
      {long && (
        <div className="md-bar">
          <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            Expand
          </button>
        </div>
      )}
      {open && <ExpandedText text={text} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The full text in a modal dialog; Esc, the backdrop, × or Close return to the collapsed view. */
function ExpandedText({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal wide" aria-label="Full text" onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <h2>Full text</h2>
          <button type="button" className="btn ghost sm" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
        <div className="modal-b">
          <MarkdownBody text={text} />
        </div>
      </div>
    </dialog>
  );
}

/** The rendered Markdown alone; `collapsed` caps its height. Also what tests render. */
export function MarkdownBody({ text, collapsed = false }: { text: string; collapsed?: boolean }) {
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
