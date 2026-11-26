/** The app's release tag (e.g. `v0.8.0`), set as APP_VERSION by deploy/deploy.sh; `dev` when unset. */
export function appVersion(env: Record<string, string | undefined>): string {
  return env.APP_VERSION?.trim() || "dev";
}
