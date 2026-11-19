import { z } from "zod";

// How the Agent is distributed and checked (ADR 0007): the web app serves one
// bundled file with a manifest, the Gateway lets a paired Agent check its
// token, and the Agent's doctor reports what its Machine is missing.

/** `GET <web>/agent/agent.json`: the Agent bundle the web app serves at `<web>/agent/agent.mjs`. */
export type AgentManifest = { version: string; sha256: string; size: number };

/**
 * `GET <gateway>/agent/check` with the Machine's token as `Bearer`: 200 while
 * the token is paired, 401 once it is not. The `Date` header tells clock skew.
 */
export type AgentCheck = { paired: true; webUrl: string | null };

/**
 * A version from the old install, a clone of the repository run with tsx
 * (0.3.x and earlier). Those cannot update themselves: the Member runs the
 * installer again. A bundle reports `x.y.z+build`, a checkout `x.y.z-dev`.
 */
export const isLegacyAgentVersion = (version: string | null | undefined): boolean =>
  !!version && !version.includes("+") && !version.endsWith("-dev");

/** fail: the Machine cannot take Runs (it reads Not ready); warn: it can, but something will bite. */
export const doctorStatus = z.enum(["ok", "warn", "fail"]);
export type DoctorStatus = z.infer<typeof doctorStatus>;

export const doctorCheck = z.object({
  /** Stable id, e.g. `tool.gh`, `login.claude`, `gateway.clock`. */
  id: z.string(),
  title: z.string(),
  status: doctorStatus,
  /** What was found: a version, a path, an error. */
  detail: z.string().optional(),
  /** One command or step that fixes it, for this Machine's operating system. */
  fix: z.string().optional(),
});
export type DoctorCheck = z.infer<typeof doctorCheck>;

export const doctorReport = z.object({ checkedAt: z.string(), checks: z.array(doctorCheck) });
export type DoctorReport = z.infer<typeof doctorReport>;

export const doctorFailed = (report: { checks: readonly { status: DoctorStatus }[] } | null | undefined): boolean =>
  !!report && report.checks.some((c) => c.status === "fail");
