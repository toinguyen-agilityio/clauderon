import { describe, expect, it } from "vitest";
import { ATTACHMENT_LIMITS, agentAtLeast, agentSupportsAttachments, attachmentName, attachmentNames, checkAttachments, checkLinks, composeInputText } from "../src/run-attachment";
import { runInputTitle } from "../src/run-input";

describe("attachment names", () => {
  it("keeps the file name alone, safe to write in the worktree", () => {
    expect(attachmentName("../../etc/passwd")).toBe("passwd");
    expect(attachmentName("C:\\Users\\ann\\spec v2.pdf")).toBe("spec v2.pdf");
    expect(attachmentName(".env")).toBe("env");
    expect(attachmentName("-rf.txt")).toBe("rf.txt");
    expect(attachmentName("a$(rm -rf);`x`.md")).toBe("a_(rm -rf)__x_.md");
    expect(attachmentName("Bản thiết kế.docx")).toBe("Bản thiết kế.docx");
    expect(attachmentName("///")).toBe("file");
  });

  it("shortens a long name and keeps its extension", () => {
    const name = attachmentName(`${"a".repeat(300)}.pdf`);
    expect(name.length).toBe(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("makes names unique, ignoring case", () => {
    expect(attachmentNames(["a.pdf", "A.pdf", "dir/a.pdf", "b"])).toEqual(["a.pdf", "A (2).pdf", "a (3).pdf", "b"]);
  });
});

describe("checkAttachments", () => {
  const file = (size: number, name = "f") => ({ name, size });
  it("accepts files within the limits", () => {
    expect(checkAttachments([])).toEqual({ ok: true });
    expect(checkAttachments([file(ATTACHMENT_LIMITS.fileBytes), file(1)])).toEqual({ ok: true });
  });

  it("refuses too many, too large, empty, or too much together", () => {
    expect(checkAttachments(Array.from({ length: 11 }, () => file(1)))).toEqual({ ok: false, error: "Attach at most 10 files." });
    expect(checkAttachments([file(ATTACHMENT_LIMITS.fileBytes + 1, "big.pdf")])).toEqual({ ok: false, error: "big.pdf is larger than 10 MB." });
    expect(checkAttachments([file(0)]).ok).toBe(false);
    expect(checkAttachments([file(9 << 20), file(9 << 20), file(9 << 20)])).toEqual({ ok: false, error: "Attached files are at most 25 MB together." });
  });
});

describe("checkLinks", () => {
  it("keeps http(s) links once, skipping blank lines", () => {
    expect(checkLinks([" https://a.example/x ", "", "https://a.example/x", "http://b.example"])).toEqual({ ok: true, links: ["https://a.example/x", "http://b.example"] });
  });

  it("refuses what is not a web link", () => {
    expect(checkLinks(["not a link"]).ok).toBe(false);
    expect(checkLinks(["file:///etc/passwd"])).toEqual({ ok: false, error: "Links start with https:// or http://." });
    expect(checkLinks(Array.from({ length: 21 }, (_, i) => `https://x.example/${i}`)).ok).toBe(false);
  });
});

describe("composeInputText", () => {
  it("adds the links and the files' paths after the text", () => {
    expect(composeInputText(" Plan ", ["https://a.example"], ["spec.pdf"])).toBe(
      "Plan\n\nSources (open these links for the details):\n- https://a.example\n\nAttachments (files in the worktree; read them):\n- .clauderon/inputs/spec.pdf",
    );
    expect(composeInputText("Plan", [], [])).toBe("Plan");
  });

  it("names the Run after the Flow when there is no text of the Member's own", () => {
    expect(runInputTitle("Deliver", { type: "plan", value: composeInputText("", [], ["spec.pdf"]) })).toBe("Deliver");
  });
});

describe("Agent versions", () => {
  it("compares the release part of a version", () => {
    expect(agentAtLeast("0.6.0+abc", "0.6.0")).toBe(true);
    expect(agentAtLeast("0.10.0-dev", "0.6.0")).toBe(true);
    expect(agentAtLeast("0.5.9", "0.6.0")).toBe(false);
    expect(agentAtLeast(null, "0.6.0")).toBe(false);
    expect(agentSupportsAttachments("0.5.0+x")).toBe(false);
  });
});
