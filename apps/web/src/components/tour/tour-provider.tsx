"use client";

import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TourFacts } from "../../server/tour";
import { COPY, detectLang, fill, stepText } from "./copy";
import { buildSteps, type PlannedStep } from "./plan";
import { browserStorage, readTour, writeTour, type Lang } from "./storage";

type Ctx = { lang: Lang; open: () => void };
const TourContext = createContext<Ctx>({ lang: "en", open: () => {} });
export const useTour = () => useContext(TourContext);

type Phase = "idle" | "running";

/** Waits (briefly) for the page to render the area a step points at; null when it is not on screen. */
function waitFor(selector: string, ms: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      // A closed mobile menu leaves the nav links in the DOM but not on screen.
      if (el && el.getClientRects().length > 0) return resolve(el);
      if (Date.now() - started >= ms) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The guided tour (driver.js draws the highlight and tooltip), started only from Take the tour. It walks one round: pair a Machine, pick a Ticket,
 * the Flow, start a Run, follow it, find the Pull request. Finished or skipped lives in the browser only.
 */
export function TourProvider({
  isOperator,
  loadFacts,
  children,
}: {
  isOperator: boolean;
  loadFacts: () => Promise<TourFacts>;
  children: ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<Lang>("en");
  const [facts, setFacts] = useState<TourFacts | null>(null);
  const drv = useRef<Driver | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const latest = useRef({ index, lang });
  latest.current = { index, lang };

  const steps: PlannedStep[] = useMemo(() => (facts ? buildSteps(isOperator, facts) : []), [facts, isOperator]);

  const close = useCallback((status: "finished" | "skipped" | "inProgress") => {
    writeTour(browserStorage(), { status, step: latest.current.index, lang: latest.current.lang });
    const d = drv.current;
    drv.current = null;
    d?.destroy();
    setPhase("idle");
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back?.isConnected) back.focus();
  }, []);

  const begin = useCallback((at: number) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIndex(at);
    setPhase("running");
  }, []);

  // The tour only starts when the Member asks for it (Take the tour).
  // The language is known from the first render on, so the sidebar entry is in it before the tour is opened.
  useEffect(() => {
    setLang(readTour(browserStorage()).lang ?? detectLang(navigator.language));
  }, []);

  const open = useCallback(() => {
    loadFacts()
      .then((f) => {
        setFacts(f);
        begin(0);
      })
      .catch(() => {});
  }, [loadFacts, begin]);

  // Fresh facts at each step: a Run started in the tour changes the later steps.
  const fetchedFor = useRef(-1);
  useEffect(() => {
    if (phase !== "running" || fetchedFor.current === index) return;
    fetchedFor.current = index;
    // Keep the same object when nothing changed, so the step is not drawn a second time.
    loadFacts()
      .then((f) => setFacts((prev) => (prev && JSON.stringify(prev) === JSON.stringify(f) ? prev : f)))
      .catch(() => {});
  }, [phase, index, loadFacts]);
  useEffect(() => {
    if (phase !== "running") fetchedFor.current = -1;
  }, [phase]);

  // Show the step: go to its page, wait for its area, then highlight it.
  useEffect(() => {
    if (phase !== "running" || !facts) return;
    const step = steps[index];
    if (!step) return;
    if (path !== step.route) {
      // Drop the old tooltip at once instead of leaving it on the wrong page while the next one loads.
      const previous = drv.current;
      drv.current = null;
      previous?.destroy();
      router.push(step.route);
      return;
    }
    let cancelled = false;
    const t = COPY[lang];
    // A step that only says what is missing does not wait for its area to render.
    void waitFor(step.selector, step.missing ? 0 : 1500).then((el) => {
      if (cancelled) return;
      const previous = drv.current;
      drv.current = null;
      previous?.destroy();
      const last = index === steps.length - 1;
      const text = step.missing ? t.missing[step.missing.need] : stepText(lang, step.id);
      const body = step.id === "pullRequests" && facts.pullRequests === 0 ? `${text.body} ${t.ui.noWait}` : text.body;
      const d = driver({
        animate: !reducedMotion(),
        smoothScroll: !reducedMotion(),
        allowClose: true,
        overlayClickBehavior: "none",
        overlayColor: "#0e1a26",
        overlayOpacity: 0.55,
        stageRadius: 8,
        showProgress: true,
        progressText: fill(t.ui.progress, { n: index + 1, total: steps.length }),
        nextBtnText: last ? t.ui.done : t.ui.next,
        prevBtnText: t.ui.back,
        closeBtnLabel: t.ui.dismiss,
        popoverClass: "tour-popover",
        showButtons: index === 0 ? ["next", "close"] : ["next", "previous", "close"],
        onNextClick: () => (last ? close("finished") : setIndex(index + 1)),
        onPrevClick: () => setIndex(Math.max(0, index - 1)),
        onCloseClick: () => close("inProgress"),
        onPopoverRender: (popover) => {
          popover.wrapper.setAttribute("aria-live", "polite");
          popover.progress.textContent = fill(t.ui.progress, { n: index + 1, total: steps.length });
          popover.progress.style.display = "";
          const extra = document.createElement("div");
          extra.className = "tour-extra";
          popover.description.after(extra);

          if (step.missing) {
            const fix = step.missing;
            const link = document.createElement("a");
            link.href = fix.href;
            link.className = "tour-link";
            link.textContent = t.missing[fix.need].link;
            link.addEventListener("click", (e) => {
              e.preventDefault();
              close("inProgress");
              router.push(fix.href);
            });
            extra.append(link);
          }

          const skip = document.createElement("button");
          skip.type = "button";
          skip.className = "tour-skip";
          skip.textContent = t.ui.skip;
          skip.addEventListener("click", () => close("skipped"));
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "tour-lang";
          toggle.textContent = t.ui.language;
          toggle.addEventListener("click", () => {
            const next = lang === "en" ? "vi" : "en";
            // Remembered at once, so the choice survives a reload and shows on the sidebar entry too.
            const was = readTour(browserStorage());
            writeTour(browserStorage(), { status: was.status === "new" ? "inProgress" : was.status, step: latest.current.index, lang: next });
            setLang(next);
          });
          popover.footer.prepend(toggle, skip);
        },
      });
      drv.current = d;
      // highlight() defaults the popover to no buttons and no progress, over the driver config, so say them here.
      d.highlight({
        element: el ?? undefined,
        popover: {
          title: text.title,
          description: body,
          showButtons: index === 0 ? ["next", "close"] : ["next", "previous", "close"],
          showProgress: true,
          progressText: fill(t.ui.progress, { n: index + 1, total: steps.length }),
          // Beside the checkbox, so the Ticket rows below it stay visible to tick.
          ...(step.id === "start" && !step.missing ? { side: "right" as const, align: "start" as const } : {}),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [phase, index, facts, steps, path, lang, router, close]);

  // Escape closes the tour (keeping the step, so it can be resumed) and focus goes back to where it was.
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      // Escape inside the Start dialog closes only the dialog.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) close("inProgress");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, close]);

  useEffect(
    () => () => {
      const d = drv.current;
      drv.current = null;
      d?.destroy();
    },
    [],
  );

  const ctx = useMemo(() => ({ lang, open }), [lang, open]);

  return (
    <TourContext.Provider value={ctx}>
      {children}
    </TourContext.Provider>
  );
}
