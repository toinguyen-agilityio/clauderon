"use client";

import { Icon } from "../icons";
import { COPY } from "./copy";
import { useTour } from "./tour-provider";

/** The menu entry that restarts the tour. */
export function TakeTourButton() {
  const { lang, open } = useTour();
  return (
    <button type="button" className="take-tour" title={COPY[lang].ui.takeTheTour} onClick={open}>
      {Icon.help}
      <span className="lbl">{COPY[lang].ui.takeTheTour}</span>
    </button>
  );
}
