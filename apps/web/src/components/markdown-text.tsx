"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Long free text as a Markdown preview, with the raw text one click away.
 * Raw HTML in the text is not rendered (react-markdown escapes it) and links
 * open in a new tab; only http(s), mailto and relative links are kept.
 */
export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const [raw, setRaw] = useState(false);
  return (
    <div className={`md-box ${className ?? ""}`}>
      <div className="md-bar" role="group" aria-label="Text view">
        <button type="button" className={raw ? "" : "on"} aria-pressed={!raw} onClick={() => setRaw(false)}>
          Preview
        </button>
        <button type="button" className={raw ? "on" : ""} aria-pressed={raw} onClick={() => setRaw(true)}>
          Raw
        </button>
      </div>
      {raw ? <pre className="outv mono">{text}</pre> : <MarkdownBody text={text} />}
    </div>
  );
}

/** The rendered Markdown alone, with no toggle; also what tests render. */
export function MarkdownBody({ text }: { text: string }) {
  return (
    <div className="md outv">
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
