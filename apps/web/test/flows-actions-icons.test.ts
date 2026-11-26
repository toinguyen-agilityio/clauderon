import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("../src/app/(app)/flows/actions", () => ({ importFlowAction: vi.fn(), createFlowAction: vi.fn() }));
vi.mock("../src/components/shell-socket", () => ({ useShellSocket: () => null }));

import { BuildFlow } from "../src/app/(app)/flows/build-flow";
import { ImportFlow } from "../src/app/(app)/flows/import-flow";
import { NewFlow } from "../src/app/(app)/flows/new-flow";

/** The page button: the first <button> a component renders, before its dialog. */
const pageButton = (el: ReactElement) => /<button[^>]*>.*?<\/button>/s.exec(renderToStaticMarkup(el))?.[0] ?? "";
/** The button's accessible name: its text with the decorative (aria-hidden) svg removed. */
const accessibleName = (button: string) => button.replace(/<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>/gs, "").replace(/<[^>]+>/g, "").trim();

describe("Flows page action buttons (#196)", () => {
  const cases = [
    { name: "Import Flow", el: createElement(ImportFlow) },
    { name: "Build with Agent", el: createElement(BuildFlow, { availability: { ok: true, machine: "mac" } }) },
    { name: "New Flow", el: createElement(NewFlow) },
  ];

  it.each(cases)("$name shows a decorative icon before its label", ({ name, el }) => {
    const button = pageButton(el);
    expect(button).toMatch(/^<button[^>]*><svg[^>]*aria-hidden="true"/);
    expect(accessibleName(button)).toBe(name);
  });

  it("keeps Build with Agent disabled when no Machine can build", () => {
    const button = pageButton(createElement(BuildFlow, { availability: { ok: false, reason: "No Machine online" } }));
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-hidden="true"');
    expect(accessibleName(button)).toBe("Build with Agent");
  });
});
