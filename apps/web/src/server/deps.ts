import type { GitHubReader } from "@clauderon/core";
import type { CommandPublish } from "@clauderon/db";
import type { AccessDeps } from "./access";

/** What the app's commands and queries need; tests pass fakes (spec "test seam"). */
export type AppDeps = AccessDeps & {
  /** Asks the Gateway to act (Postgres NOTIFY). */
  command: CommandPublish;
  github: GitHubReader;
};

export type Viewer = { id: string; email: string };
