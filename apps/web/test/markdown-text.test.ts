import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isLongText, LONG_TEXT_CHARS, MarkdownBody, MarkdownText, readableText } from "../src/components/markdown-text";

const render = (text: string) => renderToStaticMarkup(createElement(MarkdownBody, { text }));

describe("Markdown text (issue #85)", () => {
  it("renders headings, lists and code instead of raw text", () => {
    const html = render("## Plan\n\n1. Add deps\n2. Add `getPost`\n\n- one\n- two\n\n```ts\nconst a = 1;\n```");
    expect(html).toContain("<h2>Plan</h2>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<code>getPost</code>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<pre><code");
  });

  it("does not run raw HTML or scripts from the text", () => {
    const html = render('<script>alert(1)</script><img src=x onerror="alert(1)">hi');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });

  it("never loads remote images, it shows a link instead", () => {
    const html = render("![pic](https://evil.example/x.png?d=secret)");
    expect(html).not.toContain("<img");
    expect(html).toContain("<a ");
  });

  it("drops javascript: links and opens real links in a new tab", () => {
    const bad = render("[x](javascript:alert(1))");
    expect(bad).not.toContain("javascript:");
    const ok = render("[docs](https://example.com)");
    expect(ok).toContain('href="https://example.com"');
    expect(ok).toContain('target="_blank"');
    expect(ok).toContain("noopener");
  });

  it("has no Preview/Raw toggle and always renders the text", () => {
    const html = renderToStaticMarkup(createElement(MarkdownText, { text: "# Hi" }));
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).not.toContain("Raw");
    expect(html).not.toContain("Preview");
  });

  it("shows long text collapsed with an Expand button (issue #88)", () => {
    const long = Array.from({ length: 30 }, (_, n) => `- step ${n}`).join("\n");
    expect(isLongText(long)).toBe(true);
    expect(isLongText("x".repeat(LONG_TEXT_CHARS + 1))).toBe(true);
    const html = renderToStaticMarkup(createElement(MarkdownText, { text: long }));
    expect(html).toContain("Expand");
    expect(html).toContain("collapsed");
  });

  it("shows short text with no Expand button (issue #88)", () => {
    const short = "# Hi\n\nshort plan";
    expect(isLongText(short)).toBe(false);
    const html = renderToStaticMarkup(createElement(MarkdownText, { text: short }));
    expect(html).not.toContain("Expand");
    expect(html).not.toContain("collapsed");
  });

  it("gives JSON-escaped text its line breaks back, and leaves real text alone", () => {
    expect(readableText('1. one\\n- File: a.ts\\n\\tok \\"x\\"')).toBe('1. one\n- File: a.ts\n\tok "x"');
    expect(readableText("a\nliteral \\n kept")).toBe("a\nliteral \\n kept");
    const html = render("## Plan\\n\\n- one\\n- two");
    expect(html).toContain("<h2>Plan</h2>");
    expect(html).toContain("<li>two</li>");
  });
});
