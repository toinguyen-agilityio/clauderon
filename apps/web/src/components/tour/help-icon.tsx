"use client";

import { useEffect, useId, useRef, useState } from "react";
import { COPY, fill } from "./copy";
import type { Area } from "./steps";
import { useTour } from "./tour-provider";

/** A small "?" beside an area: the same tooltip as the tour, on hover, focus and tap. Escape closes it. */
export function HelpIcon({ area }: { area: Area }) {
  const { lang } = useTour();
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = pinned || hover || focus;
  const { title, help } = COPY[lang].area[area];

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPinned(false);
      setHover(false);
      setFocus(false);
    };
    const onDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [shown]);

  return (
    <span ref={ref} className="help-icon" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        className="help-btn"
        aria-label={fill(COPY[lang].ui.helpFor, { area: title })}
        aria-describedby={shown ? id : undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onClick={() => setPinned((p) => !p)}
      >
        ?
      </button>
      {shown && (
        <span id={id} role="tooltip" className="help-tip">
          <strong>{title}</strong> {help}
        </span>
      )}
    </span>
  );
}

/** The menu entry that restarts the tour. */
export function TakeTourButton() {
  const { lang, open } = useTour();
  return (
    <button type="button" className="take-tour" title={COPY[lang].ui.takeTheTour} onClick={open}>
      <span aria-hidden="true">?</span>
      <span className="lbl">{COPY[lang].ui.takeTheTour}</span>
    </button>
  );
}
