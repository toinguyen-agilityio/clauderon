// The Agent's version. A bundled Agent (scripts/bundle.mjs) reports
// `<AGENT_VERSION>+<build>`, the build being a hash of its code; one run from
// a checkout with tsx reports `<AGENT_VERSION>-dev` and never updates itself.

export const AGENT_VERSION = "0.4.0";

declare const __AGENT_BUILD__: string | undefined;
declare const __OPEN_PR_SCRIPT__: string | undefined;

/** The bundle's build id, or null when running from source. */
export const BUILD: string | null = typeof __AGENT_BUILD__ === "string" ? __AGENT_BUILD__ : null;

export const VERSION = BUILD ? `${AGENT_VERSION}+${BUILD}` : `${AGENT_VERSION}-dev`;

/** `clauderon-open-pr`, embedded in the bundle; from source it is read from `bin/`. */
export const OPEN_PR_SCRIPT: string | null = typeof __OPEN_PR_SCRIPT__ === "string" ? __OPEN_PR_SCRIPT__ : null;

